import { createServer } from "node:http";
import { buildRadarRow, type EngineInputSnapshot } from "@alpharadar/engine";

const port = Number(process.env.PORT ?? 4000);

const mockSnapshot: EngineInputSnapshot = {
  symbol: "005930",
  name: "SAMPLE",
  price: 71200,
  ret1m: 0.023,
  ret3m: 0.041,
  turnover1m: 1_250_000_000,
  turnover3m: 2_700_000_000,
  turnoverAccel: 1.35,
  breakPrevHigh: true,
  atrLike: 0.018,
  spreadBps: 14,
  tradeIntensity: 1.08
};

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "api" }));
    return;
  }

  if (req.url === "/api/radar") {
    const row = buildRadarRow(mockSnapshot);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ marketState: "CHOP", rows: [row] }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
