import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { CurrencyRates } from '../types';

const fmt = (n?: number) => (n && n > 0 ? Math.round(n).toLocaleString('en-US') : '—');

/** نوار نرخ لحظه‌ای ارز بالای کاتالوگ */
export const RateBar: React.FC<{ rates: CurrencyRates }> = ({ rates }) => {
  const [live, setLive] = useState<CurrencyRates>(rates);
  const [busy, setBusy] = useState(false);
  const r = live && live.usd ? live : rates;

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api.php?action=get_rates');
      const d = await res.json();
      if (d && d.usd) setLive({ ...rates, ...d });
    } catch {
      /* نرخ قبلی باقی می‌ماند */
    }
    setBusy(false);
  };

  let time = '';
  try {
    const d = r.lastUpdated ? new Date(r.lastUpdated) : null;
    if (d && !isNaN(d.getTime())) time = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch { /* ignore */ }

  const chips: [string, number | undefined][] = [
    ['دلار', r.usd],
    ['درهم', r.aed],
    ['یوان', r.cny],
    ['یورو', r.eur],
  ];

  return (
    <div className="flex items-center gap-2 bg-white border border-[#E3E6EC] rounded-2xl shadow-xs px-2.5 py-2 text-[#0F1115]">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </span>
        <span className="text-[9px] text-[#6B7280]">{time ? `زنده · ${time}` : 'نرخ زنده'}</span>
      </div>
      <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {chips.filter(([, v]) => v && v > 0).map(([n, v]) => (
          <span key={n} className="shrink-0 flex items-center gap-1 bg-[#F6F7F9] border border-[#E3E6EC] rounded-full px-1.5 py-0.5 text-[9px]">
            <span className="text-[#6B7280]">{n}</span>
            <span className="font-mono font-bold tabular-nums">{fmt(v)}</span>
          </span>
        ))}
      </div>
      <button onClick={refresh} disabled={busy} title="به‌روزرسانی نرخ" className="shrink-0 p-1 rounded-lg text-[#6B7280] hover:text-[#A91D2E] hover:bg-[#F6F7F9] transition cursor-pointer">
        <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};
