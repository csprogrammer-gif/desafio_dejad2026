import { randomUUID } from 'node:crypto';
import { query } from './db.js';
import { config } from './config.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I/O/0/1 para evitar confusao

function makeCode(len = 5) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export async function createRoom(title) {
  const clean = String(title || '').trim().slice(0, 120) || 'Rodada DEJAD';
  // tenta ate achar um codigo livre
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = makeCode();
    try {
      await query('INSERT INTO rooms(code, title, status) VALUES ($1, $2, $3)', [
        code,
        clean,
        'waiting',
      ]);
      return getRoom(code);
    } catch (err) {
      if (err.code === '23505') continue; // colisao de PK, tenta de novo
      throw err;
    }
  }
  throw new Error('Nao foi possivel gerar um codigo de sala.');
}

export async function listRooms() {
  const { rows } = await query(
    'SELECT code, title FROM rooms ORDER BY created_at DESC LIMIT 50'
  );
  return rows;
}

export async function roomExists(code) {
  const { rows } = await query('SELECT 1 FROM rooms WHERE code = $1', [code]);
  return rows.length > 0;
}

export async function getRoomRow(code) {
  const { rows } = await query('SELECT * FROM rooms WHERE code = $1', [code]);
  return rows[0] || null;
}

// Monta o objeto "room" no formato que o frontend espera.
export async function getRoom(code) {
  const room = await getRoomRow(code);
  if (!room) return null;

  const { rows: players } = await query(
    'SELECT id, name, phase, stage, finished, duration_ms, rank FROM players WHERE room_code = $1 ORDER BY joined_at ASC',
    [code]
  );

  const ranking = players
    .filter((p) => p.finished && p.rank != null)
    .sort((a, b) => a.rank - b.rank)
    .map((p) => ({
      id: p.id,
      name: p.name,
      rank: p.rank,
      durationMs: Number(p.duration_ms || 0),
    }));

  const podium = ranking.slice(0, 3).map((p) => ({
    name: p.name,
    durationMs: p.durationMs,
  }));

  return {
    code: room.code,
    title: room.title,
    status: room.status,
    startsAt: room.starts_at ? Number(room.starts_at) : 0,
    endsAt: room.ends_at ? Number(room.ends_at) : 0,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      phase: p.phase,
      stage: p.stage,
      finished: p.finished,
    })),
    ranking,
    podium,
    serverTime: Date.now(),
  };
}

export async function joinRoom(code, name) {
  const clean = String(name || '').trim().slice(0, 40);
  if (clean.length < 2) throw httpError(400, 'Informe seu nome completo.');

  const room = await getRoomRow(code);
  if (!room) throw httpError(404, 'Sala nao encontrada. Confira o codigo.');
  if (room.status === 'closed') throw httpError(409, 'Esta rodada ja foi encerrada.');
  if (room.status === 'running') throw httpError(409, 'A rodada ja comecou. Aguarde a proxima.');

  const id = randomUUID();
  const token = randomUUID().replace(/-/g, '');
  await query(
    'INSERT INTO players(id, room_code, name, token) VALUES ($1, $2, $3, $4)',
    [id, code, clean, token]
  );

  return { id, token, room: code, name: clean, phase: 0, stage: 0, finished: false };
}

export async function getPlayer(id) {
  const { rows } = await query('SELECT * FROM players WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function startRoom(code) {
  const room = await getRoomRow(code);
  if (!room) throw httpError(404, 'Sala nao encontrada.');
  if (room.status !== 'waiting') throw httpError(409, 'A rodada ja foi iniciada ou encerrada.');

  const startsAt = Date.now() + config.startCountdownSeconds * 1000;
  const endsAt = startsAt + config.matchMinutes * 60 * 1000;
  await query('UPDATE rooms SET status = $1, starts_at = $2, ends_at = $3 WHERE code = $4', [
    'running',
    startsAt,
    endsAt,
    code,
  ]);
  return getRoom(code);
}

export async function endRoom(code) {
  const room = await getRoomRow(code);
  if (!room) throw httpError(404, 'Sala nao encontrada.');
  await query('UPDATE rooms SET status = $1 WHERE code = $2', ['closed', code]);
  return getRoom(code);
}

// Registra o avanco/conclusao de um jogador. Retorna { room, finished, durationMs }.
export async function submitStage(player, phase, collected) {
  const room = await getRoomRow(player.room_code);
  if (!room) throw httpError(404, 'Sala nao encontrada.');
  if (room.status !== 'running') throw httpError(409, 'A rodada nao esta em andamento.');
  if (player.finished) {
    const current = await getRoom(player.room_code);
    return { room: current, finished: true, durationMs: Number(player.duration_ms || 0) };
  }

  const now = Date.now();
  const expired = room.ends_at && now > Number(room.ends_at);

  // phase vem 0..6; stage = numero de selos conquistados.
  const safePhase = Math.max(0, Math.min(7, Number(phase) + 1 || 0));
  const stage = Math.min(6, safePhase);
  const completed = safePhase >= 7 && !expired;

  if (completed) {
    // Conclusao: calcula duracao e atribui rank por ordem de chegada (transacional).
    const durationMs = Math.max(0, now - Number(room.starts_at || now));
    const { rows } = await query(
      `UPDATE players
         SET phase = $1, stage = 6, finished = true, finished_at = $2, duration_ms = $3,
             rank = (
               SELECT COALESCE(MAX(rank), 0) + 1 FROM players WHERE room_code = $4 AND finished = true
             )
       WHERE id = $5 AND finished = false
       RETURNING rank, duration_ms`,
      [safePhase, now, durationMs, player.room_code, player.id]
    );
    const assigned = rows[0];
    const resultRoom = await getRoom(player.room_code);
    return {
      room: resultRoom,
      finished: true,
      durationMs: Number(assigned?.duration_ms ?? durationMs),
    };
  }

  await query('UPDATE players SET phase = $1, stage = $2 WHERE id = $3', [
    safePhase,
    stage,
    player.id,
  ]);
  const resultRoom = await getRoom(player.room_code);
  return { room: resultRoom, finished: false, durationMs: 0 };
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
