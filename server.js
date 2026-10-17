import express from 'express';
import { addWalk, getWalks, getWalk, updateWalk, deleteWalk, getStats } from './db.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3150;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());

// ── Static files ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Walks CRUD ────────────────────────────────────────────────────────
app.get('/api/walks', (req, res) => {
  const { date, limit, offset } = req.query;
  const rows = getWalks({
    date: date || undefined,
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0,
  });
  res.json(rows);
});

app.get('/api/walks/:id', (req, res) => {
  const walk = getWalk(Number(req.params.id));
  if (!walk) return res.status(404).json({ error: 'not found' });
  res.json(walk);
});

app.post('/api/walks', (req, res) => {
  const { date, time, type, poo_size, pees, note } = req.body;
  if (!date || !time || !type) {
    return res.status(400).json({ error: 'date, time and type are required' });
  }
  const id = addWalk({
    date,
    time,
    type,
    poo_size: poo_size || null,
    pees: pees || [],
    note: note || '',
  });
  const walk = getWalk(id);
  res.status(201).json(walk);
});

app.put('/api/walks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = getWalk(id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const { date, time, type, poo_size, pees, note } = req.body;
  updateWalk({
    id,
    date: date || existing.date,
    time: time || existing.time,
    type: type || existing.type,
    poo_size: poo_size !== undefined ? poo_size : existing.poo_size,
    pees: pees !== undefined ? pees : existing.pees.map(p => p.size),
    note: note !== undefined ? note : existing.note,
  });
  res.json(getWalk(id));
});

app.delete('/api/walks/:id', (req, res) => {
  deleteWalk(Number(req.params.id));
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 14;
  res.json(getStats({ days }));
});

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`Dog Walks server → http://${HOST}:${PORT}`);
});