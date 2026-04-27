/**
 * Ejecuta e2e_kitchen_caja.sql en una transacción y hace ROLLBACK (no deja filas de prueba).
 * Requiere: variable de entorno DATABASE_URL o SUPABASE_DB_URL, y: npm i en Pedidos/ (incl. pg en devDep).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlPath = path.join(__dirname, 'e2e_kitchen_caja.sql');
const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Define DATABASE_URL o SUPABASE_DB_URL (cadena SQL de Postgres, ej. de Supabase).');
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('ROLLBACK');
    console.log('[e2e kitchen] OK (rolled back; sin datos de prueba en la base).');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch { /* */ }
    console.error('[e2e kitchen] Fallo:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
