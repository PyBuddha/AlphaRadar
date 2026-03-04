import type {
  KiwoomConfig,
  KiwoomWsRawMessage,
  KiwoomWsSubscription
} from "./types.js";
import WebSocket, { type RawData } from "ws";

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
  private socket: WebSocket | null = null;
  private connectInFlight: Promise<void> | null = null;
  private loginResolve: (() => void) | null = null;
  private loginReject: ((error: Error) => void) | null = null;

  constructor(private readonly config: KiwoomConfig) {}

  private resolveWsUrl(): string {
    const configured = this.config.endpoints.wsUrl?.trim();
    if (configured) {
      const base = configured.replace(/\/$/, "");
      return base.endsWith("/api/dostk/websocket") ? base : `${base}/api/dostk/websocket`;
    }

    const baseDomain =
      this.config.mode === "paper"
        ? "wss://mockapi.kiwoom.com:10000"
        : "wss://api.kiwoom.com:10000";
    return `${baseDomain}/api/dostk/websocket`;
  }

  private resolveAccessToken(): string {
    const token = this.config.credentials.accessToken?.trim();
    if (!token) {
      throw new Error("KIWOOM_ACCESS_TOKEN is required for live/paper WS");
    }
    return token;
  }

  private static toNumber(value: unknown): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value !== "string") return 0;

    const compact = value.trim().replace(/,/g, "");
    if (!compact) return 0;
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

  private static resolveTradeTimestampMs(raw: unknown): number {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!/^\d{6}$/.test(text)) return Date.now();

    const hh = Number(text.slice(0, 2));
    const mm = Number(text.slice(2, 4));
    const ss = Number(text.slice(4, 6));
    if (![hh, mm, ss].every(Number.isFinite)) return Date.now();

    const now = new Date();
    now.setHours(hh, mm, ss, 0);
    return now.getTime();
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Kiwoom WS is not connected");
    }
    this.socket.send(JSON.stringify(payload));
  }

  private async login(token: string): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Kiwoom WS socket is not open");
    }

    const loginPayload = { trnm: "LOGIN", token };
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.loginResolve = null;
        this.loginReject = null;
        reject(new Error("Kiwoom WS login timed out"));
      }, 10_000);

      this.loginResolve = () => {
        clearTimeout(timeout);
        this.loginResolve = null;
        this.loginReject = null;
        resolve();
      };
      this.loginReject = (error) => {
        clearTimeout(timeout);
        this.loginResolve = null;
        this.loginReject = null;
        reject(error);
      };

      this.sendJson(loginPayload);
    });
  }

  private emitMessage(message: KiwoomWsRawMessage): void {
    for (const handler of this.handlers) {
      handler(message);
    }
  }

  private handleSocketMessage(rawText: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return;
    }

    const envelope = LiveKiwoomWsClient.asObject(parsed);
    const trnm = String(envelope.trnm ?? "").toUpperCase();

    if (trnm === "PING") {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(rawText);
      }
      return;
    }

    if (trnm === "LOGIN") {
      const code = String(envelope.return_code ?? "");
      if (code === "0") {
        this.loginResolve?.();
      } else {
        const message = String(envelope.return_msg ?? "Kiwoom WS login failed");
        this.loginReject?.(new Error(`Kiwoom WS login failed (${code}): ${message}`));
      }
      return;
    }

    if (trnm !== "REAL") return;

    const now = Date.now();
    for (const item of LiveKiwoomWsClient.asArray(envelope.data)) {
      const typeCode = String(item.type ?? "");
      const symbol = String(item.item ?? "").trim();
      if (!symbol) continue;

      const values = LiveKiwoomWsClient.asObject(item.values);
      if (typeCode === "0B") {
        const price = Math.abs(LiveKiwoomWsClient.toNumber(values["10"]));
        const size = Math.abs(LiveKiwoomWsClient.toNumber(values["15"]));
        if (price <= 0 || size <= 0) continue;

        this.emitMessage({
          channel: "trade",
          receivedAtMs: now,
          payload: {
            symbol,
            price,
            size,
            ts: LiveKiwoomWsClient.resolveTradeTimestampMs(values["20"])
          }
        });
        continue;
      }

      if (typeCode === "0C") {
        const bid1 = Math.abs(LiveKiwoomWsClient.toNumber(values["28"]));
        const ask1 = Math.abs(LiveKiwoomWsClient.toNumber(values["27"]));

        this.emitMessage({
          channel: "quote",
          receivedAtMs: now,
          payload: {
            symbol,
            bid1: bid1 > 0 ? bid1 : undefined,
            ask1: ask1 > 0 ? ask1 : undefined,
            ts: now
          }
        });
      }
    }
  }

  private buildSubscriptionPayload(
    trnm: "REG" | "REMOVE",
    request: KiwoomWsSubscription
  ): Record<string, unknown> {
    const symbols = [...new Set(request.symbols.map((symbol) => symbol.trim()).filter(Boolean))];
    const typeCode = request.channel === "trade" ? "0B" : "0C";
    const payload: Record<string, unknown> = {
      trnm,
      grp_no: "1",
      data: [
        {
          item: symbols,
          type: [typeCode]
        }
      ]
    };
    if (trnm === "REG") {
      payload.refresh = "1";
    }
    return payload;
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectInFlight) {
      return this.connectInFlight;
    }

    const wsUrl = this.resolveWsUrl();
    const token = this.resolveAccessToken();

    this.connectInFlight = (async () => {
      const socket = await new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          ws.terminate();
          reject(new Error("Kiwoom WS connection timed out"));
        }, 10_000);

        ws.once("open", () => {
          clearTimeout(timeout);
          resolve(ws);
        });
        ws.once("error", (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.socket = socket;
      socket.on("message", (data: RawData) => {
        const rawText = typeof data === "string" ? data : data.toString("utf8");
        this.handleSocketMessage(rawText);
      });
      socket.on("close", () => {
        if (this.socket === socket) {
          this.socket = null;
        }
        this.loginReject?.(new Error("Kiwoom WS closed during login or stream"));
      });

      await this.login(token);
    })();

    try {
      await this.connectInFlight;
    } finally {
      this.connectInFlight = null;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.socket) return;

    const socket = this.socket;
    this.socket = null;
    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
      setTimeout(() => resolve(), 1_500);
    });
  }

  async subscribe(request: KiwoomWsSubscription): Promise<void> {
    if (request.symbols.length === 0) return;
    await this.connect();
    this.sendJson(this.buildSubscriptionPayload("REG", request));
  }

  async unsubscribe(request: KiwoomWsSubscription): Promise<void> {
    if (request.symbols.length === 0) return;
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.sendJson(this.buildSubscriptionPayload("REMOVE", request));
  }

  onMessage(handler: KiwoomWsMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
