import { localNow } from "./validate";
/** „Azi” pentru firmă: ziua demo (15.10.2026) pe datele demo, altfel data locală din România. */
export const DEMO_TODAY = "2026-10-15";
export const todayFor = (demo: boolean) => (demo ? DEMO_TODAY : localNow().slice(0, 10));
