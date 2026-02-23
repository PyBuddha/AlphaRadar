import type { CollectorMode } from "../types.js";

export type KiwoomCredentials = {
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
};

export type KiwoomEndpoints = {
  restBaseUrl?: string;
  wsUrl?: string;
};

export type KiwoomConfig = {
  mode: CollectorMode;
  credentials: KiwoomCredentials;
  endpoints: KiwoomEndpoints;
};

export type KiwoomAuthToken = {
  accessToken: string;
  expiresAtEpochMs: number;
  tokenType: "Bearer";
};

export type KiwoomMinuteCandle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
};

export type KiwoomMinuteCandleRequest = {
  symbol: string;
  intervalMin: 1 | 3 | 5;
  limit: number;
};

export type KiwoomRankingRequest = {
  market?: "KOSPI" | "KOSDAQ" | "ALL";
  by: "turnover" | "volume" | "change";
  limit: number;
};

export type KiwoomRankingRow = {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  turnover: number;
  volume: number;
};

export type KiwoomWsChannel = "trade" | "quote";

export type KiwoomWsSubscription = {
  channel: KiwoomWsChannel;
  symbols: string[];
};

export type KiwoomWsRawMessage = {
  channel: KiwoomWsChannel;
  payload: unknown;
  receivedAtMs: number;
};

