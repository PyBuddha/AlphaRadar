"use client";

import { useEffect, useRef, useState } from "react";

type HotAlertItem = {
  symbol: string;
  name: string;
  score: number;
  red: boolean;
};

type ToastItem = {
  id: string;
  message: string;
};

type HotAlertProps = {
  items: HotAlertItem[];
};

function playAlertTone() {
  if (typeof window === "undefined") return;
  const contextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!contextClass) return;
  const ctx = new contextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 880;
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  osc.start(now);
  osc.stop(now + 0.25);
  setTimeout(() => {
    void ctx.close();
  }, 400);
}

export default function HotAlert({ items }: HotAlertProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const prevRed = useRef<Set<string>>(new Set());

  useEffect(() => {
    const current = new Set(items.filter((item) => item.red).map((item) => item.symbol));
    const newOnes = items.filter((item) => item.red && !prevRed.current.has(item.symbol));
    prevRed.current = current;

    if (newOnes.length === 0) return;

    playAlertTone();
    const createdAt = Date.now().toString();
    const nextToasts = newOnes.map((item, idx) => ({
      id: `${createdAt}-${idx}-${item.symbol}`,
      message: `RED 신호: ${item.name}(${item.symbol}) · 점수 ${item.score}`
    }));
    setToasts((prev) => [...prev, ...nextToasts].slice(-4));

    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => !nextToasts.some((target) => target.id === toast.id)));
    }, 3600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [items]);

  if (toasts.length === 0) return null;

  return (
    <aside className="hot-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="hot-toast">
          {toast.message}
        </div>
      ))}
    </aside>
  );
}
