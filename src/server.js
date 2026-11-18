import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { config, getHealthStatus } from './config.js';
import { callStore } from './callStore.js';
import { getPromptState, resetCustomPrompt, saveCustomPrompt } from './prompt.js';
import { attachBrowserSocket } from './browserBridge.js';

const app = express();

app.use(express.json());
app.use(express.static(path.join(config.rootDir, 'public')));

app.get('/api/health', (_req, res) => {
  res.json(getHealthStatus());
});

app.get('/api/prompt', (_req, res) => {
  res.json({ ok: true, ...getPromptState() });
});

app.put('/api/prompt', (req, res) => {
  try {
    res.json({ ok: true, ...saveCustomPrompt(req.body?.prompt) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/prompt', (_req, res) => {
  res.json({ ok: true, ...resetCustomPrompt() });
});

app.get('/api/logs', (_req, res) => {
  res.json({ logs: callStore.list() });
});

app.get('/api/logs/export.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="divyasree-wow-call-logs.csv"');
  res.send(callStore.toCsv());
});

app.delete('/api/logs/:id', (req, res) => {
  res.json({ ok: callStore.remove(req.params.id) });
});

app.delete('/api/logs', (_req, res) => {
  callStore.clear();
  res.json({ ok: true });
});

// Serves recorded WAV call audio with HTTP byte-range seeking support
app.get('/api/recordings/:filename', (req, res) => {
  const safeName = path.basename(String(req.params.filename || ''));
  if (!/^[a-zA-Z0-9_-]+\.wav$/.test(safeName)) {
    res.status(400).json({ ok: false, error: 'Invalid recording filename' });
    return;
  }
  const fullPath = path.join(config.recordingsDir, safeName);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ ok: false, error: 'Recording not found' });
    return;
  }
  res.type('audio/wav');
  res.sendFile(fullPath);
});

// SSE stream for live CRM log updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendLogs = (logs) => {
    res.write(`event: logs\ndata: ${JSON.stringify({ logs })}\n\n`);
  };

  sendLogs(callStore.list());
  callStore.on('updated', sendLogs);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    callStore.off('updated', sendLogs);
  });
});

const server = http.createServer(app);
const browserWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
browserWss.on('connection', attachBrowserSocket);

server.on('upgrade', (request, socket, head) => {
  socket.setNoDelay(true);
  const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  if (pathname === '/ws/browser') {
    browserWss.handleUpgrade(request, socket, head, (ws) => browserWss.emit('connection', ws, request));
  } else {
    socket.destroy();
  }
});

server.listen(config.port, () => {
  const health = getHealthStatus();
  console.log(`Divyasree WOW Voice Agent running at http://localhost:${config.port}`);
  console.log(`Gemini: ${health.geminiLiveModel} (${health.hasGeminiKey ? 'ready' : 'missing GEMINI_API_KEY'})`);
});
