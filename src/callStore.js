import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { config } from './config.js';

const VALID_STATUSES = new Set(['Hot', 'Warm', 'Cold', 'DNC']);

export class CallStore extends EventEmitter {
  constructor(filePath = config.dataFile, recordingsDir = config.recordingsDir) {
    super();
    this.filePath = filePath;
    this.recordingsDir = recordingsDir;
    this.logs = [];
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        if (Array.isArray(parsed)) this.logs = parsed;
      }
    } catch (err) {
      console.error('[CallStore] Failed to load logs:', err.message);
      this.logs = [];
    }
  }

  _persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.logs, null, 2), 'utf8');
  }

  _deleteRecordingFile(recordingFile) {
    if (!recordingFile) return;
    const fullPath = path.join(this.recordingsDir, path.basename(recordingFile));
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch {}
  }

  normalizeRecord(input = {}) {
    const status = VALID_STATUSES.has(input.leadStatus) ? input.leadStatus : 'Cold';
    const permRaw = String(input.permission || '').trim().toUpperCase();
    const permission = permRaw.startsWith('Y') ? 'Y' : permRaw.startsWith('N') ? 'N' : 'Unknown';
    const recordingFile = input.recordingFile ? path.basename(String(input.recordingFile)) : '';

    const record = {
      id: input.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: input.timestamp || new Date().toISOString(),
      durationSec: Number.isFinite(input.durationSec) ? Math.max(0, Math.round(input.durationSec)) : 0,
      name: String(input.name || 'Unknown').trim() || 'Unknown',
      permission,
      intent: String(input.intent || 'Not captured').trim() || 'Not captured',
      locationFit: String(input.locationFit || 'Not captured').trim() || 'Not captured',
      budgetFit: String(input.budgetFit || 'Not captured').trim() || 'Not captured',
      timelineComfort: String(input.timelineComfort || 'Not captured').trim() || 'Not captured',
      language: String(input.language || 'English').trim() || 'English',
      followUpTime: String(input.followUpTime || 'None').trim() || 'None',
      leadStatus: status,
      notes: String(input.notes || '').trim(),
      recordingFile,
      recordingUrl: recordingFile ? `/api/recordings/${encodeURIComponent(recordingFile)}` : '',
      transcript: Array.isArray(input.transcript) ? input.transcript : [],
    };

    record.internalLogLine = formatSection9Line(record);
    return record;
  }

  upsert(input) {
    const normalized = this.normalizeRecord(input);
    const idx = this.logs.findIndex((item) => item.id === normalized.id);
    if (idx >= 0) {
      this.logs[idx] = { ...this.logs[idx], ...normalized };
      this.logs[idx].internalLogLine = formatSection9Line(this.logs[idx]);
    } else {
      this.logs.unshift(normalized);
    }
    this._persist();
    this.emit('updated', this.list());
    return idx >= 0 ? this.logs[idx] : normalized;
  }

  list() {
    return this.logs;
  }

  remove(id) {
    const target = this.logs.find((item) => item.id === id);
    if (!target) return false;
    this._deleteRecordingFile(target.recordingFile);
    this.logs = this.logs.filter((item) => item.id !== id);
    this._persist();
    this.emit('updated', this.list());
    return true;
  }

  clear() {
    for (const item of this.logs) this._deleteRecordingFile(item.recordingFile);
    this.logs = [];
    this._persist();
    this.emit('updated', this.list());
  }

  toCsv() {
    const headers = [
      'Timestamp', 'Duration (s)', 'Name', 'Permission',
      'Intent', 'Location fit', 'Budget fit', 'Timeline comfort',
      'Language', 'Follow-up time', 'Lead status', 'Notes', 'Recording',
    ];
    const escapeCsv = (val) => {
      const str = String(val ?? '');
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const rows = this.logs.map((r) =>
      [
        r.timestamp, r.durationSec, r.name, r.permission,
        r.intent, r.locationFit, r.budgetFit, r.timelineComfort,
        r.language, r.followUpTime, r.leadStatus, r.notes, r.recordingUrl || '',
      ]
        .map(escapeCsv)
        .join(',')
    );
    return [headers.join(','), ...rows].join('\r\n');
  }
}

// Section 9 pipe-delimited CRM log format
export function formatSection9Line(r) {
  return [
    r.name, r.permission, r.intent, r.locationFit, r.budgetFit,
    r.timelineComfort, r.language, r.followUpTime, r.leadStatus, r.notes || '-',
  ].join(' | ');
}

export const callStore = new CallStore();
