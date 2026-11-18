const els = {
  geminiPill: document.getElementById('gemini-pill'),
  promptModePill: document.getElementById('prompt-mode-pill'),
  setupBanner: document.getElementById('setup-banner'),
  themeSwitch: document.getElementById('theme-switch'),

  tablist: document.querySelector('.nav-tablist'),
  navTabs: [...document.querySelectorAll('.nav-tab')],
  tabPanels: [...document.querySelectorAll('.tab-panel')],
  logsTabCount: document.getElementById('logs-tab-count'),
  promptTabTag: document.getElementById('prompt-tab-tag'),

  inspectDialog: document.getElementById('inspect-dialog'),
  inspectMeta: document.getElementById('inspect-meta'),
  inspectTitle: document.getElementById('inspect-title'),
  inspectAudioWell: document.getElementById('inspect-audio-well'),
  inspectAudio: document.getElementById('inspect-audio'),
  inspectDownload: document.getElementById('inspect-download'),
  inspectPipeLine: document.getElementById('inspect-pipe-line'),
  inspectTranscript: document.getElementById('inspect-transcript'),
  btnInspectCopy: document.getElementById('btn-inspect-copy'),

  playbackDeck: document.getElementById('playback-deck'),
  playbackTitle: document.getElementById('playback-title'),
  playbackDownload: document.getElementById('playback-download'),
  deckAudio: document.getElementById('deck-audio'),
  btnCloseDeck: document.getElementById('btn-close-deck'),

  leadName: document.getElementById('lead-name'),
  voiceSelect: document.getElementById('voice-select'),
  leadContext: document.getElementById('lead-context'),

  orbStage: document.getElementById('orb-stage'),
  vuMeter: document.getElementById('vu-meter'),
  callStateBadge: document.getElementById('call-state-badge'),
  langPill: document.getElementById('lang-pill'),
  latencyPill: document.getElementById('latency-pill'),
  callTimer: document.getElementById('call-timer'),
  callStatusText: document.getElementById('call-status-text'),

  btnStartCall: document.getElementById('btn-start-call'),
  btnMute: document.getElementById('btn-mute'),
  muteLabel: document.getElementById('mute-label'),
  btnEndCall: document.getElementById('btn-end-call'),

  quickChips: [...document.querySelectorAll('[data-quick-text]')],
  textReplyForm: document.getElementById('text-reply-form'),
  textReplyInput: document.getElementById('text-reply-input'),
  btnSendText: document.getElementById('btn-send-text'),

  liveChannelTag: document.getElementById('live-channel-tag'),
  flowSteps: [...document.querySelectorAll('.step-led')],
  transcriptFeed: document.getElementById('transcript-feed'),
  logsTbody: document.getElementById('logs-tbody'),
  btnClearLogs: document.getElementById('btn-clear-logs'),

  kpiTotal: document.getElementById('kpi-total'),
  kpiHot: document.getElementById('kpi-hot'),
  kpiWarm: document.getElementById('kpi-warm'),
  kpiFollowups: document.getElementById('kpi-followups'),

  chkPermission: document.querySelector('#chk-permission .gauge-v'),
  chkIntent: document.querySelector('#chk-intent .gauge-v'),
  chkLocation: document.querySelector('#chk-location .gauge-v'),
  chkBudget: document.querySelector('#chk-budget .gauge-v'),
  chkTimeline: document.querySelector('#chk-timeline .gauge-v'),
  chkStatus: document.querySelector('#chk-status .gauge-v'),

  promptEditor: document.getElementById('system-prompt-editor'),
  promptStats: document.getElementById('prompt-stats'),
  promptStatusMsg: document.getElementById('prompt-status-msg'),
  btnSavePrompt: document.getElementById('btn-save-prompt'),
  btnResetPrompt: document.getElementById('btn-reset-prompt'),
  btnCopyPrompt: document.getElementById('btn-copy-prompt'),
};

// Light (default) and Dark only toggle
function initThemeSwitch() {
  const meta = document.querySelector('meta[name="color-scheme"]');

  const applyTheme = (theme) => {
    const mode = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = mode;
    meta.content = mode;
    els.themeSwitch.setAttribute('aria-checked', String(mode === 'dark'));
  };

  let initial = 'light';
  try {
    initial = localStorage.getItem('wow-theme') === 'dark' ? 'dark' : 'light';
  } catch {}
  applyTheme(initial);

  els.themeSwitch.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('wow-theme', next); } catch {}
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'wow-theme') applyTheme(e.newValue === 'dark' ? 'dark' : 'light');
  });
}

// Top-level accessible tabs with selection-follows-focus and beforematch sync
function initTabs() {
  const panelByTabId = new Map(
    els.tabPanels.map((p) => [p.getAttribute('aria-labelledby'), p])
  );

  const selectTab = (tab, moveFocus = false) => {
    for (const t of els.navTabs) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      const panel = panelByTabId.get(t.id);
      if (panel) panel.hidden = !selected;
    }
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
    if (moveFocus) tab.focus();
  };

  for (const tab of els.navTabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      const idx = els.navTabs.indexOf(tab);
      let nextIdx = null;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % els.navTabs.length;
      else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + els.navTabs.length) % els.navTabs.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = els.navTabs.length - 1;
      if (nextIdx !== null) {
        e.preventDefault();
        selectTab(els.navTabs[nextIdx], true);
      }
    });
  }

  for (const panel of els.tabPanels) {
    panel.addEventListener('beforematch', () => {
      const tab = document.getElementById(panel.getAttribute('aria-labelledby'));
      if (tab) selectTab(tab);
    });
  }
}

function initDialog() {
  els.inspectDialog.addEventListener('close', () => {
    els.inspectDialog.returnValue = '';
    els.inspectAudio.pause();
  });

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    els.inspectDialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, els.inspectDialog); });
    els.inspectDialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e, els.inspectDialog)) els.inspectDialog.close();
    });
  }
}

// Analog needle VU meter + LED bar on recessed LCD canvas
const vuCtx = els.vuMeter.getContext('2d');
let currentMicLevel = 0;
let currentAgentLevel = 0;
let needleVal = 0;

function drawVuMeter() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = els.vuMeter.clientWidth || 240;
  const h = els.vuMeter.clientHeight || 98;
  if (els.vuMeter.width !== Math.round(w * dpr) || els.vuMeter.height !== Math.round(h * dpr)) {
    els.vuMeter.width = Math.round(w * dpr);
    els.vuMeter.height = Math.round(h * dpr);
  }

  vuCtx.save();
  vuCtx.scale(dpr, dpr);
  vuCtx.clearRect(0, 0, w, h);

  const target = Math.min(1, Math.max(currentMicLevel * 5.2, currentAgentLevel * 4.4));
  needleVal += (target - needleVal) * 0.24;
  currentMicLevel *= 0.84;
  currentAgentLevel *= 0.84;

  const isAgent = currentAgentLevel > currentMicLevel * 1.1 && currentAgentLevel > 0.015;
  const cx = w / 2;
  const cy = h + 12;
  const radius = Math.min(w * 0.44, h - 10);

  const startA = Math.PI * 1.18;
  const endA = Math.PI * 1.82;
  vuCtx.lineWidth = 2;
  vuCtx.strokeStyle = 'rgba(126, 240, 174, 0.35)';
  vuCtx.beginPath();
  vuCtx.arc(cx, cy, radius, startA, Math.PI * 1.66);
  vuCtx.stroke();

  vuCtx.strokeStyle = 'rgba(245, 195, 91, 0.8)';
  vuCtx.beginPath();
  vuCtx.arc(cx, cy, radius, Math.PI * 1.66, endA);
  vuCtx.stroke();

  const ticks = 12;
  for (let i = 0; i <= ticks; i++) {
    const a = startA + (i / ticks) * (endA - startA);
    const r0 = radius - (i % 3 === 0 ? 8 : 5);
    const r1 = radius + 1;
    vuCtx.strokeStyle = i >= 9 ? '#f5c35b' : '#7ef0ae';
    vuCtx.lineWidth = i % 3 === 0 ? 1.6 : 1;
    vuCtx.beginPath();
    vuCtx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    vuCtx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    vuCtx.stroke();
  }

  vuCtx.fillStyle = isAgent ? '#f5c35b' : '#7ef0ae';
  vuCtx.font = '700 10px Consolas, monospace';
  vuCtx.textAlign = 'center';
  vuCtx.fillText(isAgent ? 'DHRUV TX' : currentMicLevel > 0.02 ? 'LEAD MIC' : 'VU LEVEL', cx, h - 22);

  const segCount = 12;
  const segW = (w - 24 - (segCount - 1) * 3) / segCount;
  const litSegs = Math.round(needleVal * segCount);
  for (let i = 0; i < segCount; i++) {
    const lit = i < litSegs;
    vuCtx.fillStyle = lit
      ? (i >= 9 ? '#f5c35b' : '#6ef7a6')
      : 'rgba(126, 240, 174, 0.12)';
    vuCtx.fillRect(12 + i * (segW + 3), h - 12, segW, 6);
  }

  const needleA = startA + needleVal * (endA - startA);
  vuCtx.strokeStyle = isAgent ? '#f5c35b' : '#e4fff0';
  vuCtx.lineWidth = 2;
  vuCtx.beginPath();
  vuCtx.moveTo(cx, cy);
  vuCtx.lineTo(cx + Math.cos(needleA) * (radius - 2), cy + Math.sin(needleA) * (radius - 2));
  vuCtx.stroke();

  vuCtx.restore();
  requestAnimationFrame(drawVuMeter);
}
requestAnimationFrame(drawVuMeter);

// Zero-copy binary 24kHz PCM playback queue
class AudioPlayer24k {
  constructor() {
    this.ctx = null;
    this.nextStartTime = 0;
    this.activeSources = new Set();
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = this.ctx.currentTime;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  enqueueArrayBuffer(arrayBuffer) {
    this.ensureContext();
    const int16 = new Int16Array(arrayBuffer);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    let sumSq = 0;
    for (let i = 0; i < int16.length; i++) {
      const f = int16[i] / 32768;
      float32[i] = f;
      sumSq += f * f;
    }
    currentAgentLevel = Math.sqrt(sumSq / int16.length);

    const audioBuffer = this.ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const src = this.ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(this.ctx.destination);

    const startAt = Math.max(this.ctx.currentTime, this.nextStartTime);
    src.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;

    this.activeSources.add(src);
    src.onended = () => this.activeSources.delete(src);
  }

  clear() {
    for (const src of this.activeSources) {
      try { src.stop(); } catch {}
    }
    this.activeSources.clear();
    if (this.ctx) this.nextStartTime = this.ctx.currentTime;
  }
}

let ws = null;
let micStream = null;
let captureCtx = null;
let workletNode = null;
let isMuted = false;
let callActive = false;
let timerInterval = null;
let callStartMs = 0;
const player = new AudioPlayer24k();
const transcriptElements = new Map();

function setFlowStep(stepNum) {
  for (const el of els.flowSteps) {
    const n = Number(el.dataset.step);
    el.classList.toggle('done', n < stepNum);
    el.classList.toggle('active', n === stepNum);
  }
}

function updateTelemetry({ step, language, latencyMs }) {
  if (step) setFlowStep(step);
  if (language) {
    els.langPill.textContent = language === 'Hindi' ? 'HI' : language === 'Hinglish' ? 'HI/EN' : 'EN';
  }
  if (typeof latencyMs === 'number' && Number.isFinite(latencyMs)) {
    els.latencyPill.textContent = `${latencyMs} ms`;
  }
}

function setLed(el, text, variant) {
  el.className = `led-module led-${variant}`;
  el.querySelector('.led-label').textContent = text;
}

function resetLiveView(channelLabel) {
  transcriptElements.clear();
  els.transcriptFeed.innerHTML = '';
  setLed(els.liveChannelTag, channelLabel, 'ok');
  setFlowStep(1);
  els.langPill.textContent = 'EN';
  els.latencyPill.textContent = '-- ms';
  updateChecklist(null);
}

function updateChecklist(record) {
  const setVal = (el, val) => {
    const clean = val && val !== 'Not captured' && val !== 'Unknown' ? val : '-';
    el.textContent = clean;
    el.closest('.gauge-well')?.classList.toggle('captured', clean !== '-');
  };
  if (!record) {
    setVal(els.chkPermission, null);
    setVal(els.chkIntent, null);
    setVal(els.chkLocation, null);
    setVal(els.chkBudget, null);
    setVal(els.chkTimeline, null);
    setVal(els.chkStatus, null);
    return;
  }
  setVal(els.chkPermission, record.permission);
  setVal(els.chkIntent, record.intent);
  setVal(els.chkLocation, record.locationFit);
  setVal(els.chkBudget, record.budgetFit);
  setVal(els.chkTimeline, record.timelineComfort);
  setVal(els.chkStatus, record.leadStatus);
}

function formatShortTime(iso) {
  try {
    return new Date(iso || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function upsertTranscriptBubble({ turnId, speaker, text }) {
  if (!text) return;
  const empty = els.transcriptFeed.querySelector('.well-empty');
  if (empty) empty.remove();

  let row = transcriptElements.get(turnId);
  if (!row) {
    row = document.createElement('div');
    row.className = `msg-row ${speaker === 'agent' ? 'agent' : 'lead'}`;

    const leadDisplay = els.leadName.value.trim() || 'Lead';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = speaker === 'agent' ? 'D' : leadDisplay.charAt(0).toUpperCase();

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const head = document.createElement('div');
    head.className = 'bubble-head';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = speaker === 'agent' ? 'Dhruv · Divyasree' : leadDisplay;
    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatShortTime();
    head.append(nameSpan, timeSpan);

    const body = document.createElement('div');
    body.className = 'bubble-text';

    bubble.append(head, body);
    row.append(avatar, bubble);
    els.transcriptFeed.append(row);
    transcriptElements.set(turnId, row);
  }
  row.querySelector('.bubble-text').textContent = text;
  els.transcriptFeed.scrollTop = els.transcriptFeed.scrollHeight;
}

function setCallUiState(state, statusMsg) {
  const isLive = state === 'connected';
  const isBusy = state === 'connecting' || state === 'finalizing';
  callActive = isLive || isBusy;

  els.btnStartCall.disabled = callActive;
  els.btnMute.disabled = !isLive;
  els.btnEndCall.disabled = !callActive;
  els.textReplyInput.disabled = !isLive;
  els.btnSendText.disabled = !isLive;
  for (const chip of els.quickChips) chip.disabled = !isLive;

  els.orbStage.dataset.state = isLive ? 'live' : isBusy ? 'connecting' : 'idle';
  els.callStateBadge.textContent = isLive
    ? 'ON AIR'
    : state === 'connecting'
      ? 'CONNECTING'
      : state === 'finalizing'
        ? 'SAVING CRM'
        : 'STANDBY';

  if (statusMsg) els.callStatusText.textContent = statusMsg;
  if (!callActive) setLed(els.liveChannelTag, 'Standby', 'neutral');
}

function startTimer() {
  stopTimer();
  callStartMs = Date.now();
  els.callTimer.textContent = '00:00';
  timerInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - callStartMs) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    els.callTimer.textContent = `${mm}:${ss}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

async function startMicCapture() {
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });

  captureCtx = new AudioContext();
  await captureCtx.audioWorklet.addModule('/audio-processor.js');

  const source = captureCtx.createMediaStreamSource(micStream);
  workletNode = new AudioWorkletNode(captureCtx, 'pcm16-downsample-processor');

  // Stream raw 20ms Int16 PCM binary frames and Hybrid VAD speech_end directly to server
  workletNode.port.onmessage = (event) => {
    if (isMuted || !ws || ws.readyState !== WebSocket.OPEN) return;
    const { pcm, rms, vadEvent } = event.data;
    currentMicLevel = rms;
    ws.send(pcm);
    if (vadEvent === 'speech_end') {
      ws.send(JSON.stringify({ type: 'audio_end' }));
    }
  };

  source.connect(workletNode);
  const silentGain = captureCtx.createGain();
  silentGain.gain.value = 0;
  workletNode.connect(silentGain);
  silentGain.connect(captureCtx.destination);
}

function stopMicCapture() {
  if (workletNode) { workletNode.disconnect(); workletNode = null; }
  if (captureCtx) { captureCtx.close().catch(() => {}); captureCtx = null; }
  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  isMuted = false;
  els.btnMute.setAttribute('aria-pressed', 'false');
  els.muteLabel.textContent = 'Mute';
}

async function startBrowserCall() {
  setCallUiState('connecting', 'Connecting to Dhruv...');
  resetLiveView('Live Call');
  player.ensureContext();

  // Open WebSocket and initialize mic in parallel for fastest possible call start
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${wsProto}//${location.host}/ws/browser`);
  socket.binaryType = 'arraybuffer';
  ws = socket;

  let micReady = false;
  const micPromise = startMicCapture()
    .then(() => { micReady = true; })
    .catch((err) => {
      els.callStatusText.textContent = `Mic unavailable (${err.message}). Use quick test buttons or text below.`;
    });

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        type: 'start',
        leadName: els.leadName.value.trim(),
        voiceName: els.voiceSelect.value,
        leadContext: els.leadContext.value.trim(),
      })
    );
  };

  socket.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      player.enqueueArrayBuffer(event.data);
      return;
    }

    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === 'status') {
      const note =
        msg.state === 'connected' && !micReady
          ? 'On air (connecting mic / quick replies ready).'
          : msg.message;
      setCallUiState(msg.state, note);
      if (msg.state === 'connected') startTimer();
      return;
    }

    if (msg.type === 'interrupted') { player.clear(); return; }
    if (msg.type === 'telemetry') { updateTelemetry(msg); return; }
    if (msg.type === 'transcript') { upsertTranscriptBubble(msg); return; }
    if (msg.type === 'outcome' && msg.record) { updateChecklist(msg.record); return; }
    if (msg.type === 'error') { els.callStatusText.textContent = `Error: ${msg.message}`; return; }

    if (msg.type === 'ended') {
      if (msg.record) updateChecklist(msg.record);
      teardownBrowserCall(`Call ended (${msg.reason || 'completed'}). Saved in CRM Logs tab.`);
    }
  };

  socket.onerror = () => teardownBrowserCall('WebSocket error. Verify the local server is running.');
  socket.onclose = () => { if (callActive && ws === socket) teardownBrowserCall('Call disconnected.'); };

  await micPromise;
}

function teardownBrowserCall(message) {
  stopTimer();
  stopMicCapture();
  player.clear();
  if (ws) {
    const oldWs = ws;
    ws = null;
    if (oldWs.readyState === WebSocket.OPEN) oldWs.close();
  }
  setCallUiState('idle', message);
}

function sendTypedReply(text) {
  const clean = String(text || '').trim();
  if (!clean || !ws || ws.readyState !== WebSocket.OPEN) return;
  player.clear();
  ws.send(JSON.stringify({ type: 'text', text: clean }));
}

els.btnStartCall.addEventListener('click', startBrowserCall);

els.btnMute.addEventListener('click', () => {
  isMuted = !isMuted;
  els.btnMute.setAttribute('aria-pressed', String(isMuted));
  els.muteLabel.textContent = isMuted ? 'Unmute' : 'Mute';
  if (isMuted && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'audio_end' }));
  }
});

els.btnEndCall.addEventListener('click', () => {
  // Instant 0ms local hangup: notify server to save recording/CRM in background
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ type: 'hangup' })); } catch {}
  }
  teardownBrowserCall('Call ended. Recording and CRM summary saved in CRM Logs tab.');
});

for (const chip of els.quickChips) {
  chip.addEventListener('click', () => sendTypedReply(chip.dataset.quickText));
}

els.textReplyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendTypedReply(els.textReplyInput.value);
  els.textReplyInput.value = '';
});

// System Prompt editor controls
function updatePromptStats() {
  const text = els.promptEditor.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  els.promptStats.textContent = `${words} words · ${text.length} chars`;
}

function applyPromptBadge(isCustom) {
  els.promptTabTag.textContent = isCustom ? 'Custom' : 'Default';
  setLed(
    els.promptModePill,
    isCustom ? 'Custom Prompt' : 'Default Prompt',
    isCustom ? 'warn' : 'ok'
  );
}

function setPromptMessage(msg, isError = false) {
  els.promptStatusMsg.textContent = msg;
  els.promptStatusMsg.classList.toggle('is-error', isError);
}

async function loadPromptState() {
  try {
    const res = await fetch('/api/prompt');
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load prompt');
    els.promptEditor.value = data.prompt || '';
    updatePromptStats();
    applyPromptBadge(Boolean(data.isCustom));
  } catch (err) {
    setPromptMessage(`Error loading prompt: ${err.message}`, true);
  }
}

els.promptEditor.addEventListener('input', () => {
  updatePromptStats();
  setPromptMessage('Unsaved changes.');
});

els.btnSavePrompt.addEventListener('click', async () => {
  const prompt = els.promptEditor.value.trim();
  if (!prompt) {
    setPromptMessage('System prompt cannot be empty.', true);
    return;
  }
  els.btnSavePrompt.disabled = true;
  try {
    const res = await fetch('/api/prompt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Save failed');
    applyPromptBadge(Boolean(data.isCustom));
    setPromptMessage('Saved. Your custom prompt will be used on the next call.');
  } catch (err) {
    setPromptMessage(`Save error: ${err.message}`, true);
  } finally {
    els.btnSavePrompt.disabled = false;
  }
});

els.btnResetPrompt.addEventListener('click', async () => {
  if (!confirm('Reset system prompt back to the default Divyasree WOW script?')) return;
  els.btnResetPrompt.disabled = true;
  try {
    const res = await fetch('/api/prompt', { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Reset failed');
    els.promptEditor.value = data.prompt || '';
    updatePromptStats();
    applyPromptBadge(false);
    setPromptMessage('Reset to default Divyasree WOW system prompt.');
  } catch (err) {
    setPromptMessage(`Reset error: ${err.message}`, true);
  } finally {
    els.btnResetPrompt.disabled = false;
  }
});

els.btnCopyPrompt.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(els.promptEditor.value);
    els.btnCopyPrompt.textContent = 'Copied!';
    setTimeout(() => { els.btnCopyPrompt.textContent = 'Copy Prompt'; }, 1300);
  } catch {}
});

// Call audio playback deck & Inspector modal
let inspectedLine = '';
let activeDeckLogId = null;

function stopPlaybackDeck() {
  els.deckAudio.pause();
  els.deckAudio.removeAttribute('src');
  els.deckAudio.load();
  els.playbackDeck.classList.remove('is-playing');
  els.playbackDeck.hidden = true;
  activeDeckLogId = null;
}

function playRecordingInDeck(log) {
  if (!log?.recordingUrl) return;
  activeDeckLogId = log.id;
  els.playbackTitle.textContent = `${log.name || 'Unknown'} (${log.leadStatus || 'Cold'}) · ${new Date(
    log.timestamp
  ).toLocaleString()} · ${log.durationSec || 0}s`;
  els.playbackDownload.href = log.recordingUrl;
  els.playbackDownload.download = `${(log.name || 'call').replace(/[^a-z0-9_-]+/gi, '_')}_${log.id}.wav`;
  els.playbackDeck.hidden = false;
  els.deckAudio.src = log.recordingUrl;
  els.deckAudio.play().catch(() => {});
}

els.deckAudio.addEventListener('play', () => els.playbackDeck.classList.add('is-playing'));
els.deckAudio.addEventListener('pause', () => els.playbackDeck.classList.remove('is-playing'));
els.deckAudio.addEventListener('ended', () => els.playbackDeck.classList.remove('is-playing'));
els.btnCloseDeck.addEventListener('click', stopPlaybackDeck);

function openInspector(log) {
  inspectedLine = log.internalLogLine || '';
  els.inspectMeta.textContent = `${new Date(log.timestamp).toLocaleString()} · ${log.durationSec || 0}s`;
  els.inspectTitle.textContent = `${log.name || 'Unknown'} (${log.leadStatus || 'Cold'})`;
  els.inspectPipeLine.textContent = inspectedLine;

  if (log.recordingUrl) {
    els.inspectAudioWell.hidden = false;
    els.inspectAudio.src = log.recordingUrl;
    els.inspectDownload.href = log.recordingUrl;
    els.inspectDownload.download = `${(log.name || 'call').replace(/[^a-z0-9_-]+/gi, '_')}_${log.id}.wav`;
  } else {
    els.inspectAudioWell.hidden = true;
    els.inspectAudio.pause();
    els.inspectAudio.removeAttribute('src');
  }

  els.inspectTranscript.innerHTML = '';
  if (!log.transcript?.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No transcript recorded for this call.';
    els.inspectTranscript.append(empty);
  } else {
    for (const turn of log.transcript) {
      const row = document.createElement('div');
      row.className = `msg-row ${turn.speaker === 'agent' ? 'agent' : 'lead'}`;
      row.style.maxWidth = '100%';

      const bubble = document.createElement('div');
      bubble.className = 'bubble';

      const head = document.createElement('div');
      head.className = 'bubble-head';
      head.textContent = turn.speaker === 'agent' ? 'Dhruv · Divyasree' : log.name || 'Lead';

      const body = document.createElement('div');
      body.textContent = turn.text;

      bubble.append(head, body);
      row.append(bubble);
      els.inspectTranscript.append(row);
    }
  }

  els.inspectDialog.showModal();
}

els.btnInspectCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(inspectedLine);
    els.btnInspectCopy.textContent = 'Copied!';
    setTimeout(() => { els.btnInspectCopy.textContent = 'Copy Log Line'; }, 1400);
  } catch {}
});

function updateKpis(logs) {
  const list = logs || [];
  els.logsTabCount.textContent = String(list.length);
  els.kpiTotal.textContent = String(list.length);
  els.kpiHot.textContent = String(list.filter((l) => l.leadStatus === 'Hot').length);
  els.kpiWarm.textContent = String(list.filter((l) => l.leadStatus === 'Warm').length);
  els.kpiFollowups.textContent = String(
    list.filter((l) => l.followUpTime && l.followUpTime !== 'None' && l.followUpTime !== '-').length
  );
}

function renderLogs(logs) {
  updateKpis(logs);
  els.logsTbody.innerHTML = '';

  if (!logs || logs.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const td = document.createElement('td');
    td.colSpan = 11;
    td.textContent = 'No calls logged yet. Complete a call in Voice Console to save structured Section 9 CRM logs here.';
    tr.append(td);
    els.logsTbody.append(tr);
    return;
  }

  for (const log of logs) {
    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = log.name || 'Unknown';
    tr.append(th);

    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge badge-${log.leadStatus || 'Cold'}`;
    badge.textContent = log.leadStatus || 'Cold';
    tdStatus.append(badge);
    tr.append(tdStatus);

    const addCell = (text, className = '') => {
      const td = document.createElement('td');
      if (className) td.className = className;
      td.textContent = text || '-';
      tr.append(td);
    };

    addCell(log.permission);
    addCell(log.intent);
    addCell(log.locationFit);
    addCell(log.budgetFit);
    addCell(log.timelineComfort);
    addCell(log.language);
    addCell(log.followUpTime);
    addCell(log.notes || '-', 'notes-cell');

    const tdActions = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    if (log.recordingUrl) {
      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'hw-btn hw-btn-call hw-btn-sm';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => playRecordingInDeck(log));
      wrap.append(playBtn);
    }

    const inspectBtn = document.createElement('button');
    inspectBtn.type = 'button';
    inspectBtn.className = 'hw-btn hw-btn-metal hw-btn-sm';
    inspectBtn.textContent = 'Inspect';
    inspectBtn.addEventListener('click', () => openInspector(log));

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'hw-btn hw-btn-metal hw-btn-sm';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(log.internalLogLine || '');
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1300);
      } catch {}
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'hw-btn hw-btn-metal hw-btn-sm';
    delBtn.textContent = '✕';
    delBtn.ariaLabel = `Delete log for ${log.name || 'Unknown'}`;
    delBtn.addEventListener('click', async () => {
      if (activeDeckLogId === log.id) stopPlaybackDeck();
      await fetch(`/api/logs/${encodeURIComponent(log.id)}`, { method: 'DELETE' });
    });

    wrap.append(inspectBtn, copyBtn, delBtn);
    tdActions.append(wrap);
    tr.append(tdActions);
    els.logsTbody.append(tr);
  }
}

els.btnClearLogs.addEventListener('click', async () => {
  if (!confirm('Clear all saved call logs and recordings?')) return;
  stopPlaybackDeck();
  await fetch('/api/logs', { method: 'DELETE' });
});

function connectDashboardEvents() {
  const evtSource = new EventSource('/api/events');
  evtSource.addEventListener('logs', (e) => renderLogs(JSON.parse(e.data).logs));
}

async function bootstrap() {
  initThemeSwitch();
  initTabs();
  initDialog();
  connectDashboardEvents();
  await loadPromptState();

  try {
    const res = await fetch('/api/health');
    const health = await res.json();

    els.voiceSelect.innerHTML = '';
    for (const v of health.availableVoices || []) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.label;
      if (v.id === health.defaultVoiceName) opt.selected = true;
      els.voiceSelect.append(opt);
    }

    if (health.hasGeminiKey) {
      setLed(els.geminiPill, `Gemini · ${health.geminiLiveModel}`, 'ok');
      els.setupBanner.hidden = true;
    } else {
      setLed(els.geminiPill, 'Gemini Key Missing', 'warn');
      els.setupBanner.hidden = false;
    }
  } catch {
    setLed(els.geminiPill, 'Server Offline', 'danger');
  }
}

bootstrap();
