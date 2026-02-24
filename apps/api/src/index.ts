import { createServer } from "node:http";
import { buildRadarRow, type EngineInputSnapshot } from "@alpharadar/engine";

type MarketCode = "KOSPI" | "KOSDAQ";
type CapTier = "L" | "M" | "S";

type UniverseItem = EngineInputSnapshot & {
  market: MarketCode;
  sector: string;
  capTier: CapTier;
};

type MarketBoardMember = {
  symbol: string;
  name: string;
  price: number;
  score: number;
  ret1m: number;
  turnover1m: number;
  tags: string[];
  weight: number;
};

type MarketBoardSector = {
  name: string;
  avgScore: number;
  avgRet1m: number;
  totalTurnover1m: number;
  members: MarketBoardMember[];
};

type MarketBoard = {
  code: MarketCode;
  name: string;
  indexChangePct: number;
  avgScore: number;
  advancers: number;
  decliners: number;
  totalTurnover1m: number;
  sectors: MarketBoardSector[];
};

const port = Number(process.env.PORT ?? 4000);

const mockUniverse: UniverseItem[] = [
  {
    market: "KOSPI",
    sector: "반도체",
    capTier: "L",
    symbol: "005930",
    name: "삼성전자",
    price: 71200,
    ret1m: 0.011,
    ret3m: 0.038,
    turnover1m: 3_400_000_000,
    turnover3m: 8_900_000_000,
    turnoverAccel: 1.28,
    breakPrevHigh: true,
    atrLike: 0.017,
    spreadBps: 8,
    tradeIntensity: 1.18
  },
  {
    market: "KOSPI",
    sector: "반도체",
    capTier: "L",
    symbol: "000660",
    name: "SK하이닉스",
    price: 189500,
    ret1m: 0.024,
    ret3m: 0.061,
    turnover1m: 4_800_000_000,
    turnover3m: 12_700_000_000,
    turnoverAccel: 1.44,
    breakPrevHigh: true,
    atrLike: 0.023,
    spreadBps: 10,
    tradeIntensity: 1.26
  },
  {
    market: "KOSPI",
    sector: "2차전지",
    capTier: "L",
    symbol: "373220",
    name: "LG에너지솔루션",
    price: 392000,
    ret1m: -0.007,
    ret3m: 0.016,
    turnover1m: 2_600_000_000,
    turnover3m: 7_200_000_000,
    turnoverAccel: 1.11,
    breakPrevHigh: false,
    atrLike: 0.031,
    spreadBps: 14,
    tradeIntensity: 0.94
  },
  {
    market: "KOSPI",
    sector: "2차전지",
    capTier: "M",
    symbol: "006400",
    name: "삼성SDI",
    price: 319500,
    ret1m: 0.009,
    ret3m: 0.025,
    turnover1m: 1_850_000_000,
    turnover3m: 4_900_000_000,
    turnoverAccel: 1.21,
    breakPrevHigh: false,
    atrLike: 0.028,
    spreadBps: 16,
    tradeIntensity: 1.02
  },
  {
    market: "KOSPI",
    sector: "자동차",
    capTier: "L",
    symbol: "005380",
    name: "현대차",
    price: 248500,
    ret1m: 0.015,
    ret3m: 0.034,
    turnover1m: 1_950_000_000,
    turnover3m: 5_400_000_000,
    turnoverAccel: 1.18,
    breakPrevHigh: true,
    atrLike: 0.019,
    spreadBps: 12,
    tradeIntensity: 1.08
  },
  {
    market: "KOSPI",
    sector: "자동차",
    capTier: "M",
    symbol: "000270",
    name: "기아",
    price: 112000,
    ret1m: 0.013,
    ret3m: 0.029,
    turnover1m: 1_430_000_000,
    turnover3m: 3_900_000_000,
    turnoverAccel: 1.16,
    breakPrevHigh: true,
    atrLike: 0.018,
    spreadBps: 11,
    tradeIntensity: 1.04
  },
  {
    market: "KOSPI",
    sector: "금융",
    capTier: "M",
    symbol: "055550",
    name: "신한지주",
    price: 49300,
    ret1m: 0.006,
    ret3m: 0.018,
    turnover1m: 690_000_000,
    turnover3m: 2_200_000_000,
    turnoverAccel: 1.07,
    breakPrevHigh: false,
    atrLike: 0.012,
    spreadBps: 9,
    tradeIntensity: 0.96
  },
  {
    market: "KOSPI",
    sector: "금융",
    capTier: "M",
    symbol: "105560",
    name: "KB금융",
    price: 87800,
    ret1m: 0.008,
    ret3m: 0.021,
    turnover1m: 880_000_000,
    turnover3m: 2_700_000_000,
    turnoverAccel: 1.1,
    breakPrevHigh: false,
    atrLike: 0.014,
    spreadBps: 10,
    tradeIntensity: 0.99
  },
  {
    market: "KOSDAQ",
    sector: "바이오",
    capTier: "L",
    symbol: "068270",
    name: "셀트리온",
    price: 189000,
    ret1m: 0.012,
    ret3m: 0.027,
    turnover1m: 1_540_000_000,
    turnover3m: 4_300_000_000,
    turnoverAccel: 1.22,
    breakPrevHigh: false,
    atrLike: 0.024,
    spreadBps: 13,
    tradeIntensity: 1.01
  },
  {
    market: "KOSDAQ",
    sector: "바이오",
    capTier: "M",
    symbol: "196170",
    name: "알테오젠",
    price: 312500,
    ret1m: 0.031,
    ret3m: 0.074,
    turnover1m: 2_250_000_000,
    turnover3m: 6_100_000_000,
    turnoverAccel: 1.52,
    breakPrevHigh: true,
    atrLike: 0.034,
    spreadBps: 18,
    tradeIntensity: 1.33
  },
  {
    market: "KOSDAQ",
    sector: "반도체장비",
    capTier: "M",
    symbol: "240810",
    name: "원익IPS",
    price: 39650,
    ret1m: 0.018,
    ret3m: 0.043,
    turnover1m: 760_000_000,
    turnover3m: 2_050_000_000,
    turnoverAccel: 1.31,
    breakPrevHigh: true,
    atrLike: 0.026,
    spreadBps: 15,
    tradeIntensity: 1.12
  },
  {
    market: "KOSDAQ",
    sector: "반도체장비",
    capTier: "M",
    symbol: "039030",
    name: "이오테크닉스",
    price: 179200,
    ret1m: -0.004,
    ret3m: 0.019,
    turnover1m: 510_000_000,
    turnover3m: 1_400_000_000,
    turnoverAccel: 1.05,
    breakPrevHigh: false,
    atrLike: 0.022,
    spreadBps: 19,
    tradeIntensity: 0.92
  },
  {
    market: "KOSDAQ",
    sector: "게임",
    capTier: "M",
    symbol: "251270",
    name: "넷마블",
    price: 62400,
    ret1m: -0.012,
    ret3m: 0.004,
    turnover1m: 480_000_000,
    turnover3m: 1_280_000_000,
    turnoverAccel: 0.98,
    breakPrevHigh: false,
    atrLike: 0.027,
    spreadBps: 18,
    tradeIntensity: 0.88
  },
  {
    market: "KOSDAQ",
    sector: "게임",
    capTier: "S",
    symbol: "263750",
    name: "펄어비스",
    price: 34800,
    ret1m: 0.014,
    ret3m: 0.022,
    turnover1m: 420_000_000,
    turnover3m: 1_150_000_000,
    turnoverAccel: 1.14,
    breakPrevHigh: false,
    atrLike: 0.03,
    spreadBps: 21,
    tradeIntensity: 1.0
  },
  {
    market: "KOSDAQ",
    sector: "로봇",
    capTier: "S",
    symbol: "454910",
    name: "두산로보틱스",
    price: 65300,
    ret1m: 0.027,
    ret3m: 0.058,
    turnover1m: 1_020_000_000,
    turnover3m: 2_850_000_000,
    turnoverAccel: 1.47,
    breakPrevHigh: true,
    atrLike: 0.041,
    spreadBps: 24,
    tradeIntensity: 1.29
  },
  {
    market: "KOSDAQ",
    sector: "로봇",
    capTier: "S",
    symbol: "277810",
    name: "레인보우로보틱스",
    price: 164700,
    ret1m: 0.022,
    ret3m: 0.049,
    turnover1m: 910_000_000,
    turnover3m: 2_430_000_000,
    turnoverAccel: 1.39,
    breakPrevHigh: true,
    atrLike: 0.038,
    spreadBps: 22,
    tradeIntensity: 1.22
  }
];

function round(value: number, digits = 2): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function capTierWeight(tier: CapTier): number {
  if (tier === "L") return 6;
  if (tier === "M") return 4;
  return 2;
}

function buildResponse() {
  const rows = mockUniverse
    .map((item) => {
      const row = buildRadarRow(item);
      return { ...row, market: item.market, sector: item.sector, capTier: item.capTier };
    })
    .sort((a, b) => b.score - a.score || b.metrics.turnover1m - a.metrics.turnover1m);

  const rowMap = new Map(rows.map((row) => [row.symbol, row]));

  const markets: MarketBoard[] = (["KOSPI", "KOSDAQ"] as const).map((marketCode) => {
    const items = mockUniverse.filter((item) => item.market === marketCode);
    const sectors = [...new Set(items.map((item) => item.sector))].map((sectorName) => {
      const sectorItems = items.filter((item) => item.sector === sectorName);
      const members = sectorItems
        .map((item) => {
          const row = rowMap.get(item.symbol);
          if (!row) return null;

          const member: MarketBoardMember = {
            symbol: row.symbol,
            name: row.name,
            price: row.price,
            score: row.score,
            ret1m: row.metrics.ret1m,
            turnover1m: row.metrics.turnover1m,
            tags: [...row.tags],
            weight: capTierWeight(item.capTier)
          };

          return member;
        })
        .filter((member): member is MarketBoardMember => member !== null)
        .sort((a, b) => b.turnover1m - a.turnover1m);

      const totalTurnover1m = members.reduce((sum, member) => sum + member.turnover1m, 0);
      const avgScore = members.reduce((sum, member) => sum + member.score, 0) / Math.max(members.length, 1);
      const avgRet1m = members.reduce((sum, member) => sum + member.ret1m, 0) / Math.max(members.length, 1);

      const sector: MarketBoardSector = {
        name: sectorName,
        avgScore: round(avgScore, 1),
        avgRet1m: round(avgRet1m, 4),
        totalTurnover1m,
        members
      };

      return sector;
    });

    sectors.sort((a, b) => b.totalTurnover1m - a.totalTurnover1m);

    const allMembers = sectors.flatMap((sector) => sector.members);
    const totalTurnover1m = allMembers.reduce((sum, member) => sum + member.turnover1m, 0);
    const avgScore = allMembers.reduce((sum, member) => sum + member.score, 0) / Math.max(allMembers.length, 1);
    const weightedIndexMove =
      allMembers.reduce((sum, member) => sum + member.ret1m * member.turnover1m, 0) /
      Math.max(totalTurnover1m, 1);

    const market: MarketBoard = {
      code: marketCode,
      name: marketCode === "KOSPI" ? "코스피" : "코스닥",
      indexChangePct: round(weightedIndexMove, 4),
      avgScore: round(avgScore, 1),
      advancers: allMembers.filter((member) => member.ret1m > 0).length,
      decliners: allMembers.filter((member) => member.ret1m < 0).length,
      totalTurnover1m,
      sectors
    };

    return market;
  });

  return {
    marketState: "TREND_UP",
    source: "mock",
    generatedAt: new Date().toISOString(),
    rows: rows.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      price: row.price,
      score: row.score,
      tags: row.tags,
      metrics: row.metrics
    })),
    markets
  };
}

const server = createServer((req, res) => {
  const reqUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (reqUrl.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, service: "api" }));
    return;
  }

  if (reqUrl.pathname === "/api/radar") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(buildResponse()));
    return;
  }

  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
