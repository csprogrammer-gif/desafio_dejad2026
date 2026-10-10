import 'dotenv/config';

const bool = (v, def = false) => {
  if (v === undefined || v === null || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

export const config = {
  port: Number(process.env.PORT || 5000),
  hostKey: process.env.HOST_KEY || '',
  corsOrigin: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  matchMinutes: Number(process.env.MATCH_MINUTES || 20),
  startCountdownSeconds: Number(process.env.START_COUNTDOWN_SECONDS || 5),
  db: process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: bool(process.env.PGSSL) ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        database: process.env.PGDATABASE || 'dejad_desafio',
        password: process.env.PGPASSWORD || '',
        ssl: bool(process.env.PGSSL) ? { rejectUnauthorized: false } : false,
      },
};

if (!config.hostKey) {
  console.warn('[aviso] HOST_KEY nao definida. O painel nao conseguira autenticar.');
}
