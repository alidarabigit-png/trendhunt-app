import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { get30DayCurrencyHistory, calculate30DayStats, DailyCurrencyPoint } from '../data/historicalCurrencyData';

export const CurrencyFluctuationChart: React.FC = () => {
  const [data] = useState<DailyCurrencyPoint[]>(get30DayCurrencyHistory());
  const [activeCurrencyFilter, setActiveCurrencyFilter] = useState<'both' | 'aed' | 'cny'>('both');

  const stats = calculate30DayStats(data);

  // Custom tooltip for Recharts with English numerals
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const currentPoint = data.find((d) => d.date === label);
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[170px]">
          <div className="font-mono text-slate-400 font-bold border-b border-slate-800 pb-1 flex justify-between">
            <span>تاریخ:</span>
            <span className="text-white" dir="ltr">{currentPoint?.fullDate || label}</span>
          </div>

          {payload.map((entry: any, index: number) => {
            const isAed = entry.dataKey === 'aed';
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                  <span>{isAed ? 'درهم امارات (AED):' : 'یوان چین (CNY):'}</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {Number(entry.value).toLocaleString('en-US')} ت
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              نمودار تحلیلی نوسانات 30 روز اخیر درهم و یوان (Recharts)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            روند نوسانات بازار حواله درهم امارات (دبی) و یوان چین (1688) بر مبنای داده‌های ذخیره شده
          </p>
        </div>

        {/* Currency Filter Chips */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto text-xs">
          <button
            onClick={() => setActiveCurrencyFilter('both')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              activeCurrencyFilter === 'both'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            هر دو ارز
          </button>
          <button
            onClick={() => setActiveCurrencyFilter('aed')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
              activeCurrencyFilter === 'aed'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span>درهم امارات</span>
          </button>
          <button
            onClick={() => setActiveCurrencyFilter('cny')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
              activeCurrencyFilter === 'cny'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>یوان چین</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* AED Summary */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-sky-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              درهم 30 روزه
            </span>
            <span className="text-emerald-400 font-mono font-bold flex items-center">
              <ArrowUpRight className="w-3 h-3" />
              +{stats.growthAedPercent}%
            </span>
          </div>
          <div className="text-sm font-bold text-white font-mono">
            {stats.minAed.toLocaleString('en-US')} ~ {stats.maxAed.toLocaleString('en-US')}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            میانگین: {stats.avgAed.toLocaleString('en-US')} تومان
          </div>
        </div>

        {/* CNY Summary */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              یوان 30 روزه
            </span>
            <span className="text-emerald-400 font-mono font-bold flex items-center">
              <ArrowUpRight className="w-3 h-3" />
              +{stats.growthCnyPercent}%
            </span>
          </div>
          <div className="text-sm font-bold text-white font-mono">
            {stats.minCny.toLocaleString('en-US')} ~ {stats.maxCny.toLocaleString('en-US')}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            میانگین: {stats.avgCny.toLocaleString('en-US')} تومان
          </div>
        </div>

        {/* Latest AED */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-1">
          <div className="text-[11px] text-slate-400">آخرین نرخ روز درهم:</div>
          <div className="text-base font-extrabold text-sky-400 font-mono">
            {data[data.length - 1].aed.toLocaleString('en-US')} تومان
          </div>
          <div className="text-[10px] text-slate-500">حواله تجاری دبی</div>
        </div>

        {/* Latest CNY */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-1">
          <div className="text-[11px] text-slate-400">آخرین نرخ روز یوان:</div>
          <div className="text-base font-extrabold text-rose-400 font-mono">
            {data[data.length - 1].cny.toLocaleString('en-US')} تومان
          </div>
          <div className="text-[10px] text-slate-500">حواله چین و 1688</div>
        </div>
      </div>

      {/* The Recharts Line Chart Container */}
      <div className="w-full h-80 pt-2" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={['auto', 'auto']}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => (
                <span className="text-xs text-slate-300 font-sans mx-2">
                  {value === 'aed' ? 'درهم امارات (AED)' : 'یوان چین (CNY)'}
                </span>
              )}
            />

            {(activeCurrencyFilter === 'both' || activeCurrencyFilter === 'aed') && (
              <Line
                type="monotone"
                dataKey="aed"
                name="aed"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }}
              />
            )}

            {(activeCurrencyFilter === 'both' || activeCurrencyFilter === 'cny') && (
              <Line
                type="monotone"
                dataKey="cny"
                name="cny"
                stroke="#fb7185"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, fill: '#fb7185', stroke: '#0f172a', strokeWidth: 2 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>بازه زمانی: 30 روز گذشته تا تاریخ امروز</span>
        </div>
        <div className="font-mono text-[10px]">
          منبع داده‌ها: سوابق پایگاه داده تجاری و TGJU
        </div>
      </div>
    </div>
  );
};
