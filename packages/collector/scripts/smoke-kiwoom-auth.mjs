import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function loadDotEnvIfPresent() {
  const candidates = [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local")
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) {
        process.env[key] = value;
      }
    }
  }
}

function maskToken(token) {
  if (token.length <= 10) return `${token.slice(0, 3)}...`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

loadDotEnvIfPresent();

const required = ["KIWOOM_APP_KEY", "KIWOOM_APP_SECRET"];
const missing = required.filter((key) => !process.env[key] || !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`[collector] missing env: ${missing.join(", ")}`);
  process.exit(1);
}

if (!process.env.KIWOOM_MODE) {
  process.env.KIWOOM_MODE = "paper";
}

const mod = await import("../dist/index.js");
const config = mod.collectorConfigFromEnv(process.env);
if (config.mode === "mock") {
  config.mode = "paper";
}

const collector = mod.createCollector(config);
if (!("auth" in collector) || typeof collector.auth?.issueToken !== "function") {
  console.error("[collector] auth client unavailable");
  process.exit(1);
}

const token = await collector.auth.issueToken();
console.log("[collector] Kiwoom OAuth token issued");
console.log(`mode=${config.mode}`);
console.log(`token=${maskToken(token.accessToken)}`);
console.log(`expires=${new Date(token.expiresAtEpochMs).toISOString()}`);
