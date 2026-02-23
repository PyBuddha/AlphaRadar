from __future__ import annotations

from fastapi import APIRouter

from app.schemas import RadarResponse
from app.services.radar import build_mock_radar_response


router = APIRouter(prefix="/api", tags=["radar"])


@router.get("/radar", response_model=RadarResponse)
def get_radar() -> RadarResponse:
  return build_mock_radar_response()

