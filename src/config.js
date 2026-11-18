import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Always load .env from project root regardless of process cwd
dotenv.config({ path: path.join(rootDir, '.env') });

export const AVAILABLE_VOICES = [
  { id: 'Charon', label: 'Charon (Calm & Informative - Recommended)' },
  { id: 'Orus', label: 'Orus (Firm & Executive)' },
  { id: 'Sadaltager', label: 'Sadaltager (Knowledgeable & Poised)' },
  { id: 'Achird', label: 'Achird (Warm & Friendly)' },
  { id: 'Puck', label: 'Puck (Upbeat & Conversational)' },
  { id: 'Sulafat', label: 'Sulafat (Warm & Reassuring)' },
  { id: 'Kore', label: 'Kore (Clear & Composed)' },
];

export const config = {
  port: Number(process.env.PORT || 3000),
  rootDir,
  dataFile: path.join(rootDir, 'data', 'call-logs.json'),
  promptFile: path.join(rootDir, 'data', 'custom-prompt.txt'),
  recordingsDir: path.join(rootDir, 'data', 'recordings'),

  geminiApiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim(),
  geminiLiveModel: (process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live').trim(),
  geminiSummaryModel: (process.env.GEMINI_SUMMARY_MODEL || 'gemini-3.5-flash-lite').trim(),
  defaultVoiceName: (process.env.DEFAULT_VOICE_NAME || 'Charon').trim(),
};

export function getHealthStatus() {
  const hasGeminiKey =
    Boolean(config.geminiApiKey) &&
    config.geminiApiKey !== 'your_gemini_api_key_here';

  return {
    ok: true,
    hasGeminiKey,
    geminiLiveModel: config.geminiLiveModel,
    defaultVoiceName: config.defaultVoiceName,
    availableVoices: AVAILABLE_VOICES,
  };
}
