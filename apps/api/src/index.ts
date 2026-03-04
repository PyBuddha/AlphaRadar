import fs from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectorConfigFromEnv,
  createCollector,
  type CollectorEvent,
  type CollectorMode,
  type KiwoomCollector
} from "@alpharadar/collector";
import { buildRadarRow, deriveMarketState, type EngineInputSnapshot, type MarketState } from "@alpharadar/engine";

type MarketCode = "KOSPI" | "KOSDAQ";
type CapTier = "L" | "M" | "S";
type RadarSource = "mock" | "paper" | "live";

type UniverseItem = EngineInputSnapshot & {
  market: MarketCode;
  sector: string;
  capTier: CapTier;
};

type MarketBoardMember = {
  symbol: string;
  name: string;
  price: number;
  score: number;
  ret1m: number;
  turnover1m: number;
  tags: string[];
  weight: number;
};

type MarketBoardSector = {
  name: string;
  avgScore: number;
  avgRet1m: number;
  totalTurnover1m: number;
  members: MarketBoardMember[];
};

type MarketBoard = {
  code: MarketCode;
  name: string;
  indexChangePct: number;
  avgScore: number;
  advancers: number;
  decliners: number;
  totalTurnover1m: number;
  sectors: MarketBoardSector[];
};

type CollectorProbeStatus = {
  mode: CollectorMode;
  authConnected: boolean;
  checkedAt: string;
  message: string;
  error?: string;
  dataSource: RadarSource;
};

type CollectorRankingRow = {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  turnover: number;
  volume: number;
};

type CollectorRankingClient = {
  getRanking(request: {
    market?: "KOSPI" | "KOSDAQ" | "ALL";
    by: "turnover" | "volume" | "change";
    limit: number;
  }): Promise<CollectorRankingRow[]>;
};

type RealtimeTradePoint = {
  timestampMs: number;
  price: number;
  size: number;
};

type RealtimeQuotePoint = {
  timestampMs: number;
  bid1?: number;
  ask1?: number;
  bidQty1?: number;
  askQty1?: number;
};

type SymbolRealtimeState = {
  symbol: string;
  trades: RealtimeTradePoint[];
  quotes: RealtimeQuotePoint[];
  updatedAtMs: number;
};

type LiveCollectorSession = {
  mode: Extract<CollectorMode, "live" | "paper">;
  collector: KiwoomCollector;
  unsubscribe: (() => void) | null;
  symbolStates: Map<string, SymbolRealtimeState>;
  trackedTradeSymbols: Set<string>;
  trackedQuoteSymbols: Set<string>;
  latestUniverse: UniverseItem[];
  lastScanAtMs: number;
};

type RadarDataset = {
  source: RadarSource;
  universe: UniverseItem[];
};

type HotListItem = {
  rank: number;
  symbol: string;
  name: string;
  score: number;
  price: number;
  tags: string[];
  ret1m: number;
  turnover1m: number;
  red: boolean;
};

type EntryChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
};

type EntryPanel = {
  symbol: string;
  name: string;
  price: number;
  shortHigh: number;
  recentHigh: number;
  support: number;
  resistance: number;
  stopLoss: number;
  takeProfit: number;
  checklist: EntryChecklistItem[];
  timeline: Array<{
    at: string;
    price: number;
    score: number;
    red: boolean;
  }>;
};

type ReplayPoint = {
  at: string;
  timestampMs: number;
  price: number;
  score: number;
  ret1m: number;
  turnover1m: number;
  red: boolean;
};

type JournalSide = "BUY" | "SELL";

type JournalEntry = {
  id: string;
  symbol: string;
  side: JournalSide;
  price: number;
  quantity: number;
  note: string;
  createdAt: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function loadDotEnvIfPresent() {
  const candidates = [path.join(repoRoot, ".env"), path.join(repoRoot, ".env.local")];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) {
        process.env[key] = value;
      }
    }
  }
}

loadDotEnvIfPresent();

const port = Number(process.env.PORT ?? 4000);
const MARKET_SCAN_INTERVAL_MS = 5_000;
const REALTIME_WINDOW_MS = 120_000;
const REALTIME_TRACK_LIMIT = 30;
const MARKET_SCAN_LIMIT_PER_BOARD = 40;
const REPLAY_WINDOW_MS = 5 * 60_000;
const REPLAY_TIMELINE_LIMIT = 120;
const JOURNAL_LIMIT = 200;

let collectorProbeStatus: CollectorProbeStatus = {
  mode: "mock",
  authConnected: false,
  checkedAt: new Date().toISOString(),
  message: "Collector probe not checked yet",
  dataSource: "mock"
};
let collectorProbeInFlight: Promise<CollectorProbeStatus> | null = null;
let liveSession: LiveCollectorSession | null = null;
let liveSessionInFlight: Promise<LiveCollectorSession> | null = null;
let latestHotList: HotListItem[] = [];
const replayBySymbol = new Map<string, ReplayPoint[]>();
const journalEntries: JournalEntry[] = [];

async function ensureCollectorProbeStatus(force = false): Promise<CollectorProbeStatus> {
  const config = collectorConfigFromEnv(process.env);
  const modeChanged = collectorProbeStatus.mode !== config.mode;
  if (!force && !modeChanged && collectorProbeStatus.authConnected) return collectorProbeStatus;
  if (!force && config.mode === "mock") {
    if (!collectorProbeStatus.message.startsWith("Collector running in mock mode") || modeChanged) {
      collectorProbeStatus = {
        mode: "mock",
        authConnected: false,
        checkedAt: new Date().toISOString(),
        message: "Collector running in mock mode (set KIWOOM_MODE=live|paper for real data)",
        dataSource: "mock"
      };
    }
    return collectorProbeStatus;
  }

  if (collectorProbeInFlight) {
    return collectorProbeInFlight;
  }

  collectorProbeInFlight = (async () => {
    const collector = createCollector(config);
    try {
      const result = await collector.connect();
      collectorProbeStatus = {
        mode: config.mode,
        authConnected: true,
        checkedAt: new Date().toISOString(),
        message: result.message,
        dataSource: config.mode
      };
      return collectorProbeStatus;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      collectorProbeStatus = {
        mode: config.mode,
        authConnected: false,
        checkedAt: new Date().toISOString(),
        message: "Collector auth probe failed",
        error: message,
        dataSource: config.mode
      };
      return collectorProbeStatus;
    } finally {
      try {
        await collector.disconnect();
      } catch {
        // ignore cleanup errors from partially initialized collectors
      }
    }
  })();

  try {
    return await collectorProbeInFlight;
  } finally {
    collectorProbeInFlight = null;
  }
}

function isLiveCollectorMode(mode: CollectorMode): mode is Extract<CollectorMode, "live" | "paper"> {
  return mode === "live" || mode === "paper";
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getOrCreateSymbolState(session: LiveCollectorSession, symbol: string): SymbolRealtimeState {
  const existing = session.symbolStates.get(symbol);
  if (existing) return existing;

  const created: SymbolRealtimeState = {
    symbol,
    trades: [],
    quotes: [],
    updatedAtMs: Date.now()
  };
  session.symbolStates.set(symbol, created);
  return created;
}

function pruneSymbolState(state: SymbolRealtimeState, nowMs: number): void {
  const cutoff = nowMs - REALTIME_WINDOW_MS;
  while (state.trades.length > 0 && state.trades[0]!.timestampMs < cutoff) {
    state.trades.shift();
  }
  while (state.quotes.length > 0 && state.quotes[0]!.timestampMs < cutoff) {
    state.quotes.shift();
  }
}

function applyCollectorEvent(session: LiveCollectorSession, event: CollectorEvent): void {
  const nowMs = Date.now();
  const state = getOrCreateSymbolState(session, event.symbol);

  if (event.kind === "trade") {
    state.trades.push({
      timestampMs: event.timestampMs,
      price: event.price,
      size: event.size
    });
  } else {
    const quote: RealtimeQuotePoint = {
      timestampMs: event.timestampMs
    };
    if (event.bid1 !== undefined) quote.bid1 = event.bid1;
    if (event.ask1 !== undefined) quote.ask1 = event.ask1;
    if (event.bidQty1 !== undefined) quote.bidQty1 = event.bidQty1;
    if (event.askQty1 !== undefined) quote.askQty1 = event.askQty1;
    state.quotes.push(quote);
  }

  state.updatedAtMs = nowMs;
  pruneSymbolState(state, nowMs);
}

async function teardownLiveCollectorSession(): Promise<void> {
  if (!liveSession) return;

  const session = liveSession;
  liveSession = null;
  liveSessionInFlight = null;

  if (session.unsubscribe) {
    session.unsubscribe();
    session.unsubscribe = null;
  }
  try {
    await session.collector.disconnect();
  } catch {
    // ignore shutdown errors for partially connected sockets
  }
}

async function ensureLiveCollectorSession(
  mode: Extract<CollectorMode, "live" | "paper">
): Promise<LiveCollectorSession> {
  if (liveSession && liveSession.mode === mode) {
    return liveSession;
  }
  if (liveSessionInFlight) {
    return liveSessionInFlight;
  }

  liveSessionInFlight = (async () => {
    if (liveSession) {
      await teardownLiveCollectorSession();
    }

    const config = collectorConfigFromEnv(process.env);
    config.mode = mode;
    const collector = createCollector(config) as KiwoomCollector;
    await collector.connect();

    const session: LiveCollectorSession = {
      mode,
      collector,
      unsubscribe: null,
      symbolStates: new Map(),
      trackedTradeSymbols: new Set(),
      trackedQuoteSymbols: new Set(),
      latestUniverse: [],
      lastScanAtMs: 0
    };

    session.unsubscribe = collector.onEvent((event) => {
      applyCollectorEvent(session, event);
    });

    liveSession = session;
    return session;
  })();

  try {
    return await liveSessionInFlight;
  } finally {
    liveSessionInFlight = null;
  }
}

function pickRealtimeTrackingSymbols(universe: UniverseItem[]): string[] {
  return [...universe]
    .sort((a, b) => b.turnover1m - a.turnover1m || Math.abs(b.ret1m) - Math.abs(a.ret1m))
    .slice(0, REALTIME_TRACK_LIMIT)
    .map((item) => item.symbol);
}

async function syncRealtimeSubscriptions(
  session: LiveCollectorSession,
  targetSymbols: string[]
): Promise<void> {
  const target = new Set(targetSymbols);
  const addedTrades = [...target].filter((symbol) => !session.trackedTradeSymbols.has(symbol));
  const removedTrades = [...session.trackedTradeSymbols].filter((symbol) => !target.has(symbol));
  const addedQuotes = [...target].filter((symbol) => !session.trackedQuoteSymbols.has(symbol));
  const removedQuotes = [...session.trackedQuoteSymbols].filter((symbol) => !target.has(symbol));

  if (addedTrades.length > 0) {
    try {
      await session.collector.subscribeTrades(addedTrades);
      for (const symbol of addedTrades) {
        session.trackedTradeSymbols.add(symbol);
      }
    } catch {
      // keep scan pipeline alive even if realtime subscription fails transiently
    }
  }
  if (removedTrades.length > 0) {
    try {
      await session.collector.ws.unsubscribe({ channel: "trade", symbols: removedTrades });
      for (const symbol of removedTrades) {
        session.trackedTradeSymbols.delete(symbol);
      }
    } catch {
      // ignore transient unsubscribe failures
    }
  }

  if (addedQuotes.length > 0) {
    try {
      await session.collector.subscribeQuotes(addedQuotes);
      for (const symbol of addedQuotes) {
        session.trackedQuoteSymbols.add(symbol);
      }
    } catch {
      // keep scan pipeline alive even if realtime subscription fails transiently
    }
  }
  if (removedQuotes.length > 0) {
    try {
      await session.collector.ws.unsubscribe({ channel: "quote", symbols: removedQuotes });
      for (const symbol of removedQuotes) {
        session.trackedQuoteSymbols.delete(symbol);
      }
    } catch {
      // ignore transient unsubscribe failures
    }
  }
}

function findPriceAtOrBefore(
  trades: RealtimeTradePoint[],
  thresholdMs: number
): number | null {
  for (let i = trades.length - 1; i >= 0; i -= 1) {
    const trade = trades[i];
    if (!trade) continue;
    if (trade.timestampMs <= thresholdMs) {
      return trade.price;
    }
  }
  return trades.length > 0 && trades[0] ? trades[0].price : null;
}

function sumTradeTurnover(
  trades: RealtimeTradePoint[],
  fromMs: number,
  toMs: number
): number {
  let sum = 0;
  for (const trade of trades) {
    if (trade.timestampMs < fromMs || trade.timestampMs > toMs) continue;
    sum += trade.price * trade.size;
  }
  return sum;
}

function mergeRealtimeIntoUniverse(
  universe: UniverseItem[],
  session: LiveCollectorSession
): UniverseItem[] {
  const nowMs = Date.now();

  return universe.map((base) => {
    const state = session.symbolStates.get(base.symbol);
    if (!state) return base;

    pruneSymbolState(state, nowMs);
    const trades = state.trades;
    const latestTrade = trades[trades.length - 1];
    if (!latestTrade) return base;

    const price = latestTrade.price > 0 ? latestTrade.price : base.price;
    const price30s = findPriceAtOrBefore(trades, nowMs - 30_000);
    const price60s = findPriceAtOrBefore(trades, nowMs - 60_000);
    const ret30s =
      price30s && price30s > 0 ? (price - price30s) / price30s : base.ret1m * 0.5;
    const ret1m =
      price60s && price60s > 0 ? (price - price60s) / price60s : base.ret1m;

    const turnover1m = sumTradeTurnover(trades, nowMs - 60_000, nowMs);
    const turnoverPrev1m = sumTradeTurnover(trades, nowMs - 120_000, nowMs - 60_000);
    const mergedTurnover1m = turnover1m > 0 ? turnover1m : base.turnover1m;
    const mergedTurnover3m = Math.max(mergedTurnover1m + turnoverPrev1m, base.turnover3m * 0.5);
    const turnoverAccel = clamp(
      turnoverPrev1m > 0 ? mergedTurnover1m / turnoverPrev1m : base.turnoverAccel,
      0.5,
      3.0
    );

    const high = trades.reduce((max, trade) => Math.max(max, trade.price), 0);
    const low = trades.reduce((min, trade) => Math.min(min, trade.price), Number.POSITIVE_INFINITY);
    const atrLike =
      high > 0 && Number.isFinite(low)
        ? clamp((high - low) / Math.max(price, 1), 0.005, 0.12)
        : base.atrLike;
    const breakPrevHigh = high > 0 ? price >= high * 0.998 : base.breakPrevHigh;

    const latestQuote = state.quotes[state.quotes.length - 1];
    const spreadBps =
      latestQuote?.ask1 && latestQuote.bid1 && latestQuote.ask1 > latestQuote.bid1
        ? clamp(
            ((latestQuote.ask1 - latestQuote.bid1) /
              Math.max((latestQuote.ask1 + latestQuote.bid1) / 2, 1)) *
              10_000,
            1,
            80
          )
        : base.spreadBps;

    const tradesLast30s = trades.filter((trade) => trade.timestampMs >= nowMs - 30_000).length;
    const tradesPrev30s = trades.filter(
      (trade) => trade.timestampMs >= nowMs - 60_000 && trade.timestampMs < nowMs - 30_000
    ).length;
    const tradeIntensity = clamp(
      tradesPrev30s > 0 ? tradesLast30s / tradesPrev30s : base.tradeIntensity ?? 1,
      0.6,
      2.5
    );

    const merged: UniverseItem = {
      ...base,
      price,
      ret1m,
      ret3m: ret1m * 1.7 + ret30s * 0.3,
      turnover1m: mergedTurnover1m,
      turnover3m: mergedTurnover3m,
      turnoverAccel,
      breakPrevHigh,
      atrLike,
      tradeIntensity
    };
    if (spreadBps !== undefined) {
      merged.spreadBps = spreadBps;
    }

    return merged;
  });
}

async function refreshLiveUniverse(session: LiveCollectorSession): Promise<UniverseItem[]> {
  const nowMs = Date.now();
  if (
    session.latestUniverse.length > 0 &&
    nowMs - session.lastScanAtMs < MARKET_SCAN_INTERVAL_MS
  ) {
    return session.latestUniverse;
  }

  const rest = session.collector.rest as CollectorRankingClient | undefined;
  if (!rest) {
    throw new Error("Collector REST client is unavailable");
  }

  const [kospiRows, kosdaqRows] = await Promise.all([
    rest.getRanking({ market: "KOSPI", by: "turnover", limit: MARKET_SCAN_LIMIT_PER_BOARD }),
    rest.getRanking({ market: "KOSDAQ", by: "turnover", limit: MARKET_SCAN_LIMIT_PER_BOARD })
  ]);

  const baseUniverse = [
    ...kospiRows.map((row, index) => mapRankingRowToUniverseItem("KOSPI", row, index + 1)),
    ...kosdaqRows.map((row, index) => mapRankingRowToUniverseItem("KOSDAQ", row, index + 1))
  ];
  session.latestUniverse = baseUniverse;
  session.lastScanAtMs = nowMs;

  const trackingSymbols = pickRealtimeTrackingSymbols(baseUniverse);
  await syncRealtimeSubscriptions(session, trackingSymbols);

  return baseUniverse;
}

const mockUniverse: UniverseItem[] = [
  {
    market: "KOSPI",
    sector: "반도체",
    capTier: "L",
    symbol: "005930",
    name: "삼성전자",
    price: 71200,
    ret1m: 0.011,
    ret3m: 0.038,
    turnover1m: 3_400_000_000,
    turnover3m: 8_900_000_000,
    turnoverAccel: 1.28,
    breakPrevHigh: true,
    atrLike: 0.017,
    spreadBps: 8,
    tradeIntensity: 1.18
  },
  {
    market: "KOSPI",
    sector: "반도체",
    capTier: "L",
    symbol: "000660",
    name: "SK하이닉스",
    price: 189500,
    ret1m: 0.024,
    ret3m: 0.061,
    turnover1m: 4_800_000_000,
    turnover3m: 12_700_000_000,
    turnoverAccel: 1.44,
    breakPrevHigh: true,
    atrLike: 0.023,
    spreadBps: 10,
    tradeIntensity: 1.26
  },
  {
    market: "KOSPI",
    sector: "2차전지",
    capTier: "L",
    symbol: "373220",
    name: "LG에너지솔루션",
    price: 392000,
    ret1m: -0.007,
    ret3m: 0.016,
    turnover1m: 2_600_000_000,
    turnover3m: 7_200_000_000,
    turnoverAccel: 1.11,
    breakPrevHigh: false,
    atrLike: 0.031,
    spreadBps: 14,
    tradeIntensity: 0.94
  },
  {
    market: "KOSPI",
    sector: "2차전지",
    capTier: "M",
    symbol: "006400",
    name: "삼성SDI",
    price: 319500,
    ret1m: 0.009,
    ret3m: 0.025,
    turnover1m: 1_850_000_000,
    turnover3m: 4_900_000_000,
    turnoverAccel: 1.21,
    breakPrevHigh: false,
    atrLike: 0.028,
    spreadBps: 16,
    tradeIntensity: 1.02
  },
  {
    market: "KOSPI",
    sector: "자동차",
    capTier: "L",
    symbol: "005380",
    name: "현대차",
    price: 248500,
    ret1m: 0.015,
    ret3m: 0.034,
    turnover1m: 1_950_000_000,
    turnover3m: 5_400_000_000,
    turnoverAccel: 1.18,
    breakPrevHigh: true,
    atrLike: 0.019,
    spreadBps: 12,
    tradeIntensity: 1.08
  },
  {
    market: "KOSPI",
    sector: "자동차",
    capTier: "M",
    symbol: "000270",
    name: "기아",
    price: 112000,
    ret1m: 0.013,
    ret3m: 0.029,
    turnover1m: 1_430_000_000,
    turnover3m: 3_900_000_000,
    turnoverAccel: 1.16,
    breakPrevHigh: true,
    atrLike: 0.018,
    spreadBps: 11,
    tradeIntensity: 1.04
  },
  {
    market: "KOSPI",
    sector: "금융",
    capTier: "M",
    symbol: "055550",
    name: "신한지주",
    price: 49300,
    ret1m: 0.006,
    ret3m: 0.018,
    turnover1m: 690_000_000,
    turnover3m: 2_200_000_000,
    turnoverAccel: 1.07,
    breakPrevHigh: false,
    atrLike: 0.012,
    spreadBps: 9,
    tradeIntensity: 0.96
  },
  {
    market: "KOSPI",
    sector: "금융",
    capTier: "M",
    symbol: "105560",
    name: "KB금융",
    price: 87800,
    ret1m: 0.008,
    ret3m: 0.021,
    turnover1m: 880_000_000,
    turnover3m: 2_700_000_000,
    turnoverAccel: 1.1,
    breakPrevHigh: false,
    atrLike: 0.014,
    spreadBps: 10,
    tradeIntensity: 0.99
  },
  {
    market: "KOSDAQ",
    sector: "바이오",
    capTier: "L",
    symbol: "068270",
    name: "셀트리온",
    price: 189000,
    ret1m: 0.012,
    ret3m: 0.027,
    turnover1m: 1_540_000_000,
    turnover3m: 4_300_000_000,
    turnoverAccel: 1.22,
    breakPrevHigh: false,
    atrLike: 0.024,
    spreadBps: 13,
    tradeIntensity: 1.01
  },
  {
    market: "KOSDAQ",
    sector: "바이오",
    capTier: "M",
    symbol: "196170",
    name: "알테오젠",
    price: 312500,
    ret1m: 0.031,
    ret3m: 0.074,
    turnover1m: 2_250_000_000,
    turnover3m: 6_100_000_000,
    turnoverAccel: 1.52,
    breakPrevHigh: true,
    atrLike: 0.034,
    spreadBps: 18,
    tradeIntensity: 1.33
  },
  {
    market: "KOSDAQ",
    sector: "반도체장비",
    capTier: "M",
    symbol: "240810",
    name: "원익IPS",
    price: 39650,
    ret1m: 0.018,
    ret3m: 0.043,
    turnover1m: 760_000_000,
    turnover3m: 2_050_000_000,
    turnoverAccel: 1.31,
    breakPrevHigh: true,
    atrLike: 0.026,
    spreadBps: 15,
    tradeIntensity: 1.12
  },
  {
    market: "KOSDAQ",
    sector: "반도체장비",
    capTier: "M",
    symbol: "039030",
    name: "이오테크닉스",
    price: 179200,
    ret1m: -0.004,
    ret3m: 0.019,
    turnover1m: 510_000_000,
    turnover3m: 1_400_000_000,
    turnoverAccel: 1.05,
    breakPrevHigh: false,
    atrLike: 0.022,
    spreadBps: 19,
    tradeIntensity: 0.92
  },
  {
    market: "KOSDAQ",
    sector: "게임",
    capTier: "M",
    symbol: "251270",
    name: "넷마블",
    price: 62400,
    ret1m: -0.012,
    ret3m: 0.004,
    turnover1m: 480_000_000,
    turnover3m: 1_280_000_000,
    turnoverAccel: 0.98,
    breakPrevHigh: false,
    atrLike: 0.027,
    spreadBps: 18,
    tradeIntensity: 0.88
  },
  {
    market: "KOSDAQ",
    sector: "게임",
    capTier: "S",
    symbol: "263750",
    name: "펄어비스",
    price: 34800,
    ret1m: 0.014,
    ret3m: 0.022,
    turnover1m: 420_000_000,
    turnover3m: 1_150_000_000,
    turnoverAccel: 1.14,
    breakPrevHigh: false,
    atrLike: 0.03,
    spreadBps: 21,
    tradeIntensity: 1.0
  },
  {
    market: "KOSDAQ",
    sector: "로봇",
    capTier: "S",
    symbol: "454910",
    name: "두산로보틱스",
    price: 65300,
    ret1m: 0.027,
    ret3m: 0.058,
    turnover1m: 1_020_000_000,
    turnover3m: 2_850_000_000,
    turnoverAccel: 1.47,
    breakPrevHigh: true,
    atrLike: 0.041,
    spreadBps: 24,
    tradeIntensity: 1.29
  },
  {
    market: "KOSDAQ",
    sector: "로봇",
    capTier: "S",
    symbol: "277810",
    name: "레인보우로보틱스",
    price: 164700,
    ret1m: 0.022,
    ret3m: 0.049,
    turnover1m: 910_000_000,
    turnover3m: 2_430_000_000,
    turnoverAccel: 1.39,
    breakPrevHigh: true,
    atrLike: 0.038,
    spreadBps: 22,
    tradeIntensity: 1.22
  }
];

function round(value: number, digits = 2): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function capTierWeight(tier: CapTier): number {
  if (tier === "L") return 6;
  if (tier === "M") return 4;
  return 2;
}

function inferCapTierFromTurnover(turnover1m: number): CapTier {
  if (turnover1m >= 1_500_000_000) return "L";
  if (turnover1m >= 700_000_000) return "M";
  return "S";
}

function mapRankingRowToUniverseItem(
  market: MarketCode,
  row: CollectorRankingRow,
  rank: number
): UniverseItem {
  const ret1m = row.changePct / 100;
  const turnover1m = Math.max(120_000_000, Math.round(row.turnover / 240));
  const turnover3m = Math.max(turnover1m * 3, Math.round(row.turnover / 80));
  const turnoverAccel = Math.max(
    0.85,
    Math.min(2.5, 1 + Math.abs(ret1m) * 10 + Math.max(0, 6 - rank) * 0.04)
  );
  const atrLike = Math.max(0.01, Math.min(0.09, 0.015 + Math.abs(ret1m) * 2.2));
  const spreadBps = Math.max(6, Math.min(45, 8 + rank * 2));

  return {
    market,
    sector: "실시간랭킹",
    capTier: inferCapTierFromTurnover(turnover1m),
    symbol: row.symbol,
    name: row.name || row.symbol,
    price: row.price,
    ret1m,
    ret3m: ret1m * 1.7,
    turnover1m,
    turnover3m,
    turnoverAccel,
    breakPrevHigh: ret1m >= 0.01,
    atrLike,
    spreadBps,
    tradeIntensity: Math.max(0.7, Math.min(1.8, 1 + ret1m * 10))
  };
}

function pruneReplayPoints(points: ReplayPoint[], nowMs: number): ReplayPoint[] {
  const cutoff = nowMs - REPLAY_WINDOW_MS;
  return points.filter((point) => point.timestampMs >= cutoff).slice(-REPLAY_TIMELINE_LIMIT);
}

function recordReplayPoints(items: HotListItem[], nowIso: string): void {
  const nowMs = Date.parse(nowIso);
  for (const item of items) {
    const existing = replayBySymbol.get(item.symbol) ?? [];
    const next: ReplayPoint = {
      at: nowIso,
      timestampMs: nowMs,
      price: item.price,
      score: item.score,
      ret1m: item.ret1m,
      turnover1m: item.turnover1m,
      red: item.red
    };
    replayBySymbol.set(item.symbol, pruneReplayPoints([...existing, next], nowMs));
  }
}

function getReplayPoints(symbol: string, nowMs = Date.now()): ReplayPoint[] {
  const existing = replayBySymbol.get(symbol);
  if (!existing) return [];
  const pruned = pruneReplayPoints(existing, nowMs);
  replayBySymbol.set(symbol, pruned);
  return pruned;
}

function buildEntryPanel(
  dataset: RadarDataset,
  hotList: HotListItem[],
  marketState: MarketState,
  generatedAtIso: string
): EntryPanel | null {
  const lead = hotList[0];
  if (!lead) return null;

  const source = dataset.universe.find((item) => item.symbol === lead.symbol);
  const state = liveSession?.symbolStates.get(lead.symbol);
  const prices = state?.trades.map((trade) => trade.price) ?? [];
  const shortHigh = prices.length > 0 ? Math.max(...prices.slice(-20)) : lead.price * 1.004;
  const recentHigh = prices.length > 0 ? Math.max(...prices) : lead.price * 1.008;
  const atrLike = source?.atrLike ?? 0.02;
  const support = Math.max(1, lead.price * (1 - Math.max(0.004, atrLike * 0.8)));
  const resistance = lead.price * (1 + Math.max(0.006, atrLike * 0.9));
  const stopLoss = Math.max(1, lead.price * (1 - Math.max(0.006, atrLike)));
  const takeProfit = lead.price * (1 + Math.max(0.011, atrLike * 1.5));
  const tags = new Set(lead.tags);

  const checklist: EntryChecklistItem[] = [
    {
      id: "surge",
      label: "급등 트리거(SURGE_30S/1M)",
      ok: tags.has("SURGE_30S") || tags.has("SURGE_1M")
    },
    {
      id: "tradeable",
      label: "체결 가능성(TRADEABLE)",
      ok: tags.has("TRADEABLE")
    },
    {
      id: "breakout",
      label: "돌파 유지(BREAKOUT + 양수익률)",
      ok: tags.has("BREAKOUT") && lead.ret1m > 0
    },
    {
      id: "risk",
      label: "과확장/되밀림 경고 없음",
      ok: !tags.has("OVEREXT") && !tags.has("REVERSAL_RISK")
    },
    {
      id: "market",
      label: "시장 레짐 역풍 아님",
      ok: marketState !== "TREND_DOWN"
    }
  ];

  const timeline = getReplayPoints(lead.symbol, Date.parse(generatedAtIso))
    .slice(-24)
    .map((point) => ({
      at: point.at,
      price: point.price,
      score: point.score,
      red: point.red
    }));

  return {
    symbol: lead.symbol,
    name: lead.name,
    price: lead.price,
    shortHigh: round(shortHigh, 0),
    recentHigh: round(recentHigh, 0),
    support: round(support, 0),
    resistance: round(resistance, 0),
    stopLoss: round(stopLoss, 0),
    takeProfit: round(takeProfit, 0),
    checklist,
    timeline
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", (error) => {
      reject(error);
    });
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeJournalSide(value: unknown): JournalSide {
  return value === "SELL" ? "SELL" : "BUY";
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(payload));
}

async function tryLoadCollectorDataset(
  collectorStatus: CollectorProbeStatus
): Promise<RadarDataset | null> {
  if (!isLiveCollectorMode(collectorStatus.mode) || !collectorStatus.authConnected) {
    return null;
  }

  try {
    const session = await ensureLiveCollectorSession(collectorStatus.mode);
    const scannedUniverse = await refreshLiveUniverse(session);
    const universe = mergeRealtimeIntoUniverse(scannedUniverse, session);

    if (universe.length < 8) return null;

    return { source: collectorStatus.mode, universe };
  } catch {
    return null;
  }
}

async function resolveRadarDataset(
  collectorStatus: CollectorProbeStatus
): Promise<RadarDataset> {
  if (!isLiveCollectorMode(collectorStatus.mode)) {
    await teardownLiveCollectorSession();
  }

  const collected = await tryLoadCollectorDataset(collectorStatus);
  if (collected) return collected;

  return {
    source: "mock",
    universe: mockUniverse
  };
}

function buildResponse(dataset: RadarDataset, collectorStatus: CollectorProbeStatus) {
  const rows = dataset.universe
    .map((item) => {
      const row = buildRadarRow(item);
      return { ...row, market: item.market, sector: item.sector, capTier: item.capTier };
    })
    .sort((a, b) => b.score - a.score || b.metrics.turnover1m - a.metrics.turnover1m);
  const hotList = rows.slice(0, 8).map((row, rank) => ({
    rank: rank + 1,
    symbol: row.symbol,
    name: row.name,
    score: row.score,
    price: row.price,
    tags: row.tags,
    ret1m: row.metrics.ret1m,
    turnover1m: row.metrics.turnover1m,
    red: row.score >= 70 && row.tags.some((tag) => tag === "SURGE_1M" || tag === "BREAKOUT")
  }));

  const rowMap = new Map(rows.map((row) => [row.symbol, row]));

  const markets: MarketBoard[] = (["KOSPI", "KOSDAQ"] as const).map((marketCode) => {
    const items = dataset.universe.filter((item) => item.market === marketCode);
    const sectors = [...new Set(items.map((item) => item.sector))].map((sectorName) => {
      const sectorItems = items.filter((item) => item.sector === sectorName);
      const members = sectorItems
        .map((item) => {
          const row = rowMap.get(item.symbol);
          if (!row) return null;

          const member: MarketBoardMember = {
            symbol: row.symbol,
            name: row.name,
            price: row.price,
            score: row.score,
            ret1m: row.metrics.ret1m,
            turnover1m: row.metrics.turnover1m,
            tags: [...row.tags],
            weight: capTierWeight(item.capTier)
          };

          return member;
        })
        .filter((member): member is MarketBoardMember => member !== null)
        .sort((a, b) => b.turnover1m - a.turnover1m);

      const totalTurnover1m = members.reduce((sum, member) => sum + member.turnover1m, 0);
      const avgScore = members.reduce((sum, member) => sum + member.score, 0) / Math.max(members.length, 1);
      const avgRet1m = members.reduce((sum, member) => sum + member.ret1m, 0) / Math.max(members.length, 1);

      const sector: MarketBoardSector = {
        name: sectorName,
        avgScore: round(avgScore, 1),
        avgRet1m: round(avgRet1m, 4),
        totalTurnover1m,
        members
      };

      return sector;
    });

    sectors.sort(
      (a, b) =>
        b.avgRet1m - a.avgRet1m ||
        b.avgScore - a.avgScore ||
        b.totalTurnover1m - a.totalTurnover1m
    );

    const allMembers = sectors.flatMap((sector) => sector.members);
    const totalTurnover1m = allMembers.reduce((sum, member) => sum + member.turnover1m, 0);
    const avgScore = allMembers.reduce((sum, member) => sum + member.score, 0) / Math.max(allMembers.length, 1);
    const weightedIndexMove =
      allMembers.reduce((sum, member) => sum + member.ret1m * member.turnover1m, 0) /
      Math.max(totalTurnover1m, 1);

    const market: MarketBoard = {
      code: marketCode,
      name: marketCode === "KOSPI" ? "코스피" : "코스닥",
      indexChangePct: round(weightedIndexMove, 4),
      avgScore: round(avgScore, 1),
      advancers: allMembers.filter((member) => member.ret1m > 0).length,
      decliners: allMembers.filter((member) => member.ret1m < 0).length,
      totalTurnover1m,
      sectors
    };

    return market;
  });

  const marketState: MarketState =
    dataset.source === "mock" ? "CHOP" : deriveMarketState(dataset.universe);
  const generatedAt = new Date().toISOString();
  latestHotList = hotList;
  recordReplayPoints(hotList, generatedAt);
  const entryPanel = buildEntryPanel(dataset, hotList, marketState, generatedAt);

  return {
    marketState,
    source: dataset.source,
    collector: {
      ...collectorStatus,
      dataSource: dataset.source
    },
    tracking: {
      candidatePoolSize: dataset.universe.length,
      trackedCount: liveSession?.trackedTradeSymbols.size ?? 0,
      bufferedSymbols: liveSession?.symbolStates.size ?? 0,
      windowSec: REALTIME_WINDOW_MS / 1000
    },
    generatedAt,
    hotList,
    entryPanel,
    rows: rows.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      price: row.price,
      score: row.score,
      tags: row.tags,
      metrics: row.metrics
    })),
    markets
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    res.end();
    return;
  }

  const reqUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (reqUrl.pathname === "/health") {
    const collector = await ensureCollectorProbeStatus();
    writeJson(res, 200, { ok: true, service: "api", collector });
    return;
  }

  if (reqUrl.pathname === "/api/radar") {
    const collector = await ensureCollectorProbeStatus();
    const dataset = await resolveRadarDataset(collector);
    writeJson(res, 200, buildResponse(dataset, collector));
    return;
  }

  if (reqUrl.pathname === "/api/replay" && req.method === "GET") {
    const symbol = reqUrl.searchParams.get("symbol") ?? latestHotList[0]?.symbol ?? "";
    if (!symbol) {
      writeJson(res, 400, { error: "Missing symbol" });
      return;
    }
    const points = getReplayPoints(symbol).map((point) => ({
      at: point.at,
      price: point.price,
      score: point.score,
      ret1m: point.ret1m,
      turnover1m: point.turnover1m,
      red: point.red
    }));
    writeJson(res, 200, { symbol, windowSec: REPLAY_WINDOW_MS / 1000, points });
    return;
  }

  if (reqUrl.pathname === "/api/journal" && req.method === "GET") {
    writeJson(res, 200, { entries: journalEntries });
    return;
  }

  if (reqUrl.pathname === "/api/journal" && req.method === "POST") {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      writeJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    if (!isObject(body)) {
      writeJson(res, 400, { error: "Invalid payload" });
      return;
    }

    const symbolRaw = body.symbol;
    if (typeof symbolRaw !== "string" || symbolRaw.trim().length === 0) {
      writeJson(res, 400, { error: "symbol is required" });
      return;
    }

    const entry: JournalEntry = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      symbol: symbolRaw.trim(),
      side: normalizeJournalSide(body.side),
      price: Math.max(0, toFiniteNumber(body.price)),
      quantity: Math.max(1, Math.round(toFiniteNumber(body.quantity, 1))),
      note: typeof body.note === "string" ? body.note.slice(0, 240) : "",
      createdAt: new Date().toISOString()
    };

    journalEntries.unshift(entry);
    if (journalEntries.length > JOURNAL_LIMIT) {
      journalEntries.splice(JOURNAL_LIMIT);
    }

    writeJson(res, 201, { ok: true, entry, entries: journalEntries });
    return;
  }

  writeJson(res, 404, { error: "Not found" });
}

const server = createServer((req, res) => {
  void handleRequest(req, res).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    writeJson(res, 500, { error: "Internal server error", message });
  });
});

server.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
