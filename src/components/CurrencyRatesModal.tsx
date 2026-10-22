import React, { useState } from 'react';
import { X, RefreshCw, Check, DollarSign, Coins, TrendingUp, AlertCircle } from 'lucide-react';
import { CurrencyRates } from '../types';

interface CurrencyRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencyRates: CurrencyRates;
  onRefreshRates: () => Promise<void>;
  isRefreshing: boolean;
  onSaveCustomRates: (usd: number, aed: number, cny: number) => void;
}

export const CurrencyRatesModal: React.FC<CurrencyRatesModalProps> = ({
  isOpen,
  onClose,
  currencyRates,
  onRefreshRates,
  isRefreshing,
  onSaveCustomRates,
}) => {
  const [usdInput, setUsdInput] = useState<number>(currencyRates.usd);
  const [aedInput, setAedInput] = useState<number>(currencyRates.aed);
  const [cnyInput, setCnyInput] = useState<number>(currencyRates.cny);
  const [saveSuccess, setSaveSuccess] = useState(false);

  React.useEffect(() => {
    setUsdInput(currencyRates.usd);
    setAedInput(currencyRates.aed);
    setCnyInput(currencyRates.cny);
  }, [currencyRates]);

  if (!isOpen) return null;

  const handleUsdChange = (val: number) => {
    setUsdInput(val);
    setAedInput(Math.round((val / 3.672) / 10) * 10);
    setCnyInput(Math.round((val / 7.245) / 10) * 10);
  };

  const handleSave = () => {
    onSaveCustomRates(usdInput, aedInput, cnyInput);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0B111C] border border-[#25395A] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="p-5 border-b border-[#25395A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#4A70A9]/20 text-[#8FABD4] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#F8FAFC]">تنظیم و بروزرسانی زنده نرخ ارزها</h3>
              <p className="text-xs text-slate-400">مرجع: TGJU / AlanChand / بازار آزاد و واردات</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {/* Status badge */}
          <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-bold">سامانه دریافت زنده فعال است</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              آخرین ثبت: {currencyRates.lastUpdated}
            </span>
          </div>

          {/* Quick Refresh Button */}
          <div className="flex items-center justify-between">
            <span className="text-slate-300">دریافت آخرین نرخ لحظه‌ای از اینترنت:</span>
            <button
              onClick={() => onRefreshRates()}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25395A] hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#4A70A9]' : ''}`} />
              <span>{isRefreshing ? 'در حال استعلام...' : 'استعلام فوری نرخ'}</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] text-slate-400">پیش‌تنظیم‌های بازار:</span>
            <button
              type="button"
              onClick={() => {
                setUsdInput(268300);
                setAedInput(73440);
                setCnyInput(40200);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold border border-amber-500/30 transition cursor-pointer font-mono"
            >
              نرخ روز بازار آزاد (دلار: 268,300 | درهم: 73,440)
            </button>
            <button
              type="button"
              onClick={() => {
                setUsdInput(269900);
                setAedInput(73900);
                setCnyInput(40500);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-bold border border-sky-500/30 transition cursor-pointer font-mono"
            >
              نرخ حواله نقدی (دلار: 269,900)
            </button>
          </div>

          {/* Manual Input Fields */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="text-slate-300 font-bold flex items-center gap-1.5">
              <span>ویرایش دستی نرخ مبنا (محاسبه خودکار کل کاتالوگ):</span>
            </div>

            {/* USD Input */}
            <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-bold text-amber-400">دلار آمریکا (USD):</span>
                <span className="text-[10px]">نرخ حواله / بازار آزاد</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="100"
                  value={usdInput}
                  onChange={(e) => handleUsdChange(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-[#4A70A9]"
                />
                <span className="text-xs text-slate-400 shrink-0">تومان</span>
              </div>
            </div>

            {/* AED & CNY Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="font-bold text-sky-400">درهم (AED):</span>
                  <span className="text-[10px]">دبی</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="50"
                    value={aedInput}
                    onChange={(e) => setAedInput(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-sky-300 focus:outline-none focus:border-[#4A70A9]"
                  />
                  <span className="text-[10px] text-slate-400 shrink-0">تومان</span>
                </div>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="font-bold text-rose-400">یوان چین (CNY):</span>
                  <span className="text-[10px]">1688</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="50"
                    value={cnyInput}
                    onChange={(e) => setCnyInput(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-[#4A70A9]"
                  />
                  <span className="text-[10px] text-slate-400 shrink-0">تومان</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              با ذخیره این نرخ، قیمت‌های تومانی تمامی کالاهای کاتالوگ، جدول‌های پلکانی و پیش‌فاکتورها به صورت آنی بر اساس نرخ جدید بازتولید می‌شوند.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#25395A] bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            انصراف
          </button>

          <button
            onClick={handleSave}
            className="nfs-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>نرخ‌ها و قیمت‌ها بروزرسانی شدند!</span>
              </>
            ) : (
              <span>اعمال نرخ جدید روی تمام کاتالوگ</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
