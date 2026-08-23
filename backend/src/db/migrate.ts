import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrate() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  console.log('Migrations completed successfully.');

  await pool.end();
  process.exit(0);
}

runMigrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
