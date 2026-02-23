import type {
  KiwoomConfig,
  KiwoomWsRawMessage,
  KiwoomWsSubscription
} from "./types.js";

export type KiwoomWsMessageHandler = (message: KiwoomWsRawMessage) => void;

export interface KiwoomWsClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(request: KiwoomWsSubscription): Promise<void>;
  unsubscribe(request: KiwoomWsSubscription): Promise<void>;
  onMessage(handler: KiwoomWsMessageHandler): () => void;
}

export class MockKiwoomWsClient implements KiwoomWsClient {
  private readonly handlers = new Set<KiwoomWsMessageHandler>();
  private readonly subscriptions = new Map<string, KiwoomWsSubscription>();
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly _config: KiwoomConfig) {}

  async connect(): Promise<void> {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const sub of this.subscriptions.values()) {
        for (const symbol of sub.symbols) {
          const payload =
            sub.channel === "trade"
              ? {
                  symbol,
                  price: 70_000 + Math.floor(Math.random() * 500),
                  size: 1 + Math.floor(Math.random() * 20),
                  ts: now
                }
              : {
                  symbol,
                  bid1: 70_000 + Math.floor(Math.random() * 100),
                  ask1: 70_050 + Math.floor(Math.random() * 100),
                  bidQty1: 10 + Math.floor(Math.random() * 200),
                  askQty1: 10 + Math.floor(Math.random() * 200),
                  ts: now
                };

          const msg: KiwoomWsRawMessage = {
            channel: sub.channel,
            payload,
            receivedAtMs: now
          };
          for (const handler of this.handlers) {
            handler(msg);
          }
        }
      }
    }, 1000);
  }

  async disconnect(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.subscriptions.clear();
  }

  async subscribe(request: KiwoomWsSubscription): Promise<void> {
    const key = `${request.channel}:${request.symbols.join(",")}`;
    this.subscriptions.set(key, request);
  }

  async unsubscribe(request: KiwoomWsSubscription): Promise<void> {
    const key = `${request.channel}:${request.symbols.join(",")}`;
    this.subscriptions.delete(key);
  }

  onMessage(handler: KiwoomWsMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

export class LiveKiwoomWsClient implements KiwoomWsClient {
  private readonly handlers = new Set<KiwoomWsMessageHandler>();

  constructor(private readonly config: KiwoomConfig) {}

  async connect(): Promise<void> {
    if (!this.config.endpoints.wsUrl) {
      throw new Error("KIWOOM_WS_URL is required for live/paper WS");
    }

    throw new Error("Kiwoom WS connect not implemented yet");
  }

  async disconnect(): Promise<void> {}

  async subscribe(_request: KiwoomWsSubscription): Promise<void> {
    throw new Error("Kiwoom WS subscribe not implemented yet");
  }

  async unsubscribe(_request: KiwoomWsSubscription): Promise<void> {
    throw new Error("Kiwoom WS unsubscribe not implemented yet");
  }

  onMessage(handler: KiwoomWsMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

