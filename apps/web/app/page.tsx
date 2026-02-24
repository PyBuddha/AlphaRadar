type RadarRow = {
  symbol: string;
  name: string;
  price: number;
  score: number;
  tags: string[];
  metrics: {
    ret1m: number;
    ret3m: number;
    turnover1m: number;
    turnover3m: number;
    turnoverAccel: number;
  };
};

type MarketTile = {
  symbol: string;
  name: string;
  price: number;
  score: number;
  ret1m: number;
  turnover1m: number;
  tags: string[];
  weight: number;
};

type SectorBox = {
  name: string;
  avgScore: number;
  avgRet1m: number;
  totalTurnover1m: number;
  members: MarketTile[];
};

type MarketBoard = {
  code: "KOSPI" | "KOSDAQ";
  name: string;
  indexChangePct: number;
  avgScore: number;
  advancers: number;
  decliners: number;
  totalTurnover1m: number;
  sectors: SectorBox[];
};

type RadarResponse = {
  marketState: string;
  source: string;
  generatedAt: string;
  rows: RadarRow[];
  markets: MarketBoard[];
};

const fallbackResponse: RadarResponse = {
  marketState: "CHOP",
  source: "fallback",
  generatedAt: new Date().toISOString(),
  rows: [
    {
      symbol: "005930",
      name: "삼성전자",
      price: 71200,
      score: 82,
      tags: ["SURGE_VOL", "BREAKOUT"],
      metrics: {
        ret1m: 0.011,
        ret3m: 0.038,
        turnover1m: 3_400_000_000,
        turnover3m: 8_900_000_000,
        turnoverAccel: 1.28
      }
    },
    {
      symbol: "000660",
      name: "SK하이닉스",
      price: 189500,
      score: 89,
      tags: ["SURGE_VOL", "SURGE_PRICE", "BREAKOUT"],
      metrics: {
        ret1m: 0.024,
        ret3m: 0.061,
        turnover1m: 4_800_000_000,
        turnover3m: 12_700_000_000,
        turnoverAccel: 1.44
      }
    },
    {
      symbol: "196170",
      name: "알테오젠",
      price: 312500,
      score: 84,
      tags: ["SURGE_VOL", "SURGE_PRICE", "BREAKOUT"],
      metrics: {
        ret1m: 0.031,
        ret3m: 0.074,
        turnover1m: 2_250_000_000,
        turnover3m: 6_100_000_000,
        turnoverAccel: 1.52
      }
    }
  ],
  markets: [
    {
      code: "KOSPI",
      name: "코스피",
      indexChangePct: 0.012,
      avgScore: 77.5,
      advancers: 6,
      decliners: 2,
      totalTurnover1m: 17_600_000_000,
      sectors: [
        {
          name: "반도체",
          avgScore: 85.5,
          avgRet1m: 0.018,
          totalTurnover1m: 8_200_000_000,
          members: [
            {
              symbol: "000660",
              name: "SK하이닉스",
              price: 189500,
              score: 89,
              ret1m: 0.024,
              turnover1m: 4_800_000_000,
              tags: ["SURGE_VOL", "BREAKOUT"],
              weight: 6
            },
            {
              symbol: "005930",
              name: "삼성전자",
              price: 71200,
              score: 82,
              ret1m: 0.011,
              turnover1m: 3_400_000_000,
              tags: ["SURGE_VOL", "BREAKOUT"],
              weight: 6
            }
          ]
        },
        {
          name: "자동차",
          avgScore: 76.5,
          avgRet1m: 0.014,
          totalTurnover1m: 3_380_000_000,
          members: [
            {
              symbol: "005380",
              name: "현대차",
              price: 248500,
              score: 77,
              ret1m: 0.015,
              turnover1m: 1_950_000_000,
              tags: ["SURGE_PRICE"],
              weight: 6
            },
            {
              symbol: "000270",
              name: "기아",
              price: 112000,
              score: 76,
              ret1m: 0.013,
              turnover1m: 1_430_000_000,
              tags: ["SURGE_PRICE"],
              weight: 4
            }
          ]
        }
      ]
    },
    {
      code: "KOSDAQ",
      name: "코스닥",
      indexChangePct: 0.016,
      avgScore: 80.3,
      advancers: 5,
      decliners: 1,
      totalTurnover1m: 8_900_000_000,
      sectors: [
        {
          name: "바이오",
          avgScore: 82.5,
          avgRet1m: 0.022,
          totalTurnover1m: 3_790_000_000,
          members: [
            {
              symbol: "196170",
              name: "알테오젠",
              price: 312500,
              score: 84,
              ret1m: 0.031,
              turnover1m: 2_250_000_000,
              tags: ["SURGE_VOL", "BREAKOUT"],
              weight: 4
            },
            {
              symbol: "068270",
              name: "셀트리온",
              price: 189000,
              score: 81,
              ret1m: 0.012,
              turnover1m: 1_540_000_000,
              tags: ["SURGE_VOL"],
              weight: 6
            }
          ]
        },
        {
          name: "로봇",
          avgScore: 83,
          avgRet1m: 0.025,
          totalTurnover1m: 1_930_000_000,
          members: [
            {
              symbol: "454910",
              name: "두산로보틱스",
              price: 65300,
              score: 84,
              ret1m: 0.027,
              turnover1m: 1_020_000_000,
              tags: ["SURGE_PRICE", "BREAKOUT"],
              weight: 2
            },
            {
              symbol: "277810",
              name: "레인보우로보틱스",
              price: 164700,
              score: 82,
              ret1m: 0.022,
              turnover1m: 910_000_000,
              tags: ["SURGE_PRICE", "BREAKOUT"],
              weight: 2
            }
          ]
        }
      ]
    }
  ]
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function isRadarRow(value: unknown): value is RadarRow {
  if (!isRecord(value)) return false;
  const metrics = value.metrics;
  return (
    typeof value.symbol === "string" &&
    typeof value.name === "string" &&
    typeof value.price === "number" &&
    typeof value.score === "number" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    isRecord(metrics) &&
    typeof metrics.ret1m === "number" &&
    typeof metrics.ret3m === "number" &&
    typeof metrics.turnover1m === "number" &&
    typeof metrics.turnover3m === "number" &&
    typeof metrics.turnoverAccel === "number"
  );
}

function isMarketTile(value: unknown): value is MarketTile {
  if (!isRecord(value)) return false;
  return (
    typeof value.symbol === "string" &&
    typeof value.name === "string" &&
    typeof value.price === "number" &&
    typeof value.score === "number" &&
    typeof value.ret1m === "number" &&
    typeof value.turnover1m === "number" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.weight === "number"
  );
}

function isSectorBox(value: unknown): value is SectorBox {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.avgScore === "number" &&
    typeof value.avgRet1m === "number" &&
    typeof value.totalTurnover1m === "number" &&
    Array.isArray(value.members) &&
    value.members.every(isMarketTile)
  );
}

function isMarketBoard(value: unknown): value is MarketBoard {
  if (!isRecord(value)) return false;
  return (
    (value.code === "KOSPI" || value.code === "KOSDAQ") &&
    typeof value.name === "string" &&
    typeof value.indexChangePct === "number" &&
    typeof value.avgScore === "number" &&
    typeof value.advancers === "number" &&
    typeof value.decliners === "number" &&
    typeof value.totalTurnover1m === "number" &&
    Array.isArray(value.sectors) &&
    value.sectors.every(isSectorBox)
  );
}

function coerceRadarResponse(value: unknown): RadarResponse {
  if (!isRecord(value)) return fallbackResponse;
  if (!Array.isArray(value.rows) || !value.rows.every(isRadarRow)) return fallbackResponse;
  if (!Array.isArray(value.markets) || !value.markets.every(isMarketBoard)) {
    return {
      ...fallbackResponse,
      rows: value.rows
    };
  }

  return {
    marketState: typeof value.marketState === "string" ? value.marketState : fallbackResponse.marketState,
    source: typeof value.source === "string" ? value.source : "unknown",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : new Date().toISOString(),
    rows: value.rows,
    markets: value.markets
  };
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatBillions(value: number) {
  return `${(value / 1_000_000_000).toFixed(1)}B`;
}

function formatPrice(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function formatMarketState(value: string) {
  const map: Record<string, string> = {
    CHOP: "횡보장",
    TREND_UP: "상승 추세",
    TREND_DOWN: "하락 추세",
    HIGH_VOL: "고변동성"
  };
  return map[value] ?? value;
}

function formatSource(value: string) {
  const map: Record<string, string> = {
    mock: "목업 데이터",
    live: "실데이터",
    fallback: "폴백 데이터"
  };
  return map[value] ?? value;
}

function heatClass(ret1m: number) {
  if (ret1m >= 0.025) return "heat-up-3";
  if (ret1m >= 0.012) return "heat-up-2";
  if (ret1m > 0.002) return "heat-up-1";
  if (ret1m <= -0.02) return "heat-down-3";
  if (ret1m <= -0.01) return "heat-down-2";
  if (ret1m < -0.002) return "heat-down-1";
  return "heat-flat";
}

function tileSpanClass(weight: number) {
  if (weight >= 6) return "span-6";
  if (weight >= 4) return "span-4";
  return "span-3";
}

function formatTag(tag: string) {
  const map: Record<string, string> = {
    SURGE_VOL: "거래급증",
    SURGE_PRICE: "가격급등",
    BREAKOUT: "돌파",
    PULLBACK: "눌림",
    ABSORB: "매물흡수",
    THIN_ASK: "매도얇음",
    THEME_SYNC: "테마동조",
    RISK_SPIKE: "리스크급증"
  };
  return map[tag] ?? tag;
}

async function getRadarData(): Promise<RadarResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const url = `${baseUrl.replace(/\/$/, "")}/api/radar`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Radar request failed: ${res.status}`);
    return coerceRadarResponse(await res.json());
  } catch {
    return fallbackResponse;
  }
}

export default async function HomePage() {
  const data = await getRadarData();
  const topRows = data.rows.slice(0, 10);
  const topTile = data.markets.flatMap((market) => market.sectors.flatMap((sector) => sector.members))[0];
  const avgScore = topRows.reduce((sum, row) => sum + row.score, 0) / Math.max(topRows.length, 1);
  const totalTurnover = topRows.reduce((sum, row) => sum + row.metrics.turnover1m, 0);
  const generatedAt = new Date(data.generatedAt).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const symbolMeta = new Map(
    data.markets.flatMap((market) =>
      market.sectors.flatMap((sector) =>
        sector.members.map((member) => [member.symbol, { market: market.name, sector: sector.name }] as const)
      )
    )
  );

  return (
    <main className="shell">
      <section className="hero panel">
        <div>
          <p className="eyebrow">Alpha Radar / 국내 섹터맵 레이더</p>
          <h1>코스피·코스닥을 섹터 박스로 나눠서 보는 레이더 화면</h1>
          <p className="hero-copy">
            색상은 1분 수익률, 박스 크기는 1분 거래대금(가중치)을 의미합니다. 아래 테이블은 엔진 점수 기준 상위
            종목을 별도로 보여줘서, “시장 분포”와 “매매 후보”를 분리해서 볼 수 있게 구성했습니다.
          </p>
          <div className="pill-row">
            <span className="pill alert">{formatMarketState(data.marketState)}</span>
            <span className="pill">데이터: {formatSource(data.source)}</span>
            <span className="pill">업데이트: {generatedAt}</span>
          </div>
        </div>
        <div className="hero-cards">
          <article className="metric-card">
            <span>상위 레이더 평균 점수</span>
            <strong>{avgScore.toFixed(1)}</strong>
            <small>상위 10개 종목 기준</small>
          </article>
          <article className="metric-card">
            <span>상위 레이더 1분 거래대금</span>
            <strong>{formatBillions(totalTurnover)}</strong>
            <small>상위 10개 종목 합산</small>
          </article>
          <article className="metric-card">
            <span>현재 최상위 박스</span>
            <strong>{topTile ? topTile.name : "N/A"}</strong>
            <small>{topTile ? `${topTile.symbol} · ${formatPct(topTile.ret1m)}` : "데이터 없음"}</small>
          </article>
        </div>
      </section>

      <section className="panel legend-panel">
        <div className="panel-head">
          <h2>화면 읽는 법</h2>
          <p>무엇을 보여주는지 바로 이해되도록 기준을 고정했습니다.</p>
        </div>
        <div className="legend-grid">
          <div className="legend-item">
            <strong>색상</strong>
            <span>1분 수익률 (상승=적색 계열, 하락=청색 계열)</span>
          </div>
          <div className="legend-item">
            <strong>박스 크기</strong>
            <span>1분 거래대금 기반 가중치 (대형주가 더 큼)</span>
          </div>
          <div className="legend-item">
            <strong>섹터 카드</strong>
            <span>섹터 평균 점수 / 평균 수익률 / 거래대금 합계</span>
          </div>
          <div className="legend-item">
            <strong>하단 테이블</strong>
            <span>엔진 점수 기준 상위 후보 목록 (매매 관점)</span>
          </div>
        </div>
      </section>

      <section className="board-grid">
        {data.markets.map((market) => (
          <article key={market.code} className="panel market-panel">
            <div className="market-head">
              <div>
                <p className="market-code">{market.code}</p>
                <h2>{market.name} 섹터맵</h2>
              </div>
              <div className="market-stats">
                <span className={`delta-chip ${heatClass(market.indexChangePct)}`}>{formatPct(market.indexChangePct)}</span>
                <span>상승 {market.advancers}</span>
                <span>하락 {market.decliners}</span>
                <span>평균점수 {market.avgScore.toFixed(1)}</span>
              </div>
            </div>
            <div className="market-meta">
              <span>섹터 {market.sectors.length}개</span>
              <span>1분 거래대금 {formatBillions(market.totalTurnover1m)}</span>
            </div>
            <div className="sector-map">
              {market.sectors.map((sector) => (
                <section key={`${market.code}-${sector.name}`} className="sector-card">
                  <div className="sector-head">
                    <div>
                      <h3>{sector.name}</h3>
                      <p>
                        평균점수 {sector.avgScore.toFixed(1)} · 평균 {formatPct(sector.avgRet1m)}
                      </p>
                    </div>
                    <span>{formatBillions(sector.totalTurnover1m)}</span>
                  </div>
                  <div className="tile-grid">
                    {sector.members.map((member) => (
                      <article
                        key={member.symbol}
                        className={`tile ${tileSpanClass(member.weight)} ${heatClass(member.ret1m)}`}
                        title={`${member.name} ${member.symbol}`}
                      >
                        <div className="tile-top">
                          <strong>{member.name}</strong>
                          <span>{member.symbol}</span>
                        </div>
                        <div className="tile-price">{formatPrice(member.price)}</div>
                        <div className="tile-bottom">
                          <span>{formatPct(member.ret1m)}</span>
                          <span>점수 {member.score}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="grid">
        <section className="panel panel-span-2">
          <div className="panel-head">
            <h2>레이더 상위 후보</h2>
            <p>엔진 점수 기준 정렬. 시장 분포(위)와 매매 후보(아래)를 분리해서 봅니다.</p>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th>시장/섹터</th>
                  <th>가격</th>
                  <th>점수</th>
                  <th>1분</th>
                  <th>3분</th>
                  <th>1분 거래대금</th>
                  <th>가속도</th>
                  <th>태그</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((row) => {
                  const meta = symbolMeta.get(row.symbol);
                  return (
                    <tr key={row.symbol}>
                      <td>
                        <div className="table-symbol">
                          <strong>{row.name}</strong>
                          <span>{row.symbol}</span>
                        </div>
                      </td>
                      <td>{meta ? `${meta.market} / ${meta.sector}` : "-"}</td>
                      <td>{formatPrice(row.price)}</td>
                      <td className={`score ${row.score >= 80 ? "high" : ""}`}>{row.score}</td>
                      <td>{formatPct(row.metrics.ret1m)}</td>
                      <td>{formatPct(row.metrics.ret3m)}</td>
                      <td>{formatBillions(row.metrics.turnover1m)}</td>
                      <td>{row.metrics.turnoverAccel.toFixed(2)}x</td>
                      <td>{row.tags.map(formatTag).join(", ") || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel side-panel">
          <div className="panel-head">
            <h2>데이터 상태</h2>
            <p>현재 응답의 신뢰도와 개선 포인트</p>
          </div>
          <ul className="feed">
            <li>
              <span>데이터 소스</span>
              <small>{formatSource(data.source)}</small>
            </li>
            <li>
              <span>응답 시각</span>
              <small>{generatedAt}</small>
            </li>
            <li>
              <span>시장 상태</span>
              <small>{formatMarketState(data.marketState)}</small>
            </li>
            <li>
              <span>현재 제한</span>
              <small>{data.source === "mock" ? "목업 데이터 기반 시뮬레이션" : "실데이터 연결 상태"}</small>
            </li>
          </ul>

          <div className="panel-head side-subhead">
            <h2>다음 개선 순서</h2>
            <p>확실한 개선을 위한 우선순위</p>
          </div>
          <ol className="todo-list">
            <li>실제 코스피/코스닥 종목군 수집기 연결 (시장/업종/거래대금)</li>
            <li>업종 분류 마스터 정리 (거래소/증권사 기준 중 하나로 고정)</li>
            <li>장중 주기 갱신 + 변동률 기준 색상 스케일 튜닝</li>
            <li>클릭 시 종목 상세(체결강도, 호가, 분봉 요약) 패널 추가</li>
          </ol>
        </section>
      </section>
    </main>
  );
}
