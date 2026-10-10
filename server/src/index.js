import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import {
  createRoom,
  listRooms,
  getRoom,
  joinRoom,
  getPlayer,
  startRoom,
  endRoom,
  submitStage,
  httpError,
} from './rooms.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

// CORS: libera a(s) origem(ns) do GitHub Pages definida(s) em CORS_ORIGIN.
const allowAll = config.corsOrigin.includes('*');
app.use(
  cors({
    origin: allowAll ? true : config.corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[erro]', err);
  res.status(status).json({ error: err.message || 'Erro interno.', serverTime: Date.now() });
});

// ---- Autenticacao do host (painel) ----
function requireHost(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!config.hostKey || token !== config.hostKey) {
    return res.status(401).json({ error: 'Acesso reservado a organizacao.', serverTime: Date.now() });
  }
  next();
}

// ---- Autenticacao do jogador (token proprio) ----
async function loadPlayer(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const player = await getPlayer(req.params.id);
    if (!player || !token || player.token !== token) {
      return res.status(401).json({ error: 'Sessao invalida. Entre na sala novamente.', serverTime: Date.now() });
    }
    req.player = player;
    next();
  } catch (err) {
    next(err);
  }
}

// =================== Rotas publicas (jogador) ===================

app.post('/api/join', wrap(async (req, res) => {
  const { code, name } = req.body || {};
  const player = await joinRoom(String(code || '').trim().toUpperCase(), name);
  res.json({ player, serverTime: Date.now() });
}));

app.get('/api/rooms/:code', wrap(async (req, res) => {
  const room = await getRoom(String(req.params.code || '').toUpperCase());
  if (!room) throw httpError(404, 'Sala nao encontrada.');
  res.json({ room, serverTime: Date.now() });
}));

app.get('/api/players/:id', loadPlayer, wrap(async (req, res) => {
  const room = await getRoom(req.player.room_code);
  res.json({
    room,
    player: {
      id: req.player.id,
      name: req.player.name,
      phase: req.player.phase,
      stage: req.player.stage,
      finished: req.player.finished,
      durationMs: Number(req.player.duration_ms || 0),
    },
    serverTime: Date.now(),
  });
}));

app.post('/api/players/:id/stage', loadPlayer, wrap(async (req, res) => {
  const { phase, collected } = req.body || {};
  const result = await submitStage(req.player, phase, collected);
  res.json({ ...result, serverTime: Date.now() });
}));

// =================== Rotas do host (painel) ===================

app.get('/api/host/rooms', requireHost, wrap(async (req, res) => {
  const rooms = await listRooms();
  res.json({ rooms, serverTime: Date.now() });
}));

app.post('/api/host/rooms', requireHost, wrap(async (req, res) => {
  const room = await createRoom(req.body?.title);
  res.json({ room, serverTime: Date.now() });
}));

app.post('/api/host/rooms/:code/start', requireHost, wrap(async (req, res) => {
  const room = await startRoom(String(req.params.code || '').toUpperCase());
  res.json({ room, serverTime: Date.now() });
}));

app.post('/api/host/rooms/:code/end', requireHost, wrap(async (req, res) => {
  const room = await endRoom(String(req.params.code || '').toUpperCase());
  res.json({ room, serverTime: Date.now() });
}));

// Saude
app.get('/health', (req, res) => res.json({ ok: true, serverTime: Date.now() }));

app.use((req, res) => res.status(404).json({ error: 'Rota nao encontrada.', serverTime: Date.now() }));

app.listen(config.port, () => {
  console.log(`[dejad] backend ouvindo na porta ${config.port}`);
  console.log(`[dejad] CORS: ${config.corsOrigin.join(', ')}`);
});
