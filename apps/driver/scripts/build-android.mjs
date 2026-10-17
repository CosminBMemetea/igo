import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { load } from "@expo/env";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "preview";
if (!["preview", "check"].includes(mode)) throw new Error("Use preview or check. This script does not publish to Google Play.");
process.env.NODE_ENV = "production";
load(root);
let origin;
try {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname.endsWith(".example")) throw new Error();
  origin = url.origin;
} catch { throw new Error("Set EXPO_PUBLIC_API_URL to a verified HTTPS backend origin (no path, credentials, query or placeholder)."); }
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(homedir(), "Library/Android/sdk");
const localJdks = join(homedir(), ".cache/querra-android-tools/jdk");
const javaHome = process.env.JAVA_HOME ?? (existsSync(localJdks) ? join(localJdks, readdirSync(localJdks).sort().at(-1), "Contents/Home") : "");
if (!javaHome || !existsSync(join(javaHome, "bin/java"))) throw new Error("Set JAVA_HOME to the installed JDK.");
const tools = join(sdk, "build-tools", "37.0.0");
for (const path of [join(tools, "apksigner"), join(tools, "aapt2"), join(tools, "zipalign"), join(sdk, "platforms/android-37.0/android.jar"), join(sdk, "ndk/27.1.12297006/source.properties")]) {
  if (!existsSync(path)) throw new Error(`Android SDK package missing: ${path}`);
}
process.env.JAVA_HOME = javaHome;
process.env.ANDROID_HOME = sdk;
process.env.ANDROID_SDK_ROOT = sdk;
process.env.PATH = `${dirname(process.execPath)}:${join(javaHome, "bin")}:${process.env.PATH ?? ""}`;
process.env.QFLEET_ANDROID_PREVIEW = "1";
function run(command, args, cwd = root, capture = false) {
  const r = spawnSync(command, args, { cwd, env: process.env, encoding: "utf8", stdio: capture ? "pipe" : "inherit", maxBuffer: 16 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${command} failed (${r.status ?? r.signal}).${capture ? `\n${r.stderr ?? ""}` : ""}`);
  return r.stdout ?? "";
}
run(join(javaHome, "bin/java"), ["-version"]);
console.log("Android preview backend:", origin);
if (mode === "check") process.exit(0);

const keyDir = process.env.QFLEET_ANDROID_KEY_DIR ?? join(homedir(), ".local/share/querra/android-preview-signing");
mkdirSync(keyDir, { recursive: true, mode: 0o700 });
chmodSync(keyDir, 0o700);
const keyStore = join(keyDir, "preview.p12"), passwordFile = join(keyDir, "password");
if (existsSync(keyStore) && !existsSync(passwordFile)) throw new Error("The preview key exists but its password is missing. Restore the signing backup; do not silently replace the key.");
if (!existsSync(passwordFile)) writeFileSync(passwordFile, randomBytes(32).toString("hex") + "\n", { mode: 0o600, flag: "wx" });
chmodSync(passwordFile, 0o600);
if (!existsSync(keyStore)) run(join(javaHome, "bin/keytool"), ["-genkeypair", "-noprompt", "-storetype", "PKCS12", "-keystore", keyStore,
  "-storepass:file", passwordFile, "-keypass:file", passwordFile, "-alias", "qfleet-preview", "-keyalg", "RSA", "-keysize", "3072", "-validity", "3650", "-dname", "CN=Querra Android Preview"]);
chmodSync(keyStore, 0o600);
process.env.QFLEET_ANDROID_KEYSTORE = keyStore;
process.env.QFLEET_ANDROID_KEY_PASSWORD_FILE = passwordFile;

run(process.execPath, ["node_modules/expo/bin/cli", "prebuild", "--platform", "android", "--no-install"]);
const gradleFile = join(root, "android/app/build.gradle");
const hook = "apply from: new File(rootProject.projectDir, '../scripts/android-preview.gradle')";
const gradle = readFileSync(gradleFile, "utf8");
if (!gradle.includes(hook)) writeFileSync(gradleFile, `${gradle}\n${hook}\n`);
run("./gradlew", [":app:assembleRelease", "--no-daemon", "--console=plain", "--max-workers=4", "-PreactNativeArchitectures=arm64-v8a,x86_64"], join(root, "android"));

const source = join(root, "android/app/build/outputs/apk/release/app-release.apk");
run(join(tools, "zipalign"), ["-c", "-P", "16", "4", source]);
if (!run(join(javaHome, "bin/jar"), ["tf", source], root, true).split("\n").includes("assets/index.android.bundle")) throw new Error("The test APK must contain its JavaScript bundle and run without Metro.");
const verification = run(join(tools, "apksigner"), ["verify", "--verbose", "--print-certs", source], root, true);
const certificate = run(join(javaHome, "bin/keytool"), ["-exportcert", "-rfc", "-keystore", keyStore, "-storepass:file", passwordFile, "-alias", "qfleet-preview"], root, true);
const certificateSha256 = createHash("sha256").update(Buffer.from(certificate.replace(/-----[^\n]+-----/g, "").replace(/\s/g, ""), "base64")).digest("hex");
if (!verification.toLowerCase().includes(`certificate sha-256 digest: ${certificateSha256}`)) throw new Error("The APK is not signed with the private preview key; refusing to distribute it.");
const badging = run(join(tools, "aapt2"), ["dump", "badging", source], root, true);
if (!badging.includes("name='com.querra.qfleet.driver.preview'") || badging.includes("application-debuggable")) throw new Error("Refusing an APK with the wrong application ID or a debuggable release.");
const required = ["ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION", "FOREGROUND_SERVICE_LOCATION", "POST_NOTIFICATIONS"];
for (const permission of required) if (!badging.includes(`android.permission.${permission}`)) throw new Error(`Missing ${permission}`);
for (const permission of ["READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "RECORD_AUDIO", "SYSTEM_ALERT_WINDOW"]) if (badging.includes(`android.permission.${permission}`)) throw new Error(`Unexpected ${permission}`);
const output = join(root, "build/android/preview");
mkdirSync(output, { recursive: true });
const artifact = join(output, "QuerraSofer-Android-0.1.0-preview.apk");
copyFileSync(source, artifact);
writeFileSync(join(output, "verification.txt"), `${verification}\n${badging}`);
writeFileSync(join(output, "build-info.json"), JSON.stringify({ configuration: "Release", distribution: "local-preview", applicationId: "com.querra.qfleet.driver.preview",
  apiOrigin: origin, sourceCommit: run("git", ["rev-parse", "HEAD"], root, true).trim(), sourceDirty: !!run("git", ["status", "--porcelain"], root, true).trim(),
  builtAt: new Date().toISOString(), sha256: createHash("sha256").update(readFileSync(artifact)).digest("hex"), certificateSha256, architectures: ["arm64-v8a", "x86_64"], signed: true, artifact }, null, 2) + "\n");
console.log(`Verified installable test APK: ${artifact}\nKeep the private preview signing directory backed up outside Git. This is not a Google Play production release.`);
