// bin/deploy/delete-create-db.mjs
//
// DESTRUCTIVE database (re)initialiser, run from docker-entrypoint.sh ONLY when
// RUN_DB_SETUP=true. It DROPS and recreates the target database named in
// DATABASE_URL, then the entrypoint runs `migrate:up` to build the schema.
//
// Intended for the FIRST initialisation of an empty environment. In any
// environment that holds real data, keep RUN_DB_SETUP=false (see README).
import pg from 'pg';
import dotenv from 'dotenv';

// Match the rest of the codebase: env lives in env/.<NODE_ENV>.env, but real
// process env (k8s) always wins — dotenv never overrides already-set vars.
dotenv.config({ path: `env/.${process.env.NODE_ENV}.env` });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('✖ DATABASE_URL is not set — refusing to run DB setup.');
  process.exit(1);
}

const url = new URL(databaseUrl);
const targetDb = decodeURIComponent(url.pathname.replace(/^\//, ''));

// Guard rails: never touch the maintenance DB, and only allow plain identifiers
// (we have to interpolate the name into DDL — it cannot be parameterised).
if (!targetDb) {
  console.error('✖ DATABASE_URL has no database name in its path — aborting.');
  process.exit(1);
}
if (targetDb === 'postgres' || targetDb === 'template0' || targetDb === 'template1') {
  console.error(`✖ Refusing to drop the maintenance database "${targetDb}".`);
  process.exit(1);
}
if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(targetDb)) {
  console.error(`✖ Unsafe database name "${targetDb}" — only [A-Za-z0-9_$] allowed.`);
  process.exit(1);
}

// Connect to the server via the "postgres" maintenance DB so we can drop/create
// the target (you cannot drop a database you are connected to).
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';

const client = new pg.Client({ connectionString: adminUrl.toString() });
const quoted = `"${targetDb}"`;

try {
  await client.connect();
  console.log(`⚠️  Re-initialising database "${targetDb}" on ${url.host} …`);

  // Kick any open sessions off the target so DROP doesn't block.
  await client.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid();`,
    [targetDb]
  );

  await client.query(`DROP DATABASE IF EXISTS ${quoted};`);
  console.log(`  • dropped ${quoted} (if it existed)`);

  await client.query(`CREATE DATABASE ${quoted};`);
  console.log(`  • created ${quoted}`);

  console.log('✓ Database setup complete.');
} catch (err) {
  console.error('✖ Database setup failed:', err?.message ?? err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
