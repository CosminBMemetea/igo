// Neon (host *.neon.tech): driverul serverless Neon (WebSocket, pool). Altfel (Postgres local/CI): node-postgres.
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import ws from "ws";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzlePg<typeof schema>>;
const g = globalThis as unknown as { __igoDb?: Db };
export const dbConfigured = () => !!process.env.DATABASE_URL;
export function db(): Db {
  if (g.__igoDb) return g.__igoDb;
  const url = process.env.DATABASE_URL!;
  if (/\.neon\.tech\b/.test(url)) {
    neonConfig.webSocketConstructor = ws;
    g.__igoDb = drizzleNeon(new NeonPool({ connectionString: url }), { schema }) as unknown as Db;
  } else {
    g.__igoDb = drizzlePg(new pg.Pool({ connectionString: url, max: 5 }), { schema });
  }
  return g.__igoDb;
}
