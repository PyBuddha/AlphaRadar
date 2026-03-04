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

  private resolveRestBaseUrl(): string {
    const configured = this.config.endpoints.restBaseUrl?.trim();
    if (configured) return configured.replace(/\/$/, "");
    return this.config.mode === "paper"
      ? "https://mockapi.kiwoom.com"
      : "https://api.kiwoom.com";
  }

  private resolveAccessToken(): string {
    const token = this.config.credentials.accessToken?.trim();
    if (!token) {
      throw new Error("Kiwoom access token is required for live/paper REST");
    }
    return token;
  }

  private static toNumber(value: unknown): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value !== "string") return 0;

    const trimmed = value.trim();
    if (!trimmed) return 0;
    const compact = trimmed.replace(/,/g, "").replace(/\s+/g, "");
    const minusCount = (compact.match(/-/g) ?? []).length;
    const sign = minusCount % 2 === 1 ? -1 : 1;
    const digits = compact.replace(/[+-]/g, "");
    const parsed = Number(digits);
    if (!Number.isFinite(parsed)) return 0;
    return parsed * sign;
  }

  private static asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private static asArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => item as Record<string, unknown>);
  }

  private async postKiwoom<TBody extends Record<string, unknown>>(
    apiId: string,
    path: string,
    body: TBody
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.resolveRestBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        authorization: `Bearer ${this.resolveAccessToken()}`,
        "api-id": apiId
      },
      body: JSON.stringify(body)
    });

    const json = (await response.json().catch(() => undefined)) as unknown;
    const payload = LiveKiwoomRestClient.asObject(json);
    const code = payload.return_code;
    const message = typeof payload.return_msg === "string" ? payload.return_msg : "";

    if (!response.ok) {
      throw new Error(
        `Kiwoom REST ${apiId} failed (${response.status})${message ? `: ${message}` : ""}`
      );
    }

    if (code !== undefined && String(code) !== "0") {
      throw new Error(
        `Kiwoom REST ${apiId} failed (return_code=${String(code)})${message ? `: ${message}` : ""}`
      );
    }

    return payload;
  }

  async getMinuteCandles(
    _request: KiwoomMinuteCandleRequest
  ): Promise<KiwoomMinuteCandle[]> {
    throw new Error("Kiwoom REST getMinuteCandles not implemented yet");
  }

  async getRanking(request: KiwoomRankingRequest): Promise<KiwoomRankingRow[]> {
    const marketCode =
      request.market === "KOSPI" ? "001" : request.market === "KOSDAQ" ? "101" : "000";

    const presets: Record<
      KiwoomRankingRequest["by"],
      { apiId: string; body: Record<string, unknown>; listKey: string }
    > = {
      turnover: {
        apiId: "ka10032",
        body: {
          mrkt_tp: marketCode,
          mang_stk_incls: "0",
          stex_tp: "1"
        },
        listKey: "trde_prica_upper"
      },
      volume: {
        apiId: "ka10030",
        body: {
          mrkt_tp: marketCode,
          sort_tp: "1",
          mang_stk_incls: "0",
          crd_tp: "0",
          trde_qty_tp: "0",
          pric_tp: "0",
          trde_prica_tp: "0",
          mrkt_open_tp: "0",
          stex_tp: "1"
        },
        listKey: "tdy_trde_qty_upper"
      },
      change: {
        apiId: "ka10027",
        body: {
          mrkt_tp: marketCode,
          sort_tp: "1",
          trde_qty_cnd: "0000",
          stk_cnd: "0",
          crd_cnd: "0",
          updown_incls: "1",
          pric_cnd: "0",
          trde_prica_cnd: "0",
          stex_tp: "1"
        },
        listKey: "pred_pre_flu_rt_upper"
      }
    };

    const preset = presets[request.by];
    const payload = await this.postKiwoom(preset.apiId, "/api/dostk/rkinfo", preset.body);
    const rows = LiveKiwoomRestClient.asArray(payload[preset.listKey]);

    const mapped = rows
      .map((row): KiwoomRankingRow | null => {
        const symbol = String(row.stk_cd ?? "").trim();
        if (!symbol) return null;

        const price = Math.abs(LiveKiwoomRestClient.toNumber(row.cur_prc));
        const changePct = LiveKiwoomRestClient.toNumber(row.flu_rt);
        const volume = Math.abs(
          LiveKiwoomRestClient.toNumber(row.now_trde_qty ?? row.trde_qty)
        );

        const turnoverRaw =
          request.by === "turnover"
            ? LiveKiwoomRestClient.toNumber(row.trde_prica)
            : request.by === "volume"
              ? LiveKiwoomRestClient.toNumber(row.trde_amt)
              : Math.abs(price * volume);
        const turnover = Math.abs(turnoverRaw) * 1_000;

        return {
          symbol,
          name: String(row.stk_nm ?? symbol),
          price,
          changePct,
          turnover,
          volume
        };
      })
      .filter((row): row is KiwoomRankingRow => row !== null);

    return mapped.slice(0, request.limit);
  }
}
