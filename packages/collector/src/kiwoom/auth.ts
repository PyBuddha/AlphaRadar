import type { KiwoomAuthToken, KiwoomConfig } from "./types.js";

export interface KiwoomAuthClient {
  issueToken(): Promise<KiwoomAuthToken>;
  refreshToken(refreshToken: string): Promise<KiwoomAuthToken>;
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
    if (!this.config.credentials.appKey || !this.config.credentials.appSecret) {
      throw new Error(
        "Kiwoom app credentials are required for live/paper token issuance"
      );
    }

    throw new Error("Kiwoom OAuth token issuance not implemented yet");
  }

  async refreshToken(_refreshToken: string): Promise<KiwoomAuthToken> {
    throw new Error("Kiwoom OAuth token refresh not implemented yet");
  }
}

