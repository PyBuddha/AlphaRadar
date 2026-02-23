export type TradeTickEvent = {
  symbol: string;
  price: number;
  size: number;
  timestampMs: number;
};

export type QuoteEvent = {
  symbol: string;
  bid1?: number;
  ask1?: number;
  bidQty1?: number;
  askQty1?: number;
  timestampMs: number;
};

export type CollectorEvent = TradeTickEvent | QuoteEvent;

export type CollectorConfig = {
  mode: "mock" | "paper" | "live";
};

export function createCollector(config: CollectorConfig) {
  return {
    config,
    connect() {
      return { ok: true as const, mode: config.mode };
    }
  };
}
