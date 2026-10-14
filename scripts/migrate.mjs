// npm run db:migrate — aplică migrațiile din ./drizzle. Fără DATABASE_URL: nu face nimic (prod merge pe demo în memorie).
import pg from "pg";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
const url = process.env.DATABASE_URL;
if (!url) { console.log("[db:migrate] DATABASE_URL lipsește: sar peste migrații (mod demo în memorie)."); process.exit(0); }
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  console.log("[db:migrate] migrații aplicate.");
} catch (e) { console.error("[db:migrate] EȘEC:", e.message); process.exitCode = 1; }
finally { await pool.end(); }
