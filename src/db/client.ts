// Neon / any remote Postgres over HTTPS: driverul HTTP Neon (fetch, fără WebSocket). Local/CI: node-postgres.
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzlePg<typeof schema>>;
const g = globalThis as unknown as { __igoDb?: Db };
export const dbConfigured = () => !!process.env.DATABASE_URL;
const isLocal = (url: string) => /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url) || /host=\/|@\/|localhost/.test(new URL(url).hostname || "localhost");
export function db(): Db {
  if (g.__igoDb) return g.__igoDb;
  const url = process.env.DATABASE_URL!;
  if (!isLocal(url) && process.env.DB_DRIVER !== "pg") {
    g.__igoDb = drizzleNeonHttp(neon(url), { schema }) as unknown as Db;
  } else {
    g.__igoDb = drizzlePg(new pg.Pool({ connectionString: url, max: 5 }), { schema });
  }
  return g.__igoDb;
}
