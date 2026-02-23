from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


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


class HealthResponse(BaseModel):
  ok: bool
  service: str


class RadarMetrics(BaseModel):
  ret1m: float
  ret3m: float
  turnover1m: float
  turnover3m: float
  turnoverAccel: float


class RadarRow(BaseModel):
  symbol: str
  name: str
  price: float
  score: int
  tags: list[RadarTag]
  metrics: RadarMetrics


class RadarResponse(BaseModel):
  marketState: str
  rows: list[RadarRow]

