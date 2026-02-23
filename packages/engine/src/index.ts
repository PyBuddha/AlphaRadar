export type RadarTag =
  | "SURGE_VOL"
  | "SURGE_PRICE"
  | "BREAKOUT"
  | "PULLBACK"
  | "ABSORB"
  | "THIN_ASK"
  | "THEME_SYNC"
  | "RISK_SPIKE";

export type EngineInputSnapshot = {
  symbol: string;
  name: string;
  price: number;
  ret1m: number;
  ret3m: number;
  turnover1m: number;
  turnover3m: number;
  turnoverAccel: number;
  breakPrevHigh: boolean;
  atrLike: number;
  spreadBps?: number;
  tradeIntensity?: number;
};

export type RadarRow = {
  symbol: string;
  name: string;
  price: number;
  score: number;
  tags: RadarTag[];
  metrics: {
    ret1m: number;
    ret3m: number;
    turnover1m: number;
    turnover3m: number;
    turnoverAccel: number;
  };
};

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeRatio(value: number, threshold: number, cap: number): number {
  if (threshold <= 0 || cap <= threshold) return 0;
  const scaled = (value - threshold) / (cap - threshold);
  return clamp01(scaled);
}

function scoreMomentum(input: EngineInputSnapshot): number {
  const ret1m = normalizeRatio(input.ret1m, 0.005, 0.05);
  const ret3m = normalizeRatio(input.ret3m, 0.01, 0.08);
  const accel = normalizeRatio(input.turnoverAccel, 1.05, 2.5);
  return Math.round((ret1m * 0.45 + ret3m * 0.35 + accel * 0.2) * 40);
}

function scoreLiquidity(input: EngineInputSnapshot): number {
  const t1 = normalizeRatio(input.turnover1m, 300_000_000, 5_000_000_000);
  const t3 = normalizeRatio(input.turnover3m, 900_000_000, 15_000_000_000);
  const spreadPenalty = input.spreadBps ? clamp01((input.spreadBps - 20) / 50) : 0;
  const raw = t1 * 0.6 + t3 * 0.4;
  return Math.round(clamp01(raw - spreadPenalty * 0.3) * 25);
}

function scoreBreakout(input: EngineInputSnapshot): number {
  const breakout = input.breakPrevHigh ? 1 : 0;
  const volatilityPenalty = clamp01((input.atrLike - 0.06) / 0.12);
  return Math.round(clamp01(breakout - volatilityPenalty * 0.35) * 20);
}

export function deriveTags(input: EngineInputSnapshot): RadarTag[] {
  const tags: RadarTag[] = [];

  if (input.turnoverAccel >= 1.25 || input.turnover1m >= 1_000_000_000) {
    tags.push("SURGE_VOL");
  }

  if (input.ret1m >= 0.015 || input.ret3m >= 0.03) {
    tags.push("SURGE_PRICE");
  }

  if (input.breakPrevHigh) {
    tags.push("BREAKOUT");
  }

  if ((input.spreadBps ?? 0) >= 45 || input.atrLike >= 0.08) {
    tags.push("RISK_SPIKE");
  }

  return tags;
}

export function scoreSymbol(input: EngineInputSnapshot): number {
  const s1 = scoreMomentum(input);
  const s2 = scoreLiquidity(input);
  const s3 = scoreBreakout(input);
  return Math.max(0, Math.min(100, s1 + s2 + s3));
}

export function buildRadarRow(input: EngineInputSnapshot): RadarRow {
  return {
    symbol: input.symbol,
    name: input.name,
    price: input.price,
    score: scoreSymbol(input),
    tags: deriveTags(input),
    metrics: {
      ret1m: input.ret1m,
      ret3m: input.ret3m,
      turnover1m: input.turnover1m,
      turnover3m: input.turnover3m,
      turnoverAccel: input.turnoverAccel
    }
  };
}

