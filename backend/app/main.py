from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.config import get_settings
from app.schemas import HealthResponse


settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
  CORSMiddleware,
  allow_origins=settings.cors_allow_origins,
  allow_credentials=False,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
  return HealthResponse(ok=True, service="api")


app.include_router(api_router)

