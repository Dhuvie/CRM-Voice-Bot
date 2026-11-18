import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildSystemPrompt,
  getPromptState,
  resetCustomPrompt,
  saveCustomPrompt,
} from '../src/prompt.js';
import { CallStore, formatSection9Line } from '../src/callStore.js';
import { CallRecorder, downsample24kTo16k } from '../src/callRecorder.js';

test('System prompt uses Dhruv consistently with strict spoken pronunciations and Devanagari anchors', () => {
  const prompt = buildSystemPrompt({ leadName: 'Rohan Mehta' });
  assert.match(prompt, /You are Dhruv \(ध्रुव\), Senior Property Consultant/);
  assert.match(prompt, /Hello, may I speak with Rohan Mehta\?/);
  assert.match(prompt, /main Dhruv bol raha hoon/);
  assert.doesNotMatch(prompt, /\bAarav\b/);
  assert.match(prompt, /seventy-four percent open spaces/);
  assert.match(prompt, /December twenty twenty-nine/);
  assert.match(prompt, /Div-yaa-shree/);
  assert.match(prompt, /Nun-dhee Hills/);
  assert.match(prompt, /Day-vuh-nuh-hull-ee/);
  assert.match(prompt, /Ben-guh-loo-roo/);
  assert.match(prompt, /दिव्यश्री/);
});

test('Custom system prompt saves, interpolates {{LEAD_NAME}}, and resets cleanly', () => {
  const tmpPrompt = path.join(os.tmpdir(), `wow-prompt-test-${Date.now()}.txt`);
  try {
    const initial = getPromptState(tmpPrompt);
    assert.equal(initial.isCustom, false);

    const saved = saveCustomPrompt('Hello {{LEAD_NAME}}, welcome to custom WOW.', tmpPrompt);
    assert.equal(saved.isCustom, true);

    const resolved = buildSystemPrompt({
      leadName: 'Priya Nair',
      leadContext: 'Interested in 2400 sqft plot',
      promptFile: tmpPrompt,
    });
    assert.match(resolved, /Hello Priya Nair, welcome to custom WOW\./);
    assert.match(resolved, /Interested in 2400 sqft plot/);

    const reset = resetCustomPrompt(tmpPrompt);
    assert.equal(reset.isCustom, false);
  } finally {
    if (fs.existsSync(tmpPrompt)) fs.unlinkSync(tmpPrompt);
  }
});

test('CallStore persists Section 9 format and exports valid CSV', () => {
  const tmpFile = path.join(os.tmpdir(), `wow-logs-test-${Date.now()}.json`);
  try {
    const store = new CallStore(tmpFile);
    const saved = store.upsert({
      name: 'Ananya Rao',
      permission: 'Yes',
      intent: 'Weekend home',
      locationFit: 'Yes',
      budgetFit: 'Yes',
      timelineComfort: 'Comfortable',
      language: 'English',
      followUpTime: 'Saturday 11:00 AM',
      leadStatus: 'Hot',
      notes: 'Asked for RERA number & brochure, excited about eco-parks',
      durationSec: 142,
    });

    assert.equal(saved.permission, 'Y');
    assert.equal(saved.leadStatus, 'Hot');
    assert.equal(saved.internalLogLine, formatSection9Line(saved));
    assert.match(
      saved.internalLogLine,
      /^Ananya Rao \| Y \| Weekend home \| Yes \| Yes \| Comfortable \| English \| Saturday 11:00 AM \| Hot \| /
    );

    const reloaded = new CallStore(tmpFile);
    assert.equal(reloaded.list().length, 1);
    assert.equal(reloaded.list()[0].name, 'Ananya Rao');

    const csv = reloaded.toCsv();
    assert.match(csv, /"Asked for RERA number & brochure, excited about eco-parks"/);

    assert.equal(reloaded.remove(saved.id), true);
    assert.equal(reloaded.list().length, 0);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('CallRecorder mixes lead 16kHz + agent 24kHz into valid 16kHz WAV and honors barge-in', () => {
  const dc24k = new Int16Array(300).fill(4000);
  const dc16k = downsample24kTo16k(dc24k);
  assert.equal(dc16k.length, 200);
  assert.equal(dc16k[0], 4000);

  const t0 = 1000000;
  const rec = new CallRecorder(t0);

  const leadBuf = Buffer.alloc(640);
  for (let i = 0; i < 320; i++) leadBuf.writeInt16LE(1000, i * 2);
  rec.addLeadPcm16k(leadBuf, t0);

  const agentBuf = Buffer.alloc(9600);
  for (let i = 0; i < 4800; i++) agentBuf.writeInt16LE(2000, i * 2);
  rec.addAgentPcm24k(agentBuf, t0);

  // Interrupt agent at 50ms (800 samples at 16kHz)
  rec.markAgentInterrupted(t0 + 50);

  const wav = rec.buildWavBuffer();
  assert.ok(wav);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt32LE(40), 800 * 2);
  assert.equal(wav.readInt16LE(44), 3000);
  assert.equal(wav.readInt16LE(44 + 500 * 2), 2000);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-rec-test-'));
  const tmpLog = path.join(tmpDir, 'logs.json');
  const wavName = 'call_test_1.wav';
  const wavPath = path.join(tmpDir, wavName);
  try {
    assert.equal(rec.saveToFile(wavPath), true);
    assert.equal(fs.existsSync(wavPath), true);
    const store = new CallStore(tmpLog, tmpDir);
    const entry = store.upsert({ id: 'call_test_1', name: 'Rohan', recordingFile: wavName, leadStatus: 'Warm' });
    assert.equal(entry.recordingUrl, '/api/recordings/call_test_1.wav');
    assert.equal(store.remove('call_test_1'), true);
    assert.equal(fs.existsSync(wavPath), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
