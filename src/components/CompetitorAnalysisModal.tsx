import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Building,
  DollarSign,
  BarChart3,
  Percent,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { ProductItem } from '../types';
import { CompetitorAnalysisResult, analyzeCompetitorMarket } from '../services/competitorAnalysis';

interface CompetitorAnalysisModalProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  usdRate: number;
}

export const CompetitorAnalysisModal: React.FC<CompetitorAnalysisModalProps> = ({
  product,
  isOpen,
  onClose,
  usdRate,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompetitorAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      handleFetchAnalysis();
    } else {
      setResult(null);
      setError(null);
    }
  }, [isOpen, product?.id]);

  if (!isOpen || !product) return null;

  const ourWholesaleToman =
    product.tieredPricing[0]?.calculatedPriceToman || Math.round(product.costPerUnitUsd * usdRate * 1.25);

  const handleFetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeCompetitorMarket(
        product.faTitle,
        product.category,
        product.faFeatures?.join(', ') || '',
        ourWholesaleToman,
        product.costPerUnitUsd
      );
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(
        'سرویس تحلیل رقبا در دسترس نیست: در نسخه استاتیک (میزبانی‌شده روی هاست ساده) نیاز به سرور server.ts است؛ در غیر این صورت دوباره تلاش کنید.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!result) return;
    const reportText = `📊 گزارش تحلیل رقبا و حاشیه سود بازار ایران | نفیس‌استور (NFS)
📦 محصول: ${product.faTitle}

💰 قیمت عمده خرید ما از چین: ${ourWholesaleToman.toLocaleString('en-US')} تومان
🔍 کف قیمت در ترب: ${result.minRetailPriceToman.toLocaleString('en-US')} تومان
🛒 میانگین قیمت در دیجی‌کالا: ${result.avgRetailPriceToman.toLocaleString('en-US')} تومان

📈 حاشیه سود تخمینی همکار: ${result.grossMarginPercent}% (سود خالص: ${result.profitPerUnitToman?.toLocaleString('en-US')} تومان در هر عدد)
🏷 قیمت فروش پیشنهادی تک‌فروشی: ${result.suggestedRetailPriceToman?.toLocaleString('en-US')} تومان

⭐ مزیت‌های رقابتی تامین مستقیم:
${result.keyDifferentiators.map((d) => `• ${d}`).join('\n')}

💡 تحلیل راهبردی:
${result.executiveSummary}

🌐 وب‌سایت رسمی: nafisstore.com`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-[#F8FAFC]">
                  ماژول تحلیل رقبا در بازار ایران (دیجی‌کالا و ترب)
                </h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                استخراج اطلاعات قیمت‌های تک‌فروشی بازار و مقایسه حاشیه سود عمده‌فروشی
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs no-scrollbar">
          {/* Target Product Summary Strip */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
            <img
              src={product.mainImage}
              alt={product.faTitle}
              className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-xs text-white truncate">{product.faTitle}</h4>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                <span>دسته‌بندی: <strong className="text-slate-200">{product.category}</strong></span>
                <span>•</span>
                <span>قیمت عمده ما: <strong className="text-emerald-400 font-mono">{ourWholesaleToman.toLocaleString('en-US')} تومان</strong></span>
                <span>•</span>
                <span>تامین‌کننده: <strong className="text-amber-300">{product.supplier.platform}</strong></span>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-14 text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin mx-auto"></div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-purple-300">در حال رصد و مقایسه با بازار آنلاین ایران...</p>
                <p className="text-xs text-slate-400">
                  مدل Gemini در حال تحلیل نمونه‌های ثبت شده در دیجی‌کالا، ترب و ایمالز و محاسبه حاشیه سود است.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <span>{error}</span>
              </div>
              <button
                onClick={handleFetchAnalysis}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                تلاش مجدد
              </button>
            </div>
          )}

          {/* Results State */}
          {result && !loading && (
            <div className="space-y-5 animate-fadeIn">
              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-emerald-950/30 border border-emerald-500/40 p-3 rounded-2xl space-y-1">
                  <div className="text-[10px] text-emerald-300 font-medium">قیمت عمده ما (NFS):</div>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono">
                    {ourWholesaleToman.toLocaleString('en-US')}
                  </div>
                  <div className="text-[9px] text-emerald-400/80">خرید مستقیم دست‌اول</div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl space-y-1">
                  <div className="text-[10px] text-slate-400 font-medium">کف قیمت در ترب:</div>
                  <div className="text-sm sm:text-base font-extrabold text-sky-400 font-mono">
                    {result.minRetailPriceToman.toLocaleString('en-US')}
                  </div>
                  <div className="text-[9px] text-slate-500">ارزان‌ترین فروشگاه</div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl space-y-1">
                  <div className="text-[10px] text-slate-400 font-medium">میانگین دیجی‌کالا:</div>
                  <div className="text-sm sm:text-base font-extrabold text-amber-400 font-mono">
                    {result.avgRetailPriceToman.toLocaleString('en-US')}
                  </div>
                  <div className="text-[9px] text-slate-500">تک‌فروشی مرجع</div>
                </div>

                <div className="bg-[#E63946]/15 border border-[#E63946]/40 p-3 rounded-2xl space-y-1">
                  <div className="text-[10px] text-[#FF4D6D] font-medium">حاشیه سود ناخالص:</div>
                  <div className="text-sm sm:text-base font-black text-[#FF4D6D] font-mono">
                    +{result.grossMarginPercent}%
                  </div>
                  <div className="text-[9px] text-slate-300">
                    سود: {result.profitPerUnitToman?.toLocaleString('en-US')} ت
                  </div>
                </div>
              </div>

              {/* Visual Price Comparison Bar */}
              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    <span>مقایسه بصری قیمت خرید عمده با نرخ بازار:</span>
                  </span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">
                    تقاضای بازار: <strong className="text-amber-400">{result.marketDemandLevel}</strong>
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {/* Our Wholesale Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-emerald-400 font-semibold">قیمت خرید عمده ما از چین:</span>
                      <span className="font-mono text-emerald-400 font-bold">{ourWholesaleToman.toLocaleString('en-US')} تومان</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round((ourWholesaleToman / result.maxRetailPriceToman) * 100))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Digikala Avg Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-amber-400 font-semibold">میانگین فروش دیجی‌کالا و تکنولایف:</span>
                      <span className="font-mono text-amber-400 font-bold">{result.avgRetailPriceToman.toLocaleString('en-US')} تومان</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round((result.avgRetailPriceToman / result.maxRetailPriceToman) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Competitive Advantages & Platforms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                  <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>مزیت‌های رقابتی تامین مستقیم ما:</span>
                  </h5>
                  <ul className="space-y-1.5 text-[11px] text-slate-300">
                    {result.keyDifferentiators.map((diff, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                        <span className="leading-relaxed">{diff}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                  <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-sky-400" />
                    <span>قیمت‌گذاری پیشنهادی برای همکار:</span>
                  </h5>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400">قیمت فروش پیشنهادی در مغازه یا آنلاین شاپ:</div>
                    <div className="text-base font-extrabold text-amber-300 font-mono">
                      {result.suggestedRetailPriceToman.toLocaleString('en-US')} تومان
                    </div>
                    <div className="text-[10px] text-emerald-400">
                      حاشیه سود خالص همکار: {(result.suggestedRetailPriceToman - ourWholesaleToman).toLocaleString('en-US')} تومان
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-400">
                    <span>پلتفرم‌های بررسی شده:</span>
                    {result.competitorPlatforms.map((cp, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        {cp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Gemini Executive Summary */}
              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-1.5">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>تحلیل راهبردی هوش مصنوعی Gemini:</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {result.executiveSummary}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1E293B] bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            onClick={handleFetchAnalysis}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی تحلیل</span>
          </button>

          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={handleCopyReport}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer border border-slate-700"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">گزارش کپی شد!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>کپی خلاصه گزارش برای تلگرام</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={onClose}
              className="nfs-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
