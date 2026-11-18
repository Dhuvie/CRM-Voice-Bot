import path from 'node:path';
import {
  ActivityHandling,
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity,
} from '@google/genai';
import { config } from './config.js';
import { buildSystemPrompt } from './prompt.js';
import { callStore } from './callStore.js';
import { CallRecorder } from './callRecorder.js';

let sharedAiClient = null;
function getAiClient() {
  if (!config.geminiApiKey || config.geminiApiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'GEMINI_API_KEY is missing. Add your free Google AI Studio key in .env and restart the server.'
    );
  }
  if (!sharedAiClient) {
    sharedAiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return sharedAiClient;
}

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const HINGLISH_RE = /\b(hindi|namaste|haan|nahi|nahin|kya|aap|aapke|bol|raha|kitna|theek|thik|chahiye|baat|samajh|dhanyavaad|rupaye|laakh|crore)\b/i;
const GOODBYE_RE = /(have a wonderful day|have a good day|aapka din shubh ho|not contacted again)/i;

function detectStageAndLanguage(transcript) {
  let step = 1;
  let language = 'English';
  const combined = transcript.map((t) => t.text).join(' ');

  if (DEVANAGARI_RE.test(combined) || HINGLISH_RE.test(combined)) {
    language = DEVANAGARI_RE.test(combined) ? 'Hindi' : 'Hinglish';
  }

  const agentText = transcript
    .filter((t) => t.speaker === 'agent')
    .map((t) => t.text)
    .join(' ')
    .toLowerCase();

  if (/(property expert|walkthrough|site visit|follow-up|follow up|tomorrow|weekend|callback|call back)/i.test(agentText)) {
    step = 4;
  } else if (/(seventy-four|74%|clubhouse|eco-parks|misty hill|private valley where)/i.test(agentText)) {
    step = 3;
  } else if (/(weekend home|investment|nandi valley|devanahalli|ninety-two|92\.4|two point four|2\.46|twenty twenty-nine|2029|bayaanve|budget)/i.test(agentText)) {
    step = 2;
  }

  return { step, language };
}

// Local transcript parser used immediately and as fallback if summary API is busy
export function extractLocalSummary(transcript, fallbackName = 'Unknown') {
  const leadTurns = transcript.filter((t) => t.speaker === 'lead').map((t) => t.text);
  const allText = transcript.map((t) => t.text).join(' ');
  const leadText = leadTurns.join(' ');
  const { language } = detectStageAndLanguage(transcript);

  let permission = 'Unknown';
  if (/(not interested|remove my number|busy right now|don'?t call|mat karo|call later)/i.test(leadText)) {
    permission = 'N';
  } else if (leadTurns.length >= 2 || /\b(yes|yeah|sure|go ahead|ok|okay|haan|han|ji|bolo|bataiye|tell me)\b/i.test(leadText)) {
    permission = 'Y';
  }

  let intent = 'Not captured';
  const hasSelf = /(weekend|self[- ]?use|family|own use|personal|khud|rehne|retreat)/i.test(leadText);
  const hasInv = /(invest|investment|return|appreciation|resale|nivesh)/i.test(leadText);
  if (hasSelf && hasInv) intent = 'Both';
  else if (hasSelf) intent = 'Weekend home';
  else if (hasInv) intent = 'Investment';

  const checkAnswerAfterPrompt = (agentRegex) => {
    for (let i = 0; i < transcript.length - 1; i++) {
      if (transcript[i].speaker === 'agent' && agentRegex.test(transcript[i].text)) {
        const reply = transcript[i + 1]?.speaker === 'lead' ? transcript[i + 1].text : '';
        if (/\b(no|not really|too far|expensive|high|long|nahi|nahin|mushkil|zyada|dur)\b/i.test(reply)) return 'No';
        if (/\b(yes|yeah|sure|fine|good|works|comfortable|fits|ok|okay|haan|han|ji|theek|thik|chalega|sahi)\b/i.test(reply)) return 'Yes';
      }
    }
    return 'Not captured';
  };

  const locationFit = checkAnswerAfterPrompt(/(nandi|devanahalli|location|corridor)/i);
  const budgetFit = checkAnswerAfterPrompt(/(ninety-two|92\.4|crore|laak|laakh|budget|bayaanve|price)/i);
  const timelineRaw = checkAnswerAfterPrompt(/(2029|twenty twenty-nine|timeline|possession|phased|untees)/i);
  const timelineComfort =
    timelineRaw === 'Yes' ? 'Comfortable' : timelineRaw === 'No' ? 'Concerned' : 'Not captured';

  let followUpTime = 'None';
  const timeMatch = allText.match(
    /\b((?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|this weekend|next week|kal|parso)[^.?!\n]{0,30}(?:\d{1,2}\s?(?:am|pm)|morning|afternoon|evening|subah|shaam)?|\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/i
  );
  if (timeMatch && /(follow|expert|call|schedule|walkthrough|connect|baat|baje)/i.test(allText)) {
    followUpTime = timeMatch[1].trim();
  }

  let leadStatus = 'Cold';
  if (/(remove my number|do not call|don'?t call|not interested|mat call)/i.test(leadText)) {
    leadStatus = 'DNC';
  } else if (followUpTime !== 'None' || (budgetFit === 'Yes' && locationFit === 'Yes')) {
    leadStatus = 'Hot';
  } else if (permission === 'Y' && (intent !== 'Not captured' || locationFit === 'Yes' || budgetFit === 'Yes')) {
    leadStatus = 'Warm';
  }

  return {
    name: fallbackName || 'Unknown',
    permission,
    intent,
    locationFit,
    budgetFit,
    timelineComfort,
    language,
    followUpTime,
    leadStatus,
    notes: leadTurns.length ? `Captured ${leadTurns.length} lead replies` : 'No lead reply captured',
  };
}

export class VoiceCallSession {
  constructor({
    callId,
    leadName = '',
    voiceName = config.defaultVoiceName,
    leadContext = '',
    onAudioBuffer = () => {},
    onTranscript = () => {},
    onInterrupted = () => {},
    onOutcomeUpdate = () => {},
    onTelemetry = () => {},
    onHangupRequested = () => {},
    onStatus = () => {},
    onError = () => {},
    onClose = () => {},
  }) {
    this.callId = callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.leadName = String(leadName || '').trim();
    this.voiceName = voiceName || config.defaultVoiceName;
    this.leadContext = leadContext;

    this.callbacks = {
      onAudioBuffer,
      onTranscript,
      onInterrupted,
      onOutcomeUpdate,
      onTelemetry,
      onHangupRequested,
      onStatus,
      onError,
      onClose,
    };

    this.ai = null;
    this.session = null;
    this.startedAt = Date.now();
    this.recorder = new CallRecorder(this.startedAt);
    this.closed = false;
    this.finalizing = false;
    this.hangupTriggered = false;

    this.lastLeadActivityAt = null;
    this.awaitingAgentFirstAudio = false;
    this.lastLatencyMs = null;

    this.transcript = [];
    this.activeTurns = { agent: null, lead: null };
    this.turnCounter = 0;

    this.outcome = {
      id: this.callId,
      name: this.leadName || 'Unknown',
      permission: 'Unknown',
      intent: 'Not captured',
      locationFit: 'Not captured',
      budgetFit: 'Not captured',
      timelineComfort: 'Not captured',
      language: 'English',
      followUpTime: 'None',
      leadStatus: 'Cold',
      notes: '',
    };
  }

  async connect() {
    this.ai = getAiClient();
    const systemPrompt = buildSystemPrompt({
      leadName: this.leadName,
      leadContext: this.leadContext,
    });

    this.callbacks.onStatus('connecting', 'Connecting to Gemini 3.8 Live...');

    // Pure native audio session with ultra-snappy VAD (180ms silence, 60ms prefix)
    this.session = await this.ai.live.connect({
      model: config.geminiLiveModel,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: this.voiceName },
          },
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            prefixPaddingMs: 60,
            silenceDurationMs: 180,
          },
          activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          this.callbacks.onStatus('connected', 'Connected. Dhruv is speaking...');
        },
        onmessage: (message) => this._handleServerMessage(message),
        onerror: (err) => {
          const msg = err?.message || err?.error?.message || 'Gemini Live connection error';
          console.error(`[VoiceCallSession ${this.callId}] Live error:`, msg);
          this.callbacks.onError(msg);
        },
        onclose: (event) => {
          const reason = event?.reason || 'Session closed';
          if (!this.closed) {
            this.closed = true;
            this.callbacks.onClose(reason);
          }
        },
      },
    });

    // Trigger Step 1 immediately via sendRealtimeInput (no setup timer delay)
    if (!this.closed && this.session) {
      this.lastLeadActivityAt = Date.now();
      this.awaitingAgentFirstAudio = true;
      try {
        this.session.sendRealtimeInput({ text: 'Hello?' });
      } catch (err) {
        console.error(`[VoiceCallSession ${this.callId}] Kickoff failed:`, err.message);
      }
    }
  }

  _emitTelemetry() {
    const { step, language } = detectStageAndLanguage(this.transcript);
    this.outcome.language = language;
    this.callbacks.onTelemetry({ step, language, latencyMs: this.lastLatencyMs });
  }

  _handleServerMessage(message) {
    if (!message) return;

    const content = message.serverContent;
    if (!content) return;

    if (content.interrupted === true) {
      this._finalizeSpeakerTurn('agent');
      this.awaitingAgentFirstAudio = false;
      this.recorder.markAgentInterrupted();
      this.callbacks.onInterrupted();
    }

    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        const b64 = part.inlineData?.data;
        if (!b64) continue;
        if (this.awaitingAgentFirstAudio && this.lastLeadActivityAt) {
          this.lastLatencyMs = Math.max(30, Date.now() - this.lastLeadActivityAt);
          this.awaitingAgentFirstAudio = false;
          this._emitTelemetry();
        }
        const pcmBuf = Buffer.from(b64, 'base64');
        this.recorder.addAgentPcm24k(pcmBuf);
        this.callbacks.onAudioBuffer(pcmBuf);
      }
    }

    if (content.inputTranscription?.text) {
      this.lastLeadActivityAt = Date.now();
      this.awaitingAgentFirstAudio = true;
      this._appendTranscript('lead', content.inputTranscription.text);
      this._emitTelemetry();
    }

    if (content.outputTranscription?.text) {
      this._appendTranscript('agent', content.outputTranscription.text);
      this._emitTelemetry();
    }

    if (content.turnComplete) {
      const lastAgentText = this.activeTurns.agent?.text || '';
      this._finalizeSpeakerTurn('lead');
      this._finalizeSpeakerTurn('agent');

      if (!this.hangupTriggered && this.transcript.length >= 2 && GOODBYE_RE.test(lastAgentText)) {
        this.hangupTriggered = true;
        setTimeout(() => this.callbacks.onHangupRequested('completed'), 1100);
      }
    }
  }

  _appendTranscript(speaker, delta) {
    const text = String(delta || '');
    if (!text) return;

    this._finalizeSpeakerTurn(speaker === 'agent' ? 'lead' : 'agent');

    if (!this.activeTurns[speaker]) {
      this.turnCounter += 1;
      const entry = {
        turnId: `${this.callId}_t${this.turnCounter}`,
        speaker,
        text,
        timestamp: new Date().toISOString(),
      };
      this.activeTurns[speaker] = entry;
      this.transcript.push(entry);
    } else {
      this.activeTurns[speaker].text += text;
    }

    const current = this.activeTurns[speaker];
    this.callbacks.onTranscript({
      turnId: current.turnId,
      speaker,
      text: current.text.trim(),
      isFinal: false,
    });
  }

  _finalizeSpeakerTurn(speaker) {
    const active = this.activeTurns[speaker];
    if (!active) return;
    active.text = active.text.trim();
    this.activeTurns[speaker] = null;
    if (active.text) {
      this.callbacks.onTranscript({
        turnId: active.turnId,
        speaker,
        text: active.text,
        isFinal: true,
      });
    }
  }

  sendAudioBufferPcm16k(buffer) {
    if (!this.session || this.closed || !buffer?.length) return;
    this.recorder.addLeadPcm16k(buffer);
    try {
      this.session.sendRealtimeInput({
        audio: { data: buffer.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
      });
    } catch (err) {
      console.error(`[VoiceCallSession ${this.callId}] sendAudio error:`, err.message);
    }
  }

  sendAudioStreamEnd() {
    if (!this.session || this.closed) return;
    this.lastLeadActivityAt = Date.now();
    this.awaitingAgentFirstAudio = true;
    try {
      this.session.sendRealtimeInput({ audioStreamEnd: true });
    } catch {}
  }

  sendUserText(text) {
    const clean = String(text || '').trim();
    if (!clean || !this.session || this.closed) return;
    this._finalizeSpeakerTurn('agent');
    this.turnCounter += 1;
    const entry = {
      turnId: `${this.callId}_t${this.turnCounter}`,
      speaker: 'lead',
      text: clean,
      timestamp: new Date().toISOString(),
    };
    this.transcript.push(entry);
    this.callbacks.onTranscript({ turnId: entry.turnId, speaker: 'lead', text: clean, isFinal: true });
    this.lastLeadActivityAt = Date.now();
    this.awaitingAgentFirstAudio = true;
    this._emitTelemetry();

    try {
      this.session.sendRealtimeInput({ text: clean });
    } catch (err) {
      console.error(`[VoiceCallSession ${this.callId}] sendUserText error:`, err.message);
    }
  }

  // Closes immediately (<5ms) and runs LLM CRM extraction asynchronously in background
  finalizeAndClose(reason = 'ended') {
    if (this.finalizing) return null;
    this.finalizing = true;
    this.closed = true;

    this._finalizeSpeakerTurn('lead');
    this._finalizeSpeakerTurn('agent');

    if (this.session) {
      try { this.session.close(); } catch {}
      this.session = null;
    }

    const durationSec = Math.round((Date.now() - this.startedAt) / 1000);
    const hasConversation = this.transcript.some((t) => t.text && t.text.trim().length > 0);
    const hasAudio = this.recorder.hasAudio();
    if (!hasConversation && !hasAudio) return null;

    if (hasAudio) {
      const safeId = this.callId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const recordingFile = `${safeId}.wav`;
      const recordingPath = path.join(config.recordingsDir, recordingFile);
      try {
        if (this.recorder.saveToFile(recordingPath)) {
          this.outcome.recordingFile = recordingFile;
        }
      } catch (err) {
        console.warn(`[VoiceCallSession ${this.callId}] Recording save failed:`, err.message);
      }
    }

    this.outcome.durationSec = durationSec;
    this.outcome.transcript = this.transcript;

    // Immediately populate fields with fast local heuristic parser so nothing shows "Summarizing..."
    if (hasConversation) {
      this.outcome = {
        ...this.outcome,
        ...extractLocalSummary(this.transcript, this.outcome.name),
        durationSec,
        transcript: this.transcript,
      };
    } else if (!this.outcome.notes) {
      this.outcome.notes = `Call ended (${reason})`;
    }

    const initialSaved = callStore.upsert(this.outcome);
    this.callbacks.onOutcomeUpdate(initialSaved);

    // Refine with Gemini in background without blocking hangup
    if (hasConversation) {
      this._extractCrmSummary()
        .then((extracted) => {
          if (!extracted) return;
          const updated = callStore.upsert({
            ...this.outcome,
            ...extracted,
            durationSec,
            transcript: this.transcript,
          });
          this.callbacks.onOutcomeUpdate(updated);
        })
        .catch((err) => {
          console.warn(`[VoiceCallSession ${this.callId}] Background CRM refinement skipped:`, err.message);
        });
    }

    return initialSaved;
  }

  async _extractCrmSummary() {
    if (!this.ai || !this.transcript.length) return null;

    const transcriptText = this.transcript
      .map((t) => `${t.speaker === 'agent' ? 'Dhruv' : this.leadName || 'Lead'}: ${t.text}`)
      .join('\n');

    const prompt = `Extract the Section 9 CRM log for this Divyasree "Whispers of the Wind" call.
Lead name provided: "${this.leadName || 'Unknown'}".

Transcript:
${transcriptText}

Return ONLY valid JSON with these exact keys:
{
  "name": "string",
  "permission": "Y | N | Unknown",
  "intent": "Weekend home | Investment | Both | Not captured",
  "locationFit": "Yes | No | Unsure | Not captured",
  "budgetFit": "Yes | No | Stretch | Unsure | Not captured",
  "timelineComfort": "Comfortable | Concerned | Unsure | Not captured",
  "language": "English | Hindi | Hinglish",
  "followUpTime": "booked day/time or callback time or None",
  "leadStatus": "Hot | Warm | Cold | DNC",
  "notes": "brief factual summary of objections, expert questions, or outcome"
}`;

    // Prefer gemini-3.5-flash-lite first (fast, reliable), then fall back
    const candidateModels = [
      ...new Set(['gemini-3.5-flash-lite', config.geminiSummaryModel, 'gemini-3.5-flash', 'gemini-3.8-flash']),
    ];
    let rawText = null;
    for (const model of candidateModels) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0.1 },
        });
        if (response?.text) {
          rawText = response.text;
          break;
        }
      } catch (err) {
        console.warn(`[VoiceCallSession ${this.callId}] Summary model ${model} failed:`, err.message);
      }
    }

    if (!rawText) return null;
    const parsed = JSON.parse(rawText);
    return {
      name: parsed.name || this.outcome.name,
      permission: parsed.permission || 'Unknown',
      intent: parsed.intent || 'Not captured',
      locationFit: parsed.locationFit || 'Not captured',
      budgetFit: parsed.budgetFit || 'Not captured',
      timelineComfort: parsed.timelineComfort || 'Not captured',
      language: parsed.language || 'English',
      followUpTime: parsed.followUpTime || 'None',
      leadStatus: parsed.leadStatus || 'Cold',
      notes: parsed.notes || '',
    };
  }
}
