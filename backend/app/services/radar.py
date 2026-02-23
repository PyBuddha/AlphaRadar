from __future__ import annotations

from app.domain.engine import EngineInputSnapshot, build_radar_row
from app.schemas import RadarResponse


def _mock_snapshot() -> EngineInputSnapshot:
  return EngineInputSnapshot(
    symbol="005930",
    name="SAMPLE",
    price=71200,
    ret1m=0.023,
    ret3m=0.041,
    turnover1m=1_250_000_000,
    turnover3m=2_700_000_000,
    turnoverAccel=1.35,
    breakPrevHigh=True,
    atrLike=0.018,
    spreadBps=14,
    tradeIntensity=1.08,
  )


def build_mock_radar_response() -> RadarResponse:
  row = build_radar_row(_mock_snapshot())
  return RadarResponse(marketState="CHOP", rows=[row])

