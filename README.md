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

## Current Status

- `apps/api`: Node mock API with `GET /health` and `GET /api/radar`
- `apps/web`: Next.js dashboard UI (calls radar API with local mock fallback)
- `backend`: FastAPI mock API scaffold with matching endpoints for migration

## FastAPI Backend (parallel)

The Python backend is intentionally separate so the frontend can migrate without blocking on a full rewrite.

Default port is `4001` to avoid conflict with the existing Node mock API on `4000`.

Example endpoints:

- `http://localhost:4001/health`
- `http://localhost:4001/api/radar`
