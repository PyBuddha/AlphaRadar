import type {
  KiwoomConfig,
  KiwoomMinuteCandle,
  KiwoomMinuteCandleRequest,
  KiwoomRankingRequest,
  KiwoomRankingRow
} from "./types.js";

export interface KiwoomRestClient {
  getMinuteCandles(
    request: KiwoomMinuteCandleRequest
  ): Promise<KiwoomMinuteCandle[]>;
  getRanking(request: KiwoomRankingRequest): Promise<KiwoomRankingRow[]>;
}

export class MockKiwoomRestClient implements KiwoomRestClient {
  constructor(private readonly _config: KiwoomConfig) {}

  async getMinuteCandles(
    request: KiwoomMinuteCandleRequest
  ): Promise<KiwoomMinuteCandle[]> {
    const now = Date.now();
    return Array.from({ length: request.limit }, (_, i) => {
      const t = new Date(now - (request.limit - i) * request.intervalMin * 60_000)
        .toISOString();
      const base = 70_000 + i * 10;
      return {
        timestamp: t,
        open: base - 20,
        high: base + 40,
        low: base - 35,
        close: base + 15,
        volume: 1_000 + i * 120,
        turnover: (base + 15) * (1_000 + i * 120)
      };
    });
  }

  async getRanking(request: KiwoomRankingRequest): Promise<KiwoomRankingRow[]> {
    return Array.from({ length: request.limit }, (_, i) => ({
      symbol: `A${String(100000 + i)}`,
      name: `MOCK-${request.by.toUpperCase()}-${i + 1}`,
      price: 5_000 + i * 250,
      changePct: 1.5 + i * 0.35,
      turnover: 500_000_000 + i * 150_000_000,
      volume: 100_000 + i * 15_000
    }));
  }
}

export class LiveKiwoomRestClient implements KiwoomRestClient {
  constructor(private readonly config: KiwoomConfig) {}

  async getMinuteCandles(
    _request: KiwoomMinuteCandleRequest
  ): Promise<KiwoomMinuteCandle[]> {
    if (!this.config.endpoints.restBaseUrl) {
      throw new Error("KIWOOM_REST_BASE_URL is required for live/paper REST");
    }

    throw new Error("Kiwoom REST getMinuteCandles not implemented yet");
  }

  async getRanking(_request: KiwoomRankingRequest): Promise<KiwoomRankingRow[]> {
    if (!this.config.endpoints.restBaseUrl) {
      throw new Error("KIWOOM_REST_BASE_URL is required for live/paper REST");
    }

    throw new Error("Kiwoom REST getRanking not implemented yet");
  }
}

