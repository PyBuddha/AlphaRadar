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

export function collectorConfigFromEnv(env: NodeJS.ProcessEnv = process.env): CollectorConfig {
  const modeValue = (env.KIWOOM_MODE ?? "mock").toLowerCase();
  const mode =
    modeValue === "live" ? "live" : modeValue === "paper" ? "paper" : "mock";

  let config: CollectorConfig = {
    provider: "kiwoom",
    mode
  };

  config = addIfDefined(config, "appKey", readEnv(env, "KIWOOM_APP_KEY"));
  config = addIfDefined(config, "appSecret", readEnv(env, "KIWOOM_APP_SECRET"));
  config = addIfDefined(
    config,
    "accessToken",
    readEnv(env, "KIWOOM_ACCESS_TOKEN")
  );
  config = addIfDefined(
    config,
    "refreshToken",
    readEnv(env, "KIWOOM_REFRESH_TOKEN")
  );
  config = addIfDefined(
    config,
    "restBaseUrl",
    readEnv(env, "KIWOOM_REST_BASE_URL")
  );
  config = addIfDefined(config, "wsUrl", readEnv(env, "KIWOOM_WS_URL"));

  return config;
}
