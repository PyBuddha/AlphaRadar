import type { CollectorConfig } from "./types.js";

function readEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name];
  if (value == null || value.trim() === "") return undefined;
  return value.trim();
}

function addIfDefined<T extends object, K extends string, V>(
  target: T,
  key: K,
  value: V | undefined
): T & Partial<Record<K, V>> {
  if (value === undefined) return target;
  return Object.assign(target, { [key]: value }) as T & Partial<Record<K, V>>;
}

type ResolvedMode = CollectorConfig["mode"];

function modeEnvPrefix(mode: ResolvedMode): "KIWOOM_LIVE" | "KIWOOM_PAPER" | null {
  if (mode === "live") return "KIWOOM_LIVE";
  if (mode === "paper") return "KIWOOM_PAPER";
  return null;
}

function readKiwoomEnvByMode(
  env: NodeJS.ProcessEnv,
  mode: ResolvedMode,
  suffix: string
): string | undefined {
  const prefix = modeEnvPrefix(mode);
  if (prefix) {
    const modeScopedValue = readEnv(env, `${prefix}_${suffix}`);
    if (modeScopedValue !== undefined) return modeScopedValue;
  }

  return readEnv(env, `KIWOOM_${suffix}`);
}

export function collectorConfigFromEnv(env: NodeJS.ProcessEnv = process.env): CollectorConfig {
  const modeValue = (env.KIWOOM_MODE ?? "mock").toLowerCase();
  const mode =
    modeValue === "live" ? "live" : modeValue === "paper" ? "paper" : "mock";

  let config: CollectorConfig = {
    provider: "kiwoom",
    mode
  };

  config = addIfDefined(config, "appKey", readKiwoomEnvByMode(env, mode, "APP_KEY"));
  config = addIfDefined(config, "appSecret", readKiwoomEnvByMode(env, mode, "APP_SECRET"));
  config = addIfDefined(
    config,
    "accessToken",
    readKiwoomEnvByMode(env, mode, "ACCESS_TOKEN")
  );
  config = addIfDefined(
    config,
    "refreshToken",
    readKiwoomEnvByMode(env, mode, "REFRESH_TOKEN")
  );
  config = addIfDefined(
    config,
    "restBaseUrl",
    readKiwoomEnvByMode(env, mode, "REST_BASE_URL")
  );
  config = addIfDefined(config, "wsUrl", readKiwoomEnvByMode(env, mode, "WS_URL"));

  return config;
}
