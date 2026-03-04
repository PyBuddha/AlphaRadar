"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SymbolOption = {
  symbol: string;
  name: string;
};

type ReplayPoint = {
  at: string;
  price: number;
  score: number;
  red: boolean;
};

type JournalEntry = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  note: string;
  createdAt: string;
};

type TradingToolsProps = {
  apiBaseUrl: string;
  symbols: SymbolOption[];
  defaultSymbol: string;
  seedTimeline: ReplayPoint[];
};

function formatPrice(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatAt(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export default function TradingTools({
  apiBaseUrl,
  symbols,
  defaultSymbol,
  seedTimeline
}: TradingToolsProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(defaultSymbol);
  const [replayPoints, setReplayPoints] = useState<ReplayPoint[]>(seedTimeline);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo(() => apiBaseUrl.replace(/\/$/, ""), [apiBaseUrl]);

  useEffect(() => {
    let canceled = false;

    const loadJournal = async () => {
      try {
        const res = await fetch(`${base}/api/journal`, { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { entries?: unknown };
        if (canceled) return;
        if (payload && Array.isArray(payload.entries)) {
          setJournalEntries(
            payload.entries.filter((item): item is JournalEntry => {
              return (
                typeof item === "object" &&
                item !== null &&
                "id" in item &&
                "symbol" in item &&
                "side" in item &&
                "price" in item &&
                "quantity" in item &&
                "note" in item &&
                "createdAt" in item
              );
            })
          );
        }
      } catch {
        // ignore transient fetch failures in client UI
      }
    };

    void loadJournal();
    return () => {
      canceled = true;
    };
  }, [base]);

  useEffect(() => {
    let canceled = false;

    const loadReplay = async () => {
      try {
        const res = await fetch(`${base}/api/replay?symbol=${encodeURIComponent(selectedSymbol)}`, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { points?: unknown };
        if (canceled) return;
        if (payload && Array.isArray(payload.points)) {
          setReplayPoints(
            payload.points
              .filter((item): item is ReplayPoint => {
                return (
                  typeof item === "object" &&
                  item !== null &&
                  "at" in item &&
                  "price" in item &&
                  "score" in item &&
                  "red" in item
                );
              })
              .slice(-20)
          );
        }
      } catch {
        // ignore transient fetch failures in client UI
      }
    };

    void loadReplay();
    const timer = window.setInterval(() => {
      void loadReplay();
    }, 5000);

    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [base, selectedSymbol]);

  async function onSubmitJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`${base}/api/journal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim(),
          side,
          price: Number(price),
          quantity: Number(quantity),
          note
        })
      });
      if (!res.ok) {
        setError(`저장 실패 (${res.status})`);
        return;
      }
      const payload = (await res.json()) as { entries?: unknown };
      if (payload && Array.isArray(payload.entries)) {
        setJournalEntries(
          payload.entries.filter((item): item is JournalEntry => {
            return (
              typeof item === "object" &&
              item !== null &&
              "id" in item &&
              "symbol" in item &&
              "side" in item &&
              "price" in item &&
              "quantity" in item &&
              "note" in item &&
              "createdAt" in item
            );
          })
        );
      }
      setPrice("");
      setQuantity("1");
      setNote("");
    } catch {
      setError("저장 실패 (네트워크)");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="trade-tools-grid">
      <section className="trade-panel">
        <div className="panel-head">
          <h2>신호 리플레이 (5분)</h2>
          <p>선택 종목의 최근 시그널 이력</p>
        </div>
        <div className="trade-form-row">
          <label htmlFor="replay-symbol">종목</label>
          <select
            id="replay-symbol"
            value={selectedSymbol}
            onChange={(event) => setSelectedSymbol(event.target.value)}
          >
            {symbols.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.name} ({item.symbol})
              </option>
            ))}
          </select>
        </div>
        <ul className="replay-list">
          {replayPoints.length === 0 && <li className="replay-empty">리플레이 데이터가 아직 없습니다.</li>}
          {replayPoints.map((point, idx) => {
            const prev = replayPoints[idx - 1];
            const delta = prev ? (point.price - prev.price) / Math.max(prev.price, 1) : 0;
            return (
              <li key={`${point.at}-${idx}`} className="replay-item">
                <span>{formatAt(point.at)}</span>
                <strong>{formatPrice(point.price)}</strong>
                <small>
                  점수 {point.score} · {formatPct(delta)} {point.red ? "· RED" : ""}
                </small>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="trade-panel">
        <div className="panel-head">
          <h2>매매일지</h2>
          <p>진입/청산/메모 기록</p>
        </div>
        <form onSubmit={onSubmitJournal} className="journal-form">
          <div className="trade-form-row">
            <label htmlFor="journal-symbol">종목코드</label>
            <input
              id="journal-symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              placeholder="005930"
              required
            />
          </div>
          <div className="trade-form-grid">
            <div className="trade-form-row">
              <label htmlFor="journal-side">구분</label>
              <select id="journal-side" value={side} onChange={(event) => setSide(event.target.value === "SELL" ? "SELL" : "BUY")}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div className="trade-form-row">
              <label htmlFor="journal-price">가격</label>
              <input
                id="journal-price"
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </div>
            <div className="trade-form-row">
              <label htmlFor="journal-qty">수량</label>
              <input
                id="journal-qty"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="trade-form-row">
            <label htmlFor="journal-note">메모</label>
            <textarea
              id="journal-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="진입 근거/손절 기준 기록"
            />
          </div>
          {error && <p className="trade-error">{error}</p>}
          <button type="submit" disabled={isSaving}>
            {isSaving ? "저장 중..." : "일지 저장"}
          </button>
        </form>

        <ul className="journal-list">
          {journalEntries.length === 0 && <li className="replay-empty">저장된 일지가 없습니다.</li>}
          {journalEntries.slice(0, 8).map((entry) => (
            <li key={entry.id} className="journal-item">
              <span>
                {entry.side} {entry.symbol}
              </span>
              <strong>
                {formatPrice(entry.price)} x {entry.quantity}
              </strong>
              <small>
                {entry.note || "-"} · {formatAt(entry.createdAt)}
              </small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
