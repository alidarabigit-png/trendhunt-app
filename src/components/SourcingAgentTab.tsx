import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  Play,
  RotateCw,
  Sliders,
  DollarSign,
  TrendingUp,
  FileCheck2,
  Layers,
  CheckCircle2,
  Send,
  Zap,
  Trash2,
  Check,
  AlertCircle,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { SourcingSettings, ProductItem } from '../types';
import { runAutomatedSourcingHunt, SourcingProgressUpdate } from '../services/geminiSourcing';

interface SourcingAgentTabProps {
  settings: SourcingSettings;
  setSettings: React.Dispatch<React.SetStateAction<SourcingSettings>>;
  onNewProductsFound: (items: ProductItem[]) => void;
  usdRate: number;
  existingProducts?: ProductItem[];
  onCleanDuplicates?: () => void;
}

export const SourcingAgentTab: React.FC<SourcingAgentTabProps> = ({
  settings,
  setSettings,
  onNewProductsFound,
  usdRate,
  existingProducts = [],
  onCleanDuplicates,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [dryRunHunt, setDryRunHunt] = useState(true);
  const [progress, setProgress] = useState<SourcingProgressUpdate | null>(null);
  const [lastHuntCount, setLastHuntCount] = useState<number | null>(null);
  const [latestHuntedItems, setLatestHuntedItems] = useState<ProductItem[]>([]);
  const [cleanedCount, setCleanedCount] = useState<number | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const isAutoRunDoneToday = settings.lastAutoRunDate === todayStr;

  const categories = [
    'همه دسته‌ها (الگوریتم ترند کلی)',
    'گجت و لوازم دیجیتال',
    'خانه، خودرو و سبک زندگی',
    'صوتی و هوشمند',
    'زیبایی و سلامت شخصی',
    'تجهیزات هوشمند سفر و ایمنی',
  ];

  const availablePlatforms: ('Alibaba' | '1688' | 'Made-in-China' | 'Global Sources')[] = [
    'Alibaba',
    '1688',
    'Made-in-China',
    'Global Sources',
  ];

  const handleTogglePlatform = (p: 'Alibaba' | '1688' | 'Made-in-China' | 'Global Sources') => {
    if (settings.platforms.includes(p)) {
      if (settings.platforms.length > 1) {
        setSettings({ ...settings, platforms: settings.platforms.filter((x) => x !== p) });
      }
    } else {
      setSettings({ ...settings, platforms: [...settings.platforms, p] });
    }
  };

  const handleStartHunt = async (isTestSchedule: boolean = false) => {
    setIsRunning(true);
    setProgress({
      step: 'searching',
      message: isTestSchedule ? 'آغاز تست فوری اجرای خودکار روزانه...' : 'شروع ماموریت ایجنت رصد...',
      progressPercent: 5,
    });

    try {
      const items = await runAutomatedSourcingHunt(
        { ...settings, usdToTomanRate: usdRate },
        (p) => {
          setProgress(p);
        },
        existingProducts,
        { dryRun: dryRunHunt }
      );

      setLatestHuntedItems(items);
      setLastHuntCount(items.length);

      if (isTestSchedule) {
        setSettings((prev) => ({
          ...prev,
          lastAutoRunDate: todayStr,
        }));
      }

      if (items.length > 0) {
        onNewProductsFound(items);
      }
    } catch (err: any) {
      console.error('Hunt error:', err);
      setProgress({
        step: 'searching',
        message: `❌ ${err?.message || 'اجرای ایجنت با خطا مواجه شد.'}`,
        progressPercent: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Agent Banner */}
      <div className="nfs-hero-banner relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#131B2E] to-[#090D16] border border-[#1E293B] p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#E63946]/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#0F172A]/40 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E63946]/15 text-[#FF4D6D] text-xs font-semibold border border-[#E63946]/35">
              <Sparkles className="w-3.5 h-3.5 text-[#E63946]" />
              <span>موتور هوش مصنوعی کاوش و اعتبارسنجی تامین‌کننده</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC] tracking-tight">
              ایجنت رصد روزانه ترندهای عمده‌فروشی جهانی
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              این ایجنت به طور مستمر بازارهای بزرگ عمده‌فروشی (Alibaba، 1688، Made-in-China) را اسکن کرده،
              تامین‌کنندگان معتبر را پالایش نموده و کالاهای ترند <strong>بدون تکرار</strong> را با مشخصات فنی، عکس‌های باکیفیت و جدول قیمت‌های پلکانی به کاتالوگ شما اضافه می‌کند.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              onClick={() => handleStartHunt(false)}
              disabled={isRunning}
              className="nfs-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm shadow-lg transition disabled:opacity-60 cursor-pointer active:scale-95"
            >
              {isRunning ? (
                <>
                  <RotateCw className="w-5 h-5 animate-spin" />
                  <span>در حال کاوش و پالایش ترندها...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>اجرای فوری شکار ترندها</span>
                </>
              )}
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dryRunHunt}
                onChange={(e) => setDryRunHunt(e.target.checked)}
                className="accent-amber-400 w-4 h-4"
              />
              <span>فقط تست (بدون ثبت در کاتالوگ و پست در کانال)</span>
            </label>

            {/* Quick Auto-Schedule status badge */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>ساعت اجرا:</span>
                <span className="font-mono font-bold text-emerald-300">{settings.autoScheduleTime || '08:00'}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isAutoRunDoneToday
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
              }`}>
                {isAutoRunDoneToday ? '✓ امروز اجرا شد' : 'در انتظار اجرا'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Timeline if Running */}
        {progress && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                {progress.message}
              </span>
              <span className="font-mono text-slate-400 font-bold">{progress.progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 via-orange-400 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress.progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Last Hunt Results */}
        {lastHuntCount !== null && !isRunning && (
          <div className="mt-4 space-y-3">
            {lastHuntCount > 0 ? (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-between text-xs text-emerald-200 shadow-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="font-semibold">
                    عملیات با موفقیت انجام شد: <strong>{lastHuntCount}</strong> محصول کاملاً جدید و غیرتکراری به کاتالوگ شما اضافه شدند!
                  </span>
                </div>
                <span className="text-[11px] text-emerald-300 bg-emerald-900/70 border border-emerald-500/30 px-3 py-1 rounded-lg font-bold">
                  مشاهده در برگه کاتالوگ 👈
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-blue-950/60 border border-blue-500/40 flex items-center justify-between text-xs text-blue-200 shadow-lg">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
                  <span className="font-semibold">
                    سیستم هوشمند ضد تکرار فعال است: تمامی کالاهای کشف‌شده قبلاً در کاتالوگ شما موجود هستند و هیچ کالای تکراری اضافه نشد.
                  </span>
                </div>
              </div>
            )}

            {latestHuntedItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                {latestHuntedItems.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 hover:border-amber-400/50 transition space-y-2 shadow-md flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                        <img src={prod.mainImage} alt="" className="w-full h-full object-cover" />
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black shadow">
                          ترند {prod.trendScore}٪
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 line-clamp-2 leading-relaxed">
                        {prod.faTitle}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {prod.faShortDesc}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 font-mono">
                        ${prod.costPerUnitUsd}
                      </span>
                      <span className="text-amber-300 font-black text-xs font-mono">
                        {(prod.tieredPricing[0]?.calculatedPriceToman || 0).toLocaleString('en-US')} تومان
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Sourcing & Platform Filters */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Sliders className="w-5 h-5 text-amber-400" />
              <h2 className="font-bold text-white text-sm sm:text-base">
                فیلترهای کاوش و انتخاب پلتفرم‌های عمده‌فروشی
              </h2>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                پلتفرم‌های مبدا برای شکار کالا:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {availablePlatforms.map((p) => {
                  const isChecked = settings.platforms.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => handleTogglePlatform(p)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        isChecked
                          ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span className="font-bold">{p}</span>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-black ${
                          isChecked ? 'bg-white text-rose-600' : 'border-slate-500 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  دسته‌بندی هدف:
                </label>
                <select
                  value={settings.category}
                  onChange={(e) => setSettings({ ...settings, category: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  کلمه کلیدی خاص (اختیاری):
                </label>
                <input
                  type="text"
                  placeholder="مثال: GaN charger, smart ring..."
                  value={settings.keyword}
                  onChange={(e) => setSettings({ ...settings, keyword: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Supplier Verification Filter Rules */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="block text-xs font-bold text-amber-300 mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>قوانین غربالگری سابقه و اعتبار تامین‌کننده (Supplier Trust Verification):</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 cursor-pointer hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={settings.requireTradeAssurance}
                    onChange={(e) => setSettings({ ...settings, requireTradeAssurance: e.target.checked })}
                    className="accent-amber-400 rounded w-4 h-4"
                  />
                  <div>
                    <div className="font-semibold text-slate-200">الزام گواهی Trade Assurance</div>
                    <div className="text-[11px] text-slate-400">تضمین بازپرداخت مالی و کیفیت پلتفرم</div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 cursor-pointer hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={settings.requireVerifiedSupplier}
                    onChange={(e) => setSettings({ ...settings, requireVerifiedSupplier: e.target.checked })}
                    className="accent-amber-400 rounded w-4 h-4"
                  />
                  <div>
                    <div className="font-semibold text-slate-200">فقط کارخانه‌های تاییدشده (Verified)</div>
                    <div className="text-[11px] text-slate-400">بازرسی فیزیکی SGS یا TÜV در محل کارخانه</div>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/50 text-xs">
                  <div className="text-slate-400 mb-1">حداقل سابقه کارخانه:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={settings.minSupplierYears}
                      onChange={(e) => setSettings({ ...settings, minSupplierYears: Number(e.target.value) })}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <span className="font-bold text-amber-300 font-mono shrink-0">
                      {settings.minSupplierYears} سال
                    </span>
                  </div>
                </div>

                <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/50 text-xs">
                  <div className="text-slate-400 mb-1">حداقل امتیاز رضایت:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={40}
                      max={50}
                      value={settings.minRating * 10}
                      onChange={(e) => setSettings({ ...settings, minRating: Number(e.target.value) / 10 })}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <span className="font-bold text-amber-300 font-mono shrink-0">
                      {settings.minRating.toFixed(1)} ★
                    </span>
                  </div>
                </div>

                <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/50 text-xs">
                  <div className="text-slate-400 mb-1">حداکثر حداقل تیراژ (MOQ):</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.maxMoq}
                      onChange={(e) => setSettings({ ...settings, maxMoq: Number(e.target.value) || 50 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-center font-mono font-bold"
                    />
                    <span className="text-[11px] text-slate-400 shrink-0">عدد</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deduplication & Catalog Clean Tools */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">سیستم تضمین عدم ورود کالای تکراری</h3>
                <p className="text-[11px] text-slate-400">
                  تعداد کل محصولات فعال در کاتالوگ شما: <strong className="text-emerald-400 font-mono font-bold">{existingProducts.length}</strong> کالا
                </p>
              </div>
            </div>

            {onCleanDuplicates && (
              <button
                onClick={onCleanDuplicates}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                <span>پالایش و پاکسازی تکراری‌های قبلی کاتالوگ</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Scheduler Controls & Automation */}
        <div className="space-y-6">
          {/* Automated Daily Scheduler Card */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-900/60 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-900/40">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-white text-sm">
                  زمان‌بندی هوشمند خودکار روزانه
                </h2>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                settings.autoScheduleEnabled !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
              }`}>
                {settings.autoScheduleEnabled !== false ? 'فعال' : 'غیرفعال'}
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 cursor-pointer hover:bg-slate-800">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-200">فعال‌سازی اجرای خودکار روزانه</div>
                  <div className="text-[10px] text-slate-400">اجرای اتوماتیک شکار ترندها سر ساعت تعیین‌شده</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoScheduleEnabled !== false}
                  onChange={(e) => setSettings({ ...settings, autoScheduleEnabled: e.target.checked })}
                  className="accent-emerald-400 w-4 h-4 cursor-pointer"
                />
              </label>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">ساعت اجرای روزانه:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={settings.autoScheduleTime || '08:00'}
                    onChange={(e) => setSettings({ ...settings, autoScheduleTime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400 text-center"
                  />
                  <span className="text-[11px] text-slate-400 shrink-0">صبح/عصر</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  پیش‌فرض: ساعت 08:00 صبح. به محض رسیدن زمان، فرآیند در پس‌زمینه اجرا می‌شود.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">وضعیت اجرای امروز:</span>
                  <span className={`font-bold font-mono text-[11px] ${
                    isAutoRunDoneToday ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {isAutoRunDoneToday ? '✓ انجام شد' : 'در نوبت اجرا'}
                  </span>
                </div>
                {settings.lastAutoRunDate && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">آخرین اجرا:</span>
                    <span className="text-slate-300 font-mono">{settings.lastAutoRunDate}</span>
                  </div>
                )}
              </div>

              {/* Immediate Test Button */}
              <button
                onClick={() => handleStartHunt(true)}
                disabled={isRunning}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-xs bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-700/60 transition cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>تست فوری اجرای زمان‌بند (همین الان)</span>
              </button>
            </div>
          </div>

          {/* Automated Margins & Calculations */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-white text-sm sm:text-base">
                فرمول محاسبه قیمت فروش تومانی
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">حاشیه سود مورد انتظار فروش در تلگرام:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={20}
                    max={120}
                    value={settings.targetMarginPercent}
                    onChange={(e) => setSettings({ ...settings, targetMarginPercent: Number(e.target.value) })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <span className="font-bold text-emerald-400 font-mono shrink-0">
                    +{settings.targetMarginPercent}٪
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-slate-300 font-semibold mb-1">خودکارسازی فرآیند پس از شکار کالا:</div>

                

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>تولید خودکار پست آماده تلگرام</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoGenerateTelegramPost}
                    onChange={(e) => setSettings({ ...settings, autoGenerateTelegramPost: e.target.checked })}
                    className="accent-amber-400 w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 cursor-pointer hover:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="text-slate-200 text-xs font-semibold">ارسال خودکار به کانال تلگرام پس از شکار</div>
                      <div className="text-[10px] text-slate-400">بدون نیاز به تایید دستی قیمت</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!settings.autoBroadcastToTelegram}
                    onChange={(e) => setSettings({ ...settings, autoBroadcastToTelegram: e.target.checked })}
                    className="accent-amber-400 w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
