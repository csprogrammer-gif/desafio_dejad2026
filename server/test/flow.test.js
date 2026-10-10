// Teste de integracao do fluxo multiplayer usando Postgres em memoria (pg-mem).
// Nao precisa de banco real nem Docker. Exercita as rotas HTTP de verdade.
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { newDb } from 'pg-mem';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1) Cria o Postgres em memoria e aplica o schema.
const mem = newDb();
const schema = await readFile(join(__dirname, '..', 'src', 'schema.sql'), 'utf8');
mem.public.none(schema);

// pg-mem gera um adaptador compativel com a interface do pacote 'pg'.
const { Pool } = mem.adapters.createPg();
globalThis.__DEJAD_TEST_POOL__ = new Pool();

// 2) Define env minima antes de importar a app.
process.env.HOST_KEY = 'chave-teste';
process.env.CORS_ORIGIN = '*';
process.env.MATCH_MINUTES = '20';
process.env.START_COUNTDOWN_SECONDS = '0';

// 3) Sobe o servidor (index.js chama listen ao ser importado).
await import('../src/index.js');

const PORT = process.env.PORT || 5000;
const base = `http://127.0.0.1:${PORT}`;
const HOST_KEY = 'chave-teste';

// pequena espera para o listen subir
await new Promise((r) => setTimeout(r, 300));

const j = (r) => r.json();
let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
  console.log('  ok -', msg);
};

// Health
let r = await fetch(`${base}/health`).then(j);
ok(r.ok === true, 'health responde ok');

// Host cria sala
r = await fetch(`${base}/api/host/rooms`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + HOST_KEY },
  body: JSON.stringify({ title: 'Rodada de teste' }),
}).then(j);
ok(r.room && r.room.code && r.room.status === 'waiting', 'host cria sala em waiting');
const code = r.room.code;

// Host sem chave e barrado
const unauth = await fetch(`${base}/api/host/rooms`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'x' }),
});
ok(unauth.status === 401, 'host sem chave recebe 401');

// Jogador entra
r = await fetch(`${base}/api/join`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code, name: 'Ana Teste' }),
}).then(j);
ok(r.player && r.player.id && r.player.token && r.player.room === code, 'jogador entra e recebe token');
const player = r.player;

// Entrar com codigo invalido
const bad = await fetch(`${base}/api/join`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: 'ZZZZZ', name: 'Fulano' }),
});
ok(bad.status === 404, 'codigo invalido retorna 404');

// Host inicia (countdown 0 => comeca imediatamente)
r = await fetch(`${base}/api/host/rooms/${code}/start`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + HOST_KEY },
}).then(j);
ok(r.room.status === 'running' && r.room.startsAt > 0, 'host inicia a rodada');

// Jogador avanca pelas 7 fases (phase 0..6)
let last;
for (let phase = 0; phase < 7; phase++) {
  last = await fetch(`${base}/api/players/${player.id}/stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + player.token },
    body: JSON.stringify({ phase, answers: {}, collected: [] }),
  }).then(j);
}
ok(last.finished === true && last.durationMs >= 0, 'jogador conclui as 7 fases');

// A sala mostra ranking e podio
r = await fetch(`${base}/api/rooms/${code}`).then(j);
ok(r.room.ranking.length === 1 && r.room.ranking[0].rank === 1, 'ranking registra 1o colocado');
ok(r.room.podium.length === 1 && r.room.podium[0].name === 'Ana Teste', 'podio mostra o jogador');

// Token invalido e barrado
const badTok = await fetch(`${base}/api/players/${player.id}`, {
  headers: { authorization: 'Bearer errado' },
});
ok(badTok.status === 401, 'token de jogador invalido retorna 401');

// Host encerra
r = await fetch(`${base}/api/host/rooms/${code}/end`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + HOST_KEY },
}).then(j);
ok(r.room.status === 'closed', 'host encerra a rodada');

console.log(`\nTODOS OS ${passed} TESTES PASSARAM`);
process.exit(0);
