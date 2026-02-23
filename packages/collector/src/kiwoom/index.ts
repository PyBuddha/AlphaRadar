import type {
  Collector,
  CollectorConfig,
  CollectorConnectionResult,
  CollectorEvent,
  CollectorEventHandler
} from "../types.js";
import type { KiwoomConfig, KiwoomWsRawMessage } from "./types.js";
import {
  LiveKiwoomAuthClient,
  MockKiwoomAuthClient,
  type KiwoomAuthClient
} from "./auth.js";
import {
  LiveKiwoomRestClient,
  MockKiwoomRestClient,
  type KiwoomRestClient
} from "./rest.js";
import {
  LiveKiwoomWsClient,
  MockKiwoomWsClient,
  type KiwoomWsClient
} from "./ws.js";

export type KiwoomCollector = Collector & {
  auth: KiwoomAuthClient;
  rest: KiwoomRestClient;
  ws: KiwoomWsClient;
};

function toKiwoomConfig(config: CollectorConfig): KiwoomConfig {
  const credentials: KiwoomConfig["credentials"] = {};
  const endpoints: KiwoomConfig["endpoints"] = {};

  if (config.appKey !== undefined) credentials.appKey = config.appKey;
  if (config.appSecret !== undefined) credentials.appSecret = config.appSecret;
  if (config.accessToken !== undefined) {
    credentials.accessToken = config.accessToken;
  }
  if (config.refreshToken !== undefined) {
    credentials.refreshToken = config.refreshToken;
  }
  if (config.restBaseUrl !== undefined) {
    endpoints.restBaseUrl = config.restBaseUrl;
  }
  if (config.wsUrl !== undefined) {
    endpoints.wsUrl = config.wsUrl;
  }

  return {
    mode: config.mode,
    credentials,
    endpoints
  };
}

function mapWsMessage(message: KiwoomWsRawMessage): CollectorEvent | null {
  if (message.channel === "trade") {
    const payload = message.payload as Partial<{
      symbol: string;
      price: number;
      size: number;
      ts: number;
    }>;
    if (!payload.symbol || payload.price == null || payload.size == null) {
      return null;
    }

    return {
      kind: "trade",
      symbol: payload.symbol,
      price: payload.price,
      size: payload.size,
      timestampMs: payload.ts ?? message.receivedAtMs
    };
  }

  if (message.channel === "quote") {
    const payload = message.payload as Partial<{
      symbol: string;
      bid1: number;
      ask1: number;
      bidQty1: number;
      askQty1: number;
      ts: number;
    }>;
    if (!payload.symbol) {
      return null;
    }

    const quoteEvent: CollectorEvent = {
      kind: "quote",
      symbol: payload.symbol,
      timestampMs: payload.ts ?? message.receivedAtMs
    };

    if (payload.bid1 !== undefined) quoteEvent.bid1 = payload.bid1;
    if (payload.ask1 !== undefined) quoteEvent.ask1 = payload.ask1;
    if (payload.bidQty1 !== undefined) quoteEvent.bidQty1 = payload.bidQty1;
    if (payload.askQty1 !== undefined) quoteEvent.askQty1 = payload.askQty1;

    return quoteEvent;
  }

  return null;
}

export function createKiwoomCollector(config: CollectorConfig): KiwoomCollector {
  const kiwoomConfig = toKiwoomConfig(config);

  const auth: KiwoomAuthClient =
    config.mode === "mock"
      ? new MockKiwoomAuthClient(kiwoomConfig)
      : new LiveKiwoomAuthClient(kiwoomConfig);
  const rest: KiwoomRestClient =
    config.mode === "mock"
      ? new MockKiwoomRestClient(kiwoomConfig)
      : new LiveKiwoomRestClient(kiwoomConfig);
  const ws: KiwoomWsClient =
    config.mode === "mock"
      ? new MockKiwoomWsClient(kiwoomConfig)
      : new LiveKiwoomWsClient(kiwoomConfig);

  const handlers = new Set<CollectorEventHandler>();
  let removeWsHandler: (() => void) | undefined;

  async function connect(): Promise<CollectorConnectionResult> {
    if (!removeWsHandler) {
      removeWsHandler = ws.onMessage((message) => {
        const event = mapWsMessage(message);
        if (!event) return;
        for (const handler of handlers) {
          handler(event);
        }
      });
    }

    if (config.mode !== "mock") {
      await auth.issueToken();
    }

    await ws.connect();

    return {
      ok: true,
      provider: "kiwoom",
      mode: config.mode,
      message:
        config.mode === "mock"
          ? "Kiwoom mock collector connected"
          : "Kiwoom collector initialized (REST/WS stubs pending)"
    };
  }

  async function disconnect(): Promise<void> {
    await ws.disconnect();
    if (removeWsHandler) {
      removeWsHandler();
      removeWsHandler = undefined;
    }
  }

  return {
    config,
    auth,
    rest,
    ws,
    connect,
    disconnect,
    async subscribeTrades(symbols: string[]) {
      if (symbols.length === 0) return;
      await ws.subscribe({ channel: "trade", symbols });
    },
    async subscribeQuotes(symbols: string[]) {
      if (symbols.length === 0) return;
      await ws.subscribe({ channel: "quote", symbols });
    },
    onEvent(handler: CollectorEventHandler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }
  };
}
