export type RadarTag =
  | "SURGE_30S"
  | "SURGE_1M"
  | "BREAKOUT"
  | "TRADEABLE"
  | "OVEREXT"
  | "REVERSAL_RISK";

export type MarketState = "CHOP" | "TREND_UP" | "TREND_DOWN" | "HIGH_VOL";

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

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function estimateRet30s(input: EngineInputSnapshot): number {
  const intensity = input.tradeIntensity ?? 1;
  const weight = clamp(0.45 + (intensity - 0.8) * 0.33, 0.35, 0.9);
  return input.ret1m * weight;
}

function overextSignal(input: EngineInputSnapshot): number {
  const byReturn = normalizeRatio(input.ret1m, 0.04, 0.12);
  const byVol = normalizeRatio(input.atrLike, 0.045, 0.12);
  return Math.max(byReturn, byVol);
}

function reversalSignal(input: EngineInputSnapshot): number {
  const downMove = normalizeRatio(-input.ret1m, 0.003, 0.03);
  const weakTape = normalizeRatio(1 - (input.tradeIntensity ?? 1), 0.05, 0.55);
  const noisy = normalizeRatio(input.atrLike, 0.03, 0.1);
  return clamp01(downMove * 0.55 + weakTape * 0.25 + noisy * 0.2);
}

function tradeableSignal(input: EngineInputSnapshot): number {
  const turnover = normalizeRatio(input.turnover1m, 400_000_000, 8_000_000_000);
  const accel = normalizeRatio(input.turnoverAccel, 1.0, 2.5);
  const intensity = normalizeRatio(input.tradeIntensity ?? 1, 0.9, 2.0);
  const spreadPenalty = input.spreadBps ? normalizeRatio(input.spreadBps, 18, 60) : 0;
  return clamp01(turnover * 0.6 + accel * 0.2 + intensity * 0.2 - spreadPenalty * 0.35);
}

function scoreSurge(input: EngineInputSnapshot): number {
  const ret30s = normalizeRatio(estimateRet30s(input), 0.004, 0.04);
  const ret1m = normalizeRatio(input.ret1m, 0.007, 0.06);
  const accel = normalizeRatio(input.turnoverAccel, 1.08, 2.8);
  const breakout = input.breakPrevHigh ? 1 : 0;
  return Math.round(clamp01(ret30s * 0.35 + ret1m * 0.35 + accel * 0.2 + breakout * 0.1) * 60);
}

function scoreTradeable(input: EngineInputSnapshot): number {
  return Math.round(tradeableSignal(input) * 25);
}

function scoreRiskPenalty(input: EngineInputSnapshot): number {
  const risk = clamp01(overextSignal(input) * 0.55 + reversalSignal(input) * 0.45);
  return Math.round(risk * 15);
}

export function deriveTags(input: EngineInputSnapshot): RadarTag[] {
  const tags: RadarTag[] = [];
  const ret30s = estimateRet30s(input);
  const tradeable = tradeableSignal(input);
  const overext = overextSignal(input);
  const reversal = reversalSignal(input);

  if (ret30s >= 0.004) {
    tags.push("SURGE_30S");
  }

  if (input.ret1m >= 0.007) {
    tags.push("SURGE_1M");
  }

  if (input.breakPrevHigh) {
    tags.push("BREAKOUT");
  }

  if (tradeable >= 0.5) {
    tags.push("TRADEABLE");
  }

  if (overext >= 0.55) {
    tags.push("OVEREXT");
  }

  if (reversal >= 0.5) {
    tags.push("REVERSAL_RISK");
  }

  return tags;
}

export function scoreSymbol(input: EngineInputSnapshot): number {
  const surge = scoreSurge(input);
  const tradeable = scoreTradeable(input);
  const riskPenalty = scoreRiskPenalty(input);
  return Math.max(0, Math.min(100, surge + tradeable - riskPenalty));
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

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => {
    const diff = value - avg;
    return sum + diff * diff;
  }, 0) / values.length;
  return Math.sqrt(variance);
}

export function deriveMarketState(inputs: Pick<EngineInputSnapshot, "ret1m">[]): MarketState {
  if (inputs.length === 0) return "CHOP";

  const returns = inputs.map((input) => input.ret1m);
  const avgReturn = mean(returns);
  const volatility = stdDev(returns);
  const advancers = returns.filter((value) => value > 0).length;
  const decliners = returns.filter((value) => value < 0).length;
  const breadth = (advancers - decliners) / returns.length;

  if (volatility >= 0.02 && Math.abs(breadth) < 0.35) {
    return "HIGH_VOL";
  }

  if (avgReturn >= 0.004 && breadth >= 0.2) {
    return "TREND_UP";
  }

  if (avgReturn <= -0.004 && breadth <= -0.2) {
    return "TREND_DOWN";
  }

  return "CHOP";
}
