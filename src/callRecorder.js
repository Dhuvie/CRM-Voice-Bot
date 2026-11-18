import fs from 'node:fs';
import path from 'node:path';

const RECORD_SAMPLE_RATE = 16000;

// Downsamples 24kHz Int16 PCM to 16kHz Int16 PCM (exact 3:2 linear interpolation).
export function downsample24kTo16k(pcm24k) {
  const outLen = Math.floor((pcm24k.length * 2) / 3);
  if (outLen === 0) return new Int16Array(0);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * 1.5;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = pcm24k[idx];
    const s1 = idx + 1 < pcm24k.length ? pcm24k[idx + 1] : s0;
    out[i] = Math.round(s0 + (s1 - s0) * frac);
  }
  return out;
}

function bufferToInt16(buf) {
  const count = Math.floor(buf.length / 2);
  const out = new Int16Array(count);
  for (let i = 0; i < count; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

function encodeWav16kMono(samples) {
  const dataBytes = samples.length * 2;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RECORD_SAMPLE_RATE, 24);
  header.writeUInt32LE(RECORD_SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataBytes, 40);

  const body = Buffer.allocUnsafe(dataBytes);
  for (let i = 0; i < samples.length; i++) body.writeInt16LE(samples[i], i * 2);
  return Buffer.concat([header, body]);
}

// Records both lead (16kHz) and agent (24kHz) streams aligned on one 16kHz WAV timeline.
export class CallRecorder {
  constructor(startedAt = Date.now()) {
    this.startedAt = startedAt;
    this.leadSegments = [];
    this.agentSegments = [];
    this.leadCursor = 0;
    this.agentCursor = 0;
  }

  _wallSample(now = Date.now()) {
    return Math.max(0, Math.floor(((now - this.startedAt) / 1000) * RECORD_SAMPLE_RATE));
  }

  addLeadPcm16k(pcm16kBuffer, now = Date.now()) {
    if (!pcm16kBuffer?.length) return;
    const samples = bufferToInt16(pcm16kBuffer);
    if (!samples.length) return;
    const wall = this._wallSample(now);
    // Re-sync cursor after mute or silence gaps (> 250ms)
    if (wall > this.leadCursor + 4000) this.leadCursor = wall;
    this.leadSegments.push({ start: this.leadCursor, samples });
    this.leadCursor += samples.length;
  }

  addAgentPcm24k(pcm24kBuffer, now = Date.now()) {
    if (!pcm24kBuffer?.length) return;
    const samples16k = downsample24kTo16k(bufferToInt16(pcm24kBuffer));
    if (!samples16k.length) return;
    const wall = this._wallSample(now);
    // Start new agent turn at current wall clock if previous audio already finished
    if (wall > this.agentCursor + 2400) this.agentCursor = wall;
    this.agentSegments.push({ start: this.agentCursor, samples: samples16k });
    this.agentCursor += samples16k.length;
  }

  // Drops unplayed future agent audio when the lead interrupts mid-sentence
  markAgentInterrupted(now = Date.now()) {
    const cutoff = this._wallSample(now);
    const trimmed = [];
    for (const seg of this.agentSegments) {
      if (seg.start >= cutoff) continue;
      const end = seg.start + seg.samples.length;
      if (end > cutoff) {
        trimmed.push({ start: seg.start, samples: seg.samples.subarray(0, cutoff - seg.start) });
      } else {
        trimmed.push(seg);
      }
    }
    this.agentSegments = trimmed;
    this.agentCursor = Math.min(this.agentCursor, cutoff);
  }

  hasAudio() {
    return this.leadSegments.length > 0 || this.agentSegments.length > 0;
  }

  buildWavBuffer() {
    if (!this.hasAudio()) return null;

    let totalSamples = 0;
    for (const seg of this.leadSegments) {
      totalSamples = Math.max(totalSamples, seg.start + seg.samples.length);
    }
    for (const seg of this.agentSegments) {
      totalSamples = Math.max(totalSamples, seg.start + seg.samples.length);
    }
    if (totalSamples === 0) return null;

    const mixed = new Int16Array(totalSamples);
    const mixIn = (segments) => {
      for (const { start, samples } of segments) {
        for (let i = 0; i < samples.length; i++) {
          const idx = start + i;
          const sum = mixed[idx] + samples[i];
          mixed[idx] = sum > 32767 ? 32767 : sum < -32768 ? -32768 : sum;
        }
      }
    };

    mixIn(this.leadSegments);
    mixIn(this.agentSegments);
    return encodeWav16kMono(mixed);
  }

  saveToFile(filePath) {
    const wav = this.buildWavBuffer();
    if (!wav) return false;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, wav);
    return true;
  }
}
