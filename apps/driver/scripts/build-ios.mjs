import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "@expo/env";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] ?? "simulator";
if (!["simulator", "device", "check"].includes(target)) throw new Error("Use simulator, device or check.");
process.env.NODE_ENV ??= "production";
load(root);
let origin;
try {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname.endsWith(".example")) throw new Error();
  origin = url.origin;
} catch {
  throw new Error("Set EXPO_PUBLIC_API_URL to the verified HTTPS backend origin before building iOS (no path, query, token or example domain).");
}
if (target === "check") { console.log("iOS backend configuration valid:", origin); process.exit(0); }
if (process.platform !== "darwin") throw new Error("The local iOS build requires macOS and Xcode.");
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}).`);
}
run("xcodebuild", ["-version"]);
run(process.execPath, ["node_modules/expo/bin/cli", "prebuild", "--platform", "ios", "--no-install"]);
run("pod", ["install"], join(root, "ios"));
const workspaces = readdirSync(join(root, "ios")).filter(name => name.endsWith(".xcworkspace"));
if (workspaces.length !== 1) throw new Error("Expected exactly one generated iOS workspace.");
const scheme = workspaces[0].replace(/\.xcworkspace$/, "");
const output = join(root, "build", "ios", target);
mkdirSync(output, { recursive: true });
const common = ["-workspace", join(root, "ios", workspaces[0]), "-scheme", scheme,
  "-configuration", "Release", "-derivedDataPath", join(output, "DerivedData"), "CODE_SIGNING_ALLOWED=NO"];
const artifact = target === "device" ? join(output, "QuerraSofer.xcarchive")
  : join(output, "DerivedData", "Build", "Products", "Release-iphonesimulator", `${scheme}.app`);
run("xcodebuild", target === "device"
  ? [...common, "-destination", "generic/platform=iOS", "-archivePath", artifact, "archive"]
  : [...common, "-destination", "generic/platform=iOS Simulator", "build"]);
const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
writeFileSync(join(output, "build-info.json"), JSON.stringify({ target, configuration: "Release", signed: false,
  apiOrigin: origin, sourceCommit: commit.stdout?.trim(), sourceDirty: !!dirty.stdout?.trim(),
  builtAt: new Date().toISOString(), artifact }, null, 2) + "\n");
console.log(`Built ${artifact}\n${target === "device" ? "Unsigned archive: Apple team/provisioning and signing are required before iPhone installation." : "Simulator app only: cannot be installed on an iPhone."}`);
