-- Esquema do multiplayer "A Cidade dos Iguais" (DEJAD Ceara-Mirim)

CREATE TABLE IF NOT EXISTS rooms (
  code        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'waiting', -- waiting | running | closed
  starts_at   BIGINT,                          -- epoch ms do inicio comum
  ends_at     BIGINT,                          -- epoch ms do fim previsto
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id          TEXT PRIMARY KEY,
  room_code   TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  token       TEXT NOT NULL,
  phase       INTEGER NOT NULL DEFAULT 0,  -- fase atual (0..7)
  stage       INTEGER NOT NULL DEFAULT 0,  -- selos conquistados (0..6)
  finished    BOOLEAN NOT NULL DEFAULT false,
  finished_at BIGINT,                      -- epoch ms da conclusao
  duration_ms BIGINT,                      -- tempo total da partida
  rank        INTEGER,                     -- posicao de chegada (1 = primeiro)
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_code);
CREATE INDEX IF NOT EXISTS idx_players_rank ON players(room_code, rank);
