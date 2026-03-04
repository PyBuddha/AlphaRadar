# Alpha Radar

Real-time momentum radar for short-term trading decisions.

## Monorepo Layout

- `apps/api`: API server for frontend and alert/event delivery
- `apps/web`: Next.js dashboard UI
- `packages/engine`: scoring, tagging, market state logic
- `packages/collector`: broker REST/WS collectors and symbol state updates
- `backend`: FastAPI backend scaffold (parallel migration path)

## Quick Start (after dependencies are installed)

```bash
npm install
npm run dev:api
npm run dev:web
```

## Product Spec

- v0.2 working spec: `docs/alpha-radar-spec-v0.2.md`

## Current Status

- `apps/api`: Node mock API with `GET /health` and `GET /api/radar`
- `apps/api`: sector ordering now prioritizes average return (`avgRet1m`) with turnover as a tie-breaker
- `apps/api`: includes collector auth probe status in responses (`collector`) and falls back to mock rows when collector ranking data is unavailable
- `apps/api`: when `KIWOOM_MODE=paper|live` and collector ranking REST is available, radar rows/marketState are derived from collector ranking data (fallback remains mock)
- `packages/engine`: Score v0.2 logic applied (`Surge 0~60 + Tradeable 0~25 - Risk 0~15`) with MVP 6 tags (`SURGE_30S`, `SURGE_1M`, `BREAKOUT`, `TRADEABLE`, `OVEREXT`, `REVERSAL_RISK`)
- `apps/api`: adds explicit `hotList` (Top 8 + `red` flag) in `/api/radar` response for UI highlight wiring
- `apps/api`: adds `entryPanel` in `/api/radar`, plus phase-5 MVP endpoints `GET /api/replay?symbol=...` and `GET/POST /api/journal` (in-memory)
- `apps/web`: Next.js dashboard UI (calls radar API with local mock fallback)
- `apps/web`: RED 토스트/사운드 알림, Entry Panel 상세, 신호 리플레이(5분), 매매일지 입력/조회 UI 반영
- `backend`: FastAPI mock API scaffold with matching endpoints for migration

## FastAPI Backend (parallel)

The Python backend is intentionally separate so the frontend can migrate without blocking on a full rewrite.

Default port is `4001` to avoid conflict with the existing Node mock API on `4000`.

Example endpoints:

- `http://localhost:4001/health`
- `http://localhost:4001/api/radar`

## Kiwoom Integration Status

- `packages/collector` supports mock mode end-to-end
- Live/paper mode now supports OAuth token issuance, ranking REST calls (`/api/dostk/rkinfo` for turnover/volume/change), and websocket session connect/subscribe (`0B` trade, `0C` quote)
- If you use both paper/live credentials, set mode-specific envs like `KIWOOM_PAPER_APP_KEY` / `KIWOOM_LIVE_APP_KEY` (generic `KIWOOM_APP_KEY` remains fallback)
- Smoke test after setting envs (`KIWOOM_APP_KEY`, `KIWOOM_APP_SECRET`, optional `KIWOOM_MODE=paper|live`):

```bash
npm run smoke:auth -w @alpharadar/collector
```
