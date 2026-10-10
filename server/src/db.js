import pg from 'pg';
import { config } from './config.js';

// Permite injetar um pool alternativo em testes (ex.: pg-mem) via a
// variavel global __DEJAD_TEST_POOL__ definida antes de importar este modulo.
export const pool =
  globalThis.__DEJAD_TEST_POOL__ || new pg.Pool(config.db);

if (!globalThis.__DEJAD_TEST_POOL__) {
  pool.on('error', (err) => {
    console.error('[pg] erro inesperado no pool de conexoes:', err.message);
  });
}

export const query = (text, params) => pool.query(text, params);
