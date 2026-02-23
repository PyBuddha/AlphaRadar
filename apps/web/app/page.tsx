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

type RadarResponse = {
  marketState: string;
  rows: RadarRow[];
};

const fallbackResponse: RadarResponse = {
  marketState: "CHOP",
  rows: [
    {
      symbol: "005930",
      name: "SAMPLE",
      price: 71200,
      score: 82,
      tags: ["SURGE_VOL", "BREAKOUT"],
      metrics: {
        ret1m: 0.023,
        ret3m: 0.041,
        turnover1m: 1_250_000_000,
        turnover3m: 2_700_000_000,
        turnoverAccel: 1.35
      }
    }
  ]
};

async function getRadarData(): Promise<RadarResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const url = `${baseUrl.replace(/\/$/, "")}/api/radar`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Radar request failed: ${res.status}`);
    return (await res.json()) as RadarResponse;
  } catch {
    return fallbackResponse;
  }
}

export default async function HomePage() {
  const data = await getRadarData();
  const top = data.rows[0];

  return (
    <main className="shell">
      <div className="grid">
        <section className="panel">
          <h2>Market State</h2>
          <div style={{ marginBottom: 8 }}>
            <span className="pill alert">{data.marketState}</span>
            <span className="pill">Breadth 0.46</span>
            <span className="pill">TopConc 0.34</span>
            <span className="pill">VolRegime High</span>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
            Dashboard reads the radar API and falls back to local mock data if the backend is offline.
          </p>
        </section>

        <section className="panel">
          <h2>Momentum Radar</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Score</th>
                <th>Tags</th>
                <th>Ret 1m</th>
                <th>Turnover 1m</th>
                <th>Accel</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.symbol}>
                  <td>
                    {row.name} ({row.symbol})
                  </td>
                  <td className={`score ${row.score >= 70 ? "high" : ""}`.trim()}>
                    {row.score}
                  </td>
                  <td>{row.tags.join(", ")}</td>
                  <td>{(row.metrics.ret1m * 100).toFixed(1)}%</td>
                  <td>{(row.metrics.turnover1m / 1_000_000_000).toFixed(1)}B</td>
                  <td>{row.metrics.turnoverAccel.toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Entry Panel</h2>
          {top ? (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {Math.round(top.price).toLocaleString()}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {top.name} ({top.symbol}) candidate
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span className="pill">Score {top.score}</span>
                <span className="pill">Ret1m {(top.metrics.ret1m * 100).toFixed(1)}%</span>
                <span className="pill">Accel {top.metrics.turnoverAccel.toFixed(2)}x</span>
              </div>
              <ul className="mini-list">
                <li>Tags: {top.tags.join(", ") || "None"}</li>
                <li>Turnover 3m: {(top.metrics.turnover3m / 1_000_000_000).toFixed(1)}B</li>
                <li>Ret 3m: {(top.metrics.ret3m * 100).toFixed(1)}%</li>
              </ul>
            </>
          ) : (
            <p style={{ margin: 0, color: "var(--muted)" }}>No radar rows available.</p>
          )}
        </section>
      </div>
    </main>
  );
}
