const rows = [
  {
    symbol: "005930",
    name: "SAMPLE",
    score: 82,
    tags: ["SURGE_VOL", "BREAKOUT"],
    changePct: 5.1,
    turnoverBn: 12.5,
    accel: 1.35
  }
];

export default function HomePage() {
  return (
    <main className="shell">
      <div className="grid">
        <section className="panel">
          <h2>Market State</h2>
          <div style={{ marginBottom: 8 }}>
            <span className="pill alert">CHOP</span>
            <span className="pill">Breadth 0.46</span>
            <span className="pill">TopConc 0.34</span>
            <span className="pill">VolRegime High</span>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
            시장 상태는 레이더 민감도 조정용 정량 필터로 사용한다. 오늘은 변동성 높고 쏠림 중간.
          </p>
        </section>

        <section className="panel">
          <h2>Momentum Radar</h2>
          <table className="table">
            <thead>
              <tr>
                <th>종목</th>
                <th>Score</th>
                <th>Tags</th>
                <th>등락률</th>
                <th>거래대금(십억)</th>
                <th>1m Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.symbol}>
                  <td>
                    {row.name} ({row.symbol})
                  </td>
                  <td className="score high">{row.score}</td>
                  <td>{row.tags.join(", ")}</td>
                  <td>{row.changePct.toFixed(1)}%</td>
                  <td>{row.turnoverBn.toFixed(1)}</td>
                  <td>{row.accel.toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Entry Panel</h2>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>71,200</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              전고점 70,900 / 지지 후보 70,450
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <span className="pill">진입 체크: 돌파 유지</span>
            <span className="pill">거래대금 유지</span>
            <span className="pill">호가 밀림 없음</span>
          </div>
          <ul className="mini-list">
            <li>손절 후보: 70,380 (변동성 기반)</li>
            <li>1차 익절: 72,100 / 2차 익절: 73,000</li>
            <li>최근 60초: 체결강도 상승, 눌림 짧음</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

