/**
 * Dev-only: keeps an embedded Postgres alive for the sandbox, so `npm run dev` and the API have a
 * real database to talk to. Not part of the product and not used in deployment (Neon there).
 *   node scripts/pg.mjs            start and stay in the foreground
 *   psql-less access: postgres://postgres:postgres@127.0.0.1:55432/oneatlas
 */
import EmbeddedPostgres from 'embedded-postgres';

const db = new EmbeddedPostgres({
  databaseDir: '/home/user/pgdata',
  user: 'postgres',
  password: 'postgres',
  port: 55432,
  persistent: true,
});

await db.initialise().catch(async (err) => {
  // Already initialised on a previous run: that is the normal case, not a failure.
  console.log('init skipped:', String(err.message).split('\n')[0]);
});
await db.start();
await db.createDatabase('oneatlas').catch(() => console.log('db oneatlas already exists'));
console.log('ready on 55432');

process.on('SIGTERM', async () => { await db.stop(); process.exit(0); });
process.on('SIGINT', async () => { await db.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
