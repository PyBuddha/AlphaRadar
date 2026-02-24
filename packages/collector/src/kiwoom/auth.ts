import type { KiwoomAuthToken, KiwoomConfig } from "./types.js";

export interface KiwoomAuthClient {
  issueToken(): Promise<KiwoomAuthToken>;
  refreshToken(refreshToken: string): Promise<KiwoomAuthToken>;
}

const KIWOOOM_OAUTH_BASE_URL = "https://api.kiwoom.com";

type JsonObject = Record<string, unknown>;

function readString(source: JsonObject, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(source: JsonObject, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function parseCompactDateTime(value: string): number | undefined {
  const compact = value.replace(/\D/g, "");
  if (compact.length !== 14) return undefined;

  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6));
  const day = Number(compact.slice(6, 8));
  const hour = Number(compact.slice(8, 10));
  const minute = Number(compact.slice(10, 12));
  const second = Number(compact.slice(12, 14));
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    return undefined;
  }

  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

function parseExpiresAtEpochMs(source: JsonObject): number {
  const now = Date.now();

  const expiresInSeconds = readNumber(source, [
    "expires_in",
    "access_token_expires_in"
  ]);
  if (expiresInSeconds !== undefined && expiresInSeconds > 0) {
    return now + expiresInSeconds * 1000;
  }

  const epochValue = readNumber(source, ["expires_at", "expires_at_ms", "exp"]);
  if (epochValue !== undefined) {
    return epochValue > 1_000_000_000_000 ? epochValue : epochValue * 1000;
  }

  const expiryText = readString(source, [
    "expires_dt",
    "expiresAt",
    "access_token_token_expired"
  ]);
  if (expiryText) {
    const parsed = Date.parse(expiryText);
    if (Number.isFinite(parsed)) return parsed;
    const compact = parseCompactDateTime(expiryText);
    if (compact !== undefined) return compact;
  }

  return now + 60 * 60 * 1000;
}

function buildAuthErrorMessage(status: number, payload: JsonObject | undefined): string {
  if (!payload) return `Kiwoom OAuth request failed (${status})`;

  const code = readString(payload, ["return_code", "rt_cd", "msg_cd", "error_code"]);
  const message = readString(payload, ["return_msg", "msg1", "msg", "error_description"]);
  if (code && message) {
    return `Kiwoom OAuth request failed (${status}) ${code}: ${message}`;
  }
  if (message) {
    return `Kiwoom OAuth request failed (${status}): ${message}`;
  }
  return `Kiwoom OAuth request failed (${status})`;
}

async function postOAuthToken(
  body: Record<string, unknown>
): Promise<{ token: KiwoomAuthToken; raw: JsonObject }> {
  const response = await fetch(`${KIWOOOM_OAUTH_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8"
    },
    body: JSON.stringify(body)
  });

  let payload: JsonObject | undefined;
  try {
    const json = (await response.json()) as unknown;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      payload = json as JsonObject;
    }
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload) {
    throw new Error(buildAuthErrorMessage(response.status, payload));
  }

  const accessToken = readString(payload, ["access_token", "token"]);
  if (!accessToken) {
    throw new Error("Kiwoom OAuth response missing access_token");
  }

  const tokenTypeRaw = readString(payload, ["token_type"]) ?? "Bearer";
  const tokenType = tokenTypeRaw.toLowerCase() === "bearer" ? "Bearer" : "Bearer";

  return {
    token: {
      accessToken,
      expiresAtEpochMs: parseExpiresAtEpochMs(payload),
      tokenType
    },
    raw: payload
  };
}

export class MockKiwoomAuthClient implements KiwoomAuthClient {
  constructor(private readonly config: KiwoomConfig) {}

  async issueToken(): Promise<KiwoomAuthToken> {
    const accessToken =
      this.config.credentials.accessToken ?? `mock-token-${Date.now()}`;
    return {
      accessToken,
      expiresAtEpochMs: Date.now() + 60 * 60 * 1000,
      tokenType: "Bearer"
    };
  }

  async refreshToken(refreshToken: string): Promise<KiwoomAuthToken> {
    return {
      accessToken: `mock-refresh-${refreshToken.slice(0, 8)}`,
      expiresAtEpochMs: Date.now() + 60 * 60 * 1000,
      tokenType: "Bearer"
    };
  }
}

export class LiveKiwoomAuthClient implements KiwoomAuthClient {
  constructor(private readonly config: KiwoomConfig) {}

  async issueToken(): Promise<KiwoomAuthToken> {
    const { appKey, appSecret } = this.config.credentials;
    if (!appKey || !appSecret) {
      throw new Error(
        "Kiwoom app credentials are required for live/paper token issuance"
      );
    }

    const { token, raw } = await postOAuthToken({
      grant_type: "client_credentials",
      appkey: appKey,
      secretkey: appSecret
    });

    this.config.credentials.accessToken = token.accessToken;
    const refreshToken = readString(raw, ["refresh_token"]);
    if (refreshToken) {
      this.config.credentials.refreshToken = refreshToken;
    }

    return token;
  }

  async refreshToken(refreshToken: string): Promise<KiwoomAuthToken> {
    const { appKey, appSecret } = this.config.credentials;
    if (!appKey || !appSecret) {
      throw new Error(
        "Kiwoom app credentials are required for live/paper token refresh"
      );
    }

    const { token, raw } = await postOAuthToken({
      grant_type: "refresh_token",
      appkey: appKey,
      secretkey: appSecret,
      refresh_token: refreshToken
    });

    this.config.credentials.accessToken = token.accessToken;
    const nextRefreshToken = readString(raw, ["refresh_token"]);
    if (nextRefreshToken) {
      this.config.credentials.refreshToken = nextRefreshToken;
    }

    return token;
  }
}
