from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict, Literal


RadarTag = Literal[
  "SURGE_VOL",
  "SURGE_PRICE",
  "BREAKOUT",
  "PULLBACK",
  "ABSORB",
  "THIN_ASK",
  "THEME_SYNC",
  "RISK_SPIKE",
]


class RadarMetricsDict(TypedDict):
  ret1m: float
  ret3m: float
  turnover1m: float
  turnover3m: float
  turnoverAccel: float


class RadarRowDict(TypedDict):
  symbol: str
  name: str
  price: float
  score: int
  tags: list[RadarTag]
  metrics: RadarMetricsDict


@dataclass(frozen=True)
class EngineInputSnapshot:
  symbol: str
  name: str
  price: float
  ret1m: float
  ret3m: float
  turnover1m: float
  turnover3m: float
  turnoverAccel: float
  breakPrevHigh: bool
  atrLike: float
  spreadBps: float | None = None
  tradeIntensity: float | None = None


def _clamp01(value: float) -> float:
  if value <= 0:
    return 0.0
  if value >= 1:
    return 1.0
  return value


def _normalize_ratio(value: float, threshold: float, cap: float) -> float:
  if threshold <= 0 or cap <= threshold:
    return 0.0
  scaled = (value - threshold) / (cap - threshold)
  return _clamp01(scaled)


def _score_momentum(input_snapshot: EngineInputSnapshot) -> int:
  ret1m = _normalize_ratio(input_snapshot.ret1m, 0.005, 0.05)
  ret3m = _normalize_ratio(input_snapshot.ret3m, 0.01, 0.08)
  accel = _normalize_ratio(input_snapshot.turnoverAccel, 1.05, 2.5)
  return round((ret1m * 0.45 + ret3m * 0.35 + accel * 0.2) * 40)


def _score_liquidity(input_snapshot: EngineInputSnapshot) -> int:
  t1 = _normalize_ratio(input_snapshot.turnover1m, 300_000_000, 5_000_000_000)
  t3 = _normalize_ratio(input_snapshot.turnover3m, 900_000_000, 15_000_000_000)
  spread_penalty = (
    _clamp01((input_snapshot.spreadBps - 20) / 50)
    if input_snapshot.spreadBps is not None
    else 0.0
  )
  raw = t1 * 0.6 + t3 * 0.4
  return round(_clamp01(raw - spread_penalty * 0.3) * 25)


def _score_breakout(input_snapshot: EngineInputSnapshot) -> int:
  breakout = 1.0 if input_snapshot.breakPrevHigh else 0.0
  volatility_penalty = _clamp01((input_snapshot.atrLike - 0.06) / 0.12)
  return round(_clamp01(breakout - volatility_penalty * 0.35) * 20)


def derive_tags(input_snapshot: EngineInputSnapshot) -> list[RadarTag]:
  tags: list[RadarTag] = []

  if input_snapshot.turnoverAccel >= 1.25 or input_snapshot.turnover1m >= 1_000_000_000:
    tags.append("SURGE_VOL")

  if input_snapshot.ret1m >= 0.015 or input_snapshot.ret3m >= 0.03:
    tags.append("SURGE_PRICE")

  if input_snapshot.breakPrevHigh:
    tags.append("BREAKOUT")

  spread_bps = input_snapshot.spreadBps or 0.0
  if spread_bps >= 45 or input_snapshot.atrLike >= 0.08:
    tags.append("RISK_SPIKE")

  return tags


def score_symbol(input_snapshot: EngineInputSnapshot) -> int:
  score = (
    _score_momentum(input_snapshot)
    + _score_liquidity(input_snapshot)
    + _score_breakout(input_snapshot)
  )
  return max(0, min(100, score))


def build_radar_row(input_snapshot: EngineInputSnapshot) -> RadarRowDict:
  return {
    "symbol": input_snapshot.symbol,
    "name": input_snapshot.name,
    "price": input_snapshot.price,
    "score": score_symbol(input_snapshot),
    "tags": derive_tags(input_snapshot),
    "metrics": {
      "ret1m": input_snapshot.ret1m,
      "ret3m": input_snapshot.ret3m,
      "turnover1m": input_snapshot.turnover1m,
      "turnover3m": input_snapshot.turnover3m,
      "turnoverAccel": input_snapshot.turnoverAccel,
    },
  }

