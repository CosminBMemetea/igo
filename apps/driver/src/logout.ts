import { abortRequests, read, remove, write, type Login } from "./api";
import { queueRevocation } from "./cleanup";
import { stopGPS } from "./tracking";
import { forgetPush } from "./notifications";
let flight: Promise<void> | null = null;
/** Crash recovery: persist intent before removing login; never wait for connectivity. */
export async function logout() {
  if (flight) return flight;
  abortRequests();
  const job = (async () => {
    // Stop collection even if the secure-storage write fails (e.g. disk full).
    const stopped = stopGPS("Deconectat • GPS oprit").then(() => null, error => ({ error }));
    try { await write("logout-in-progress", true); }
    catch (error) { await stopped; throw error; }
    try { const failure = await stopped; if (failure) throw failure.error; }
    finally {
      const login = await read<Login>("login");
      if (login?.logoutReceipt) await queueRevocation(login.logoutReceipt, login.expiresAt);
      await forgetPush();
      await remove("login");
      await remove("logout-in-progress");
    }
  })();
  flight = job;
  try { await job; } finally { if (flight === job) flight = null; }
}
export async function recoverLogout() { if (await read<boolean>("logout-in-progress")) await logout(); }
