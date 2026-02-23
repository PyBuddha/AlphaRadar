# Alpha Radar

Real-time momentum radar for short-term trading decisions.

## Monorepo Layout

- `apps/api`: API server for frontend and alert/event delivery
- `apps/web`: Next.js dashboard UI
- `packages/engine`: scoring, tagging, market state logic
- `packages/collector`: broker REST/WS collectors and symbol state updates

## Quick Start (after dependencies are installed)

```bash
npm install
npm run dev:api
npm run dev:web
```

