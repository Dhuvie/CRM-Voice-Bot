// Resamples mic to 16kHz Int16 PCM (20ms frames) with adaptive noise gate and Hybrid VAD.
class Pcm16DownsampleProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate;
    this.buffer = [];
    this.chunkSamples = 320;
    this.phase = 0;

    // Adaptive noise floor & Hybrid VAD state (20ms per frame)
    this.noiseFloor = 0.006;
    this.inSpeech = false;
    this.silentFrames = 0;
    this.endSilenceFrames = 10; // 200ms quiet -> emit speech_end
    this.gateHoldFrames = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const channel = input[0];
    let sumSq = 0;
    for (let i = 0; i < channel.length; i++) sumSq += channel[i] * channel[i];
    const rms = Math.sqrt(sumSq / channel.length);

    while (this.phase < channel.length) {
      const idx = Math.floor(this.phase);
      const frac = this.phase - idx;
      const s0 = channel[idx];
      const s1 = idx + 1 < channel.length ? channel[idx + 1] : s0;
      const clamped = Math.max(-1, Math.min(1, s0 + (s1 - s0) * frac));
      this.buffer.push(clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767));
      this.phase += this.ratio;
    }
    this.phase -= channel.length;

    while (this.buffer.length >= this.chunkSamples) {
      const chunk = new Int16Array(this.buffer.splice(0, this.chunkSamples));

      // Update adaptive noise floor only during quiet frames
      const speechThreshold = Math.max(0.015, this.noiseFloor * 2.6);
      const isVoice = rms >= speechThreshold;

      let vadEvent = null;
      if (isVoice) {
        this.inSpeech = true;
        this.silentFrames = 0;
        this.gateHoldFrames = 8; // 160ms tail preserves soft consonants
      } else {
        this.noiseFloor = this.noiseFloor * 0.96 + rms * 0.04;
        if (this.inSpeech) {
          this.silentFrames += 1;
          if (this.silentFrames >= this.endSilenceFrames) {
            this.inSpeech = false;
            this.silentFrames = 0;
            vadEvent = 'speech_end';
          }
        }
      }

      // Zero out idle room hiss so server VAD commits turns immediately
      if (!isVoice && this.gateHoldFrames > 0) {
        this.gateHoldFrames -= 1;
      } else if (!isVoice) {
        chunk.fill(0);
      }

      this.port.postMessage({ pcm: chunk.buffer, rms, vadEvent }, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm16-downsample-processor', Pcm16DownsampleProcessor);
