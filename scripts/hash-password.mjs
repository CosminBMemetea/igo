// npm run hash-password → cere parola (ascunsă) și afișează ADMIN_PASSWORD_HASH. Parola nu se salvează nicăieri.
import { randomBytes, scryptSync } from "node:crypto";
const ask = (q) => new Promise((res) => {
  process.stdout.write(q);
  const stdin = process.stdin; let s = "";
  if (!stdin.isTTY) { stdin.setEncoding("utf8"); stdin.on("data", (d) => (s += d)); stdin.on("end", () => res(s.replace(/\r?\n$/, ""))); return; }
  stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
  const on = (c) => {
    if (c === "\r" || c === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.off("data", on); process.stdout.write("\n"); res(s); }
    else if (c === "\u0003") process.exit(1);
    else if (c === "\u007f") s = s.slice(0, -1); else s += c;
  };
  stdin.on("data", on);
});
const pw = await ask("Parolă admin (min. 12 caractere): ");
if (pw.length < 12) { console.error("Prea scurtă."); process.exit(1); }
const N = 16384, r = 8, p = 1, salt = randomBytes(16);
const hash = scryptSync(pw, salt, 32, { N, r, p });
console.log(`ADMIN_PASSWORD_HASH=scrypt:${N}:${r}:${p}:${salt.toString("base64")}:${hash.toString("base64")}`);
console.log(`SESSION_SECRET (exemplu nou, aleator): ${randomBytes(32).toString("base64url")}`);
