import { VoiceCallSession } from './geminiLive.js';
import { config } from './config.js';

function safeSendJson(ws, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}

export function attachBrowserSocket(ws) {
  let activeSession = null;

  const stopSession = (reason = 'user_hangup') => {
    if (!activeSession) return;
    const sessionToClose = activeSession;
    activeSession = null;
    const record = sessionToClose.finalizeAndClose(reason);
    safeSendJson(ws, { type: 'ended', reason, record });
  };

  ws.on('message', async (rawData, isBinary) => {
    // Hot path: raw binary 16kHz Int16 PCM frames from browser mic
    if (isBinary) {
      if (activeSession) {
        const buf = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);
        activeSession.sendAudioBufferPcm16k(buf);
      }
      return;
    }

    let msg;
    try { msg = JSON.parse(rawData.toString('utf8')); } catch { return; }

    if (msg.type === 'start') {
      if (activeSession) stopSession('restarted');

      const session = new VoiceCallSession({
        leadName: String(msg.leadName || '').trim(),
        voiceName: String(msg.voiceName || config.defaultVoiceName).trim(),
        leadContext: String(msg.leadContext || '').trim(),
        onStatus: (state, message) => safeSendJson(ws, { type: 'status', state, message, callId: session.callId }),
        onAudioBuffer: (pcmBuf) => {
          if (ws.readyState === 1) ws.send(pcmBuf, { binary: true });
        },
        onTranscript: (entry) => safeSendJson(ws, { type: 'transcript', ...entry }),
        onInterrupted: () => safeSendJson(ws, { type: 'interrupted' }),
        onTelemetry: (telemetry) => safeSendJson(ws, { type: 'telemetry', ...telemetry }),
        onOutcomeUpdate: (record) => safeSendJson(ws, { type: 'outcome', record }),
        onHangupRequested: (reason) => stopSession(reason),
        onError: (message) => safeSendJson(ws, { type: 'error', message }),
        onClose: (reason) => {
          if (activeSession === session) stopSession(reason);
        },
      });

      activeSession = session;

      try {
        await session.connect();
      } catch (err) {
        activeSession = null;
        safeSendJson(ws, { type: 'error', message: err.message });
        safeSendJson(ws, { type: 'ended', reason: 'connect_failed', record: null });
      }
      return;
    }

    if (msg.type === 'audio_end' && activeSession) {
      activeSession.sendAudioStreamEnd();
      return;
    }

    if (msg.type === 'text' && activeSession) {
      activeSession.sendUserText(msg.text);
      return;
    }

    if (msg.type === 'hangup') {
      stopSession('user_hangup');
    }
  });

  ws.on('close', () => {
    if (activeSession) {
      const sessionToClose = activeSession;
      activeSession = null;
      sessionToClose.finalizeAndClose('socket_closed');
    }
  });
}
