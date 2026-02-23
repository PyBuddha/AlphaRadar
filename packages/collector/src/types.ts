export type TradeTickEvent = {
  kind: "trade";
  symbol: string;
  price: number;
  size: number;
  timestampMs: number;
};

export type QuoteEvent = {
  kind: "quote";
  symbol: string;
  bid1?: number;
  ask1?: number;
  bidQty1?: number;
  askQty1?: number;
  timestampMs: number;
};

export type CollectorEvent = TradeTickEvent | QuoteEvent;

export type CollectorMode = "mock" | "paper" | "live";
export type CollectorProvider = "kiwoom";

export type CollectorConfig = {
  provider: CollectorProvider;
  mode: CollectorMode;
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  restBaseUrl?: string;
  wsUrl?: string;
};

export type CollectorConnectionResult = {
  ok: true;
  provider: CollectorProvider;
  mode: CollectorMode;
  message: string;
};

export type UnsubscribeFn = () => void;

export type CollectorEventHandler = (event: CollectorEvent) => void;

export interface Collector {
  readonly config: CollectorConfig;
  connect(): Promise<CollectorConnectionResult>;
  disconnect(): Promise<void>;
  subscribeTrades(symbols: string[]): Promise<void>;
  subscribeQuotes(symbols: string[]): Promise<void>;
  onEvent(handler: CollectorEventHandler): UnsubscribeFn;
}

