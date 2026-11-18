<p align="center">
  <img src="public/logo.svg" alt="Divyasree Whispers of the Wind Outbound AI Voice Agent" width="640">
</p>

# Divyasree "Whispers of the Wind" Outbound AI Voice Agent

An outbound real-time bilingual (English, Hindi, and Hinglish) AI voice consultant built for **Divyasree Developers** to qualify high-intent leads for **Whispers of the Wind (WOW)**, a luxury Private Valley villa plot development near Nandi Hills, North Bengaluru.

The agent (**Dhruv**, Senior Property Consultant) conducts natural 2 to 3 minute qualification conversations over native speech-to-speech audio using the **Gemini 3.8 Live API** (`gemini-3.8-live`), records every two-way conversation as a playable 16 kHz WAV file, and generates structured CRM qualification logs automatically after each call.

---

## Table of Contents

1. [Project Context](#project-context)
2. [Conversation Architecture](#conversation-architecture)
3. [Pronunciation Standard](#pronunciation-standard)
4. [System Architecture and Low-Latency Design](#system-architecture-and-low-latency-design)
5. [Console Features](#console-features)
6. [Quick Start](#quick-start)
7. [API Reference](#api-reference)
8. [Project Structure](#project-structure)
9. [Deliverables](#deliverables)
10. [Testing](#testing)

---

## Project Context

Every factual statement made by Dhruv is strictly bounded to the verified project dossier below. For questions outside this scope (RERA registration number, payment plans, approvals, exact distances, or custom offers), the agent never fabricates details and defers to a follow-up call with a Property Expert.

| Attribute | Verified Project Fact |
| :--- | :--- |
| Project | Whispers of the Wind (WOW) by Divyasree Developers |
| Product | Premium "Private Valley" villa plots, 1,200 to 3,199 sq.ft. |
| Location | Nandi Valley, near Nandi Hills, North Bengaluru (Devanahalli corridor) |
| Key Highlights | 74% open spaces, 20,000 sq.ft. clubhouse, eco-parks, scenic hill views |
| Pricing | Rs. 92.4 lakh to Rs. 2.46 Cr (inclusive of all taxes) |
| Possession Timeline | December 2029 (ongoing project, phased delivery) |
| Target Buyers | HNIs, CXOs, and NRIs seeking luxury weekend homes or long-term investments |

---

## Conversation Architecture

Dhruv follows a disciplined four-stage consultative structure designed to stay calm, non-intrusive, and concise (1 to 2 short sentences per turn):

1. **Step 1: Introduction and Permission (Mandatory)**
   Greets the lead by name, introduces himself as Dhruv, Senior Property Consultant from Divyasree Developers, states the project and Nandi Valley location, and explicitly asks for two minutes to speak. Never pitches without permission; if the lead is busy, captures a callback time and closes politely.
2. **Step 2: Qualification (The 4 Checkpoints)**
   Evaluates four criteria conversationally, one question at a time, automatically skipping any checkpoint the lead volunteered earlier:
   - **Intent**: Weekend home (self-use) vs. long-term investment.
   - **Geography**: Comfort with Nandi Valley / Nandi Hills / Devanahalli corridor in North Bengaluru.
   - **Budget**: Fitment for the Rs. 92.4 lakh to Rs. 2.46 Cr all-inclusive range.
   - **Timeline**: Comfort with ongoing status and December 2029 phased possession.
3. **Step 3: Tailored Private Valley Pitch**
   Delivers a concise 3 to 4 sentence sensory pitch highlighting misty hill views, 74% open space, eco-parks, the 20,000 sq.ft. clubhouse, and customizable 1,200 to 3,199 sq.ft. plots. Adapts emphasis to either family wellness and retreat (self-use) or North Bengaluru corridor scarcity and long-term value (investment, without quoting or guaranteeing returns).
4. **Step 4: Call to Action (CTA)**
   Proposes a walkthrough call with a Divyasree Property Expert (covering plot options, detailed pricing, and a site visit), confirms preferred day, time, and language, and closes warmly.

### Edge-Case and Multilingual Handling

- **Instant English / Hindi / Hinglish Switching**: Starts in English and switches immediately into polite Hindi ("aap", "ji") or Hinglish the moment the caller replies in Hindi, without hesitation or meta-commentary.
- **Objections and Guardrails**: Handles rushed leads (offers a 30-second summary or callback), Do Not Contact requests (immediate respectful exit), location or budget mismatches (gentle consultative reframing without pressure), timeline concerns (early-entry phased delivery framing), bot transparency ("I am an AI assistant from Divyasree Developers"), silence/unclear audio, and wrong numbers.

---

## Pronunciation Standard

To enforce accurate Indian English and Hindi phonology in real-time audio synthesis, the system prompt writes all numbers in spoken words and anchors proper nouns with both syllable phonetics and Devanagari script:

| Term | Enforced Spoken Pronunciation | Devanagari Anchor | Rule |
| :--- | :--- | :--- | :--- |
| Divyasree | Div-yaa-shree | दिव्यश्री | Soft "sh", long "aa"; never hard "s" |
| Nandi / Nandi Hills | Nun-dhee / Nun-dhee Hills | नंदी हिल्स | "Nun" rhyming with "sun", soft dental "dh" |
| Devanahalli | Day-vuh-nuh-hull-ee | देवनहल्ली | Five smooth syllables |
| Bengaluru | Ben-guh-loo-roo | बेंगलुरु | Never "Bangalore" |
| Dhruv | Dhruv | ध्रुव | Soft dental "dh", short "u", crisp "v" |
| Lakh | Laak / Laakh | लाख | Rhymes with "dark"; never "lack" |
| Crore / Cr | Crore | करोड़ | Rhymes with "more"; never spell "C-R" |
| Rs. 92.4 lakh | ninety-two point four laak rupees | बयानवे पॉइंट चार लाख रुपये | Always spoken in words |
| Rs. 2.46 Cr | two point four six crore rupees | दो पॉइंट चार छह करोड़ रुपये | Always spoken in words |
| sq.ft. | square feet / square foot | - | Never spell "S-Q-F-T" |
| HNI / CXO / NRI | H-N-I, C-X-O, N-R-I | - | Always spell letter by letter |
| WOW | wow | - | Pronounce as one word, never W-O-W |

---

## System Architecture and Low-Latency Design

```text
Browser Microphone (48/44.1 kHz)
  |
  v  AudioWorklet (public/audio-processor.js: 20 ms / 320-sample 16 kHz Int16 PCM)
  |
  v  Raw Binary WebSocket Frame (perMessageDeflate: false, TCP_NODELAY)
  |
Node.js Server (src/server.js -> src/browserBridge.js -> src/geminiLive.js)
  |                                              |
  |---> Gemini 3.8 Live WebSocket                |---> CallRecorder (src/callRecorder.js)
  |     (VAD: 260 ms silence, 80 ms prefix,      |     Mixes Lead 16 kHz + Agent 24->16 kHz
  |      HIGH start/end sensitivity,             |     Truncates agent audio on barge-in
  |      zero live tool schemas)                 |     Saves data/recordings/<callId>.wav
  |                                              |
  |<--- 24 kHz Int16 PCM + Live Transcripts      |
  |                                              v
  v  Raw Binary WebSocket Frame              Post-Call CRM Extraction (gemini-3.8-flash)
  |                                          Writes Section 9 record to data/call-logs.json
Browser Web Audio API (24 kHz gapless queue, 2 ms lead-in, instant clear on barge-in)
```

### Latency Optimizations

- **20 ms AudioWorklet Capture**: Downsamples browser microphone audio on the audio thread into 20 ms (320-sample) 16 kHz PCM frames.
- **Zero-Copy Binary WebSockets**: Streams raw binary PCM between browser and Node.js in both directions, eliminating JSON wrapping and base64 conversion on the browser hot path.
- **Socket Tuning**: Disables WebSocket per-message deflate and enables `socket.setNoDelay(true)` so small 20 ms frames flush immediately.
- **Tuned Server VAD**: Configures `START_SENSITIVITY_HIGH`, `END_SENSITIVITY_HIGH`, `prefixPaddingMs: 80`, and `silenceDurationMs: 260` for rapid turn detection during English and Hindi code-switching.
- **Tool-Free Live Audio Loop**: Keeps tool schemas off the live audio session so Gemini 3.8 Live emits speech with minimal overhead; structured CRM extraction runs post-call via `gemini-3.8-flash`.

---

## Console Features

The web interface uses a unified tactile skeuomorphic hardware console design with **Light Mode (default)** and **Dark Mode**, organized into three top-level tabs:

1. **Voice Console**
   - Lead Name, Voice selector (7 Gemini studio voices, defaulting to `Charon`), and optional internal CRM context.
   - Recessed smoked-glass LCD readout with live status (`STANDBY` / `ON AIR`), active language (`EN` / `HI` / `HI/EN`), turn response latency (`ms`), call timer, and a real-time analog needle VU meter with a 12-segment LED peak strip.
   - Physical push-buttons for Start Call, Mute, and End Call, plus one-click Live Test Presets (Switch to Hindi, Pronunciation Test, RERA Fallback, Book Follow-up) and a typed-reply fallback bar.
   - Real-time 4-step script progress LED bar, 6 qualification gauges, and streaming dual-speaker transcript.
2. **CRM Logs**
   - Campaign KPI counters (Total Calls, Hot Leads, Warm Leads, Follow-ups Booked).
   - Persistent Section 9 qualification table (`Name | Permission | Intent | Location fit | Budget fit | Timeline comfort | Language | Follow-up time | Lead status | Notes`) with CSV export and one-click pipe-format copy.
   - **Call Recording Playback Deck**: Click **Play** on any recorded call to listen directly in the recessed playback deck or download the `.wav` file. Click **Inspect** to review the full transcript alongside the embedded audio player.
3. **System Prompt**
   - Full in-browser editor to inspect, customize, save (`data/custom-prompt.txt`), copy, or reset the active system prompt. Supports `{{LEAD_NAME}}` interpolation and takes effect immediately on the next call.

---

## Quick Start

### Prerequisites

- Node.js 20 or newer (tested on Node.js 24)
- A free Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- Chrome or Edge browser with headphones (recommended to prevent speaker echo from triggering barge-in)

### Installation and Run

1. Install dependencies:
   ```powershell
   npm install
   ```
2. Create `.env` from `.env.example` and add your API key:
   ```powershell
   Copy-Item .env.example .env
   ```
   Edit `.env`:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   GEMINI_LIVE_MODEL=gemini-3.8-live
   GEMINI_SUMMARY_MODEL=gemini-3.5-flash-lite
   DEFAULT_VOICE_NAME=Charon
   PORT=3000
   ```
3. Start the server:
   ```powershell
   npm start
   ```
4. Open `http://localhost:3000` in your browser, enter a lead name, and click **Start Call**.

---

## API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Server health, API key status, active model, and available voices |
| `GET` | `/api/prompt` | Returns active system prompt, default template, and custom status |
| `PUT` | `/api/prompt` | Saves a custom system prompt (`{ "prompt": "..." }`) |
| `DELETE` | `/api/prompt` | Resets system prompt back to default |
| `GET` | `/api/logs` | Lists all persisted Section 9 CRM call logs |
| `GET` | `/api/logs/export.csv` | Downloads all CRM logs as a CSV file |
| `DELETE` | `/api/logs/:id` | Deletes a single call log and its `.wav` recording |
| `DELETE` | `/api/logs` | Clears all call logs and `.wav` recordings |
| `GET` | `/api/recordings/:filename` | Streams a recorded 16 kHz WAV call with HTTP Range (`206`) seeking |
| `GET` | `/api/events` | Server-Sent Events stream for real-time CRM log updates |
| `WS` | `/ws/browser` | Bidirectional audio (binary PCM) and control (JSON) WebSocket |

---

## Project Structure

```text
voice bot/
|-- public/
|   |-- logo.svg                Brand SVG emblem used in documentation and PDF
|   |-- index.html              Three-tab skeuomorphic hardware console markup
|   |-- styles.css              Skeuomorphic Light (default) and Dark theme styles
|   |-- app.js                  Binary WebSocket audio client, VU meter, tabs, CRM UI
|   |-- audio-processor.js      20 ms AudioWorklet 16 kHz PCM downsampler
|-- src/
|   |-- server.js               Express HTTP server, SSE stream, binary WS upgrade
|   |-- config.js               Root-anchored .env loader and runtime configuration
|   |-- prompt.js               Divyasree WOW prompt builder and custom prompt store
|   |-- geminiLive.js           Gemini 3.8 Live session manager and post-call CRM extractor
|   |-- browserBridge.js        Browser WebSocket bridge for binary audio and events
|   |-- callRecorder.js         Two-way 16 kHz WAV mixer with barge-in truncation
|   |-- callStore.js            Section 9 JSON persistence, CSV export, recording cleanup
|-- tests/
|   |-- core.test.js            Unit tests for prompt, custom store, CRM logs, WAV recorder
|-- data/                       Runtime JSON logs, custom prompt, and WAV recordings
|-- Divyasree_WOW_System_Prompt.pdf   Deliverable System Prompt and Pronunciation Guide PDF
|-- .env.example                Environment template
|-- package.json                Project manifest and scripts
```

---

## Deliverables

- **System Prompt (PDF)**: Included in the repository root as [`Divyasree_WOW_System_Prompt.pdf`](Divyasree_WOW_System_Prompt.pdf), containing strictly the complete verbatim System Prompt used to configure Dhruv, including the embedded phonetic and Devanagari pronunciation guide.
- **Recorded Test Calls**: Every completed test call is automatically saved as a 16 kHz WAV recording inside `data/recordings/` and can be played or downloaded directly from the **CRM Logs** tab for sharing.

---

## Testing

Run the automated test suite using Node's built-in test runner:

```powershell
npm test
```

Tests cover prompt identity and pronunciation rules, custom prompt persistence and `{{LEAD_NAME}}` interpolation, Section 9 CRM log formatting and CSV escaping, 24 kHz to 16 kHz resampling, two-way WAV mixing, barge-in truncation, and recording cleanup on deletion.
