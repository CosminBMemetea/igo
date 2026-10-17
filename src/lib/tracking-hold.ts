/** User privacy intent survives polling, navigation, reload and other tabs. */
export function trackingHold(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, scope: string) {
  const key = `qf-tracking-hold:${scope}`;
  let held = true;
  const read = () => { try { held = storage.getItem(key) === "1"; } catch { held = true; } return held; };
  read();
  return { key, held: () => held, read,
    pause: () => { held = true; try { storage.setItem(key, "1"); } catch { /* retain local hold */ } },
    resume: () => { try { storage.removeItem(key); held = false; } catch { held = true; } },
  };
}
