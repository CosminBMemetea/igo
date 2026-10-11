import { db, dbConfigured } from "@/db/client";
import { MemStore } from "./mem";
import { PgStore } from "./pg";
import type { Store } from "./types";
export * from "./types";
export { dbConfigured };
const g = globalThis as unknown as { __igoStore?: Store };
export function store(): Store {
  if (!g.__igoStore) g.__igoStore = dbConfigured() ? new PgStore(db()) : new MemStore();
  return g.__igoStore;
}
