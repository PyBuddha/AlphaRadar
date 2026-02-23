from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os


def _parse_csv(value: str | None, default: list[str]) -> list[str]:
  if value is None or not value.strip():
    return default
  return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
  app_name: str
  host: str
  port: int
  cors_allow_origins: list[str]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
  return Settings(
    app_name=os.getenv("APP_NAME", "Alpha Radar API"),
    host=os.getenv("HOST", "127.0.0.1"),
    port=int(os.getenv("PORT", "4001")),
    cors_allow_origins=_parse_csv(
      os.getenv("CORS_ALLOW_ORIGINS"),
      ["http://localhost:3000"]
    ),
  )

