import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  DollarSign,
  TrendingUp,
  Percent,
  Truck,
  Check,
  Calculator,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Layers,
  Coins,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { ProductItem, CurrencyRates, TieredPrice } from '../types';

interface SmartPricingCardProps {
  product: ProductItem;
  currencyRates: CurrencyRates;
  onApplyPricing?: (updatedProduct: ProductItem) => void;
  onClose?: () => void;
}

export const SmartPricingCard: React.FC<SmartPricingCardProps> = ({
  product,
  currencyRates,
  onApplyPricing,
  onClose,
}) => {
  // Target Profit Margin (default 25%)
  const [targetMargin, setTargetMargin] = useState<number>(25);

  // Selected base currency for land cost calculation
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'AED' | 'CNY'>('USD');

  // Weight-based cargo & customs inputs (saved per product)
  const [weightKg, setWeightKg] = useState<number>(product.weightKg || 1);
  const [routeType, setRouteType] = useState<'china_dubai_iran' | 'china_iran_direct' | 'dubai_iran'>(
    product.routeType || 'china_dubai_iran'
  );
  const [customsPerKg] = useState<number>(product.customsPerKg || 700000);

  // Temporary live rate override (in case user wants to simulate currency surge)
  const [activeRate, setActiveRate] = useState<number>(currencyRates.usd);

  // Sync activeRate when currency rates change or selected currency changes
  React.useEffect(() => {
    if (selectedCurrency === 'USD') setActiveRate(currencyRates.usd);
    else if (selectedCurrency === 'AED') setActiveRate(currencyRates.aed);
    else if (selectedCurrency === 'CNY') setActiveRate(currencyRates.cny);
  }, [selectedCurrency, currencyRates]);

  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Predefined profit margin strategy presets
  const marginPresets = [
    { label: 'سفارش کانتینری / VIP', percent: 15, tag: 'فروش انبوه' },
    { label: 'عمده استاندارد (کارتنی)', percent: 25, tag: 'پیش‌فرض B2B' },
    { label: 'توزیع استانی و بنکداری', percent: 35, tag: 'سود بهینه' },
    { label: 'مارکت‌پلیس و تک‌فروشی', percent: 50, tag: 'حداکثر سود' },
  ];

  // Base purchase cost in foreign currency
  const baseCostForeign = useMemo(() => {
    const usd = Number(product.costPerUnitUsd) || 0;
    if (selectedCurrency === 'USD') return usd;
    if (selectedCurrency === 'CNY') return Number(product.costPerUnitCny) || Number((usd * 7.24).toFixed(1));
    return Number(product.costPerUnitAed) || Number((usd * 3.67).toFixed(1));
  }, [product, selectedCurrency]);

  // Land Cost calculations in Iranian Toman
  const rawCostToman = Math.round(baseCostForeign * activeRate);
  const shippingCostToman = useMemo(() => {
    const w = Math.max(0.1, weightKg);
    const cargo =
      routeType === 'china_dubai_iran'
        ? w * 48 * currencyRates.aed
        : routeType === 'china_iran_direct'
          ? w * 55 * currencyRates.cny
          : w * 20 * currencyRates.aed;
    const customs = w * customsPerKg;
    return Math.round(cargo + customs);
  }, [weightKg, routeType, customsPerKg, currencyRates]);
  const totalLandCostToman = rawCostToman + shippingCostToman;

  // Calculated Smart Tiered Prices
  const smartTiers = useMemo(() => {
    const moq = product.moq || 30;

    // Tier 1: Minimum Order (Base Margin)
    const tier1Margin = targetMargin;
    const tier1Price = Math.round((totalLandCostToman * (1 + tier1Margin / 100)) / 1000) * 1000;
    const tier1UnitProfit = tier1Price - totalLandCostToman;

    // Tier 2: Carton / Medium Bulk (3x MOQ) - 4% volume incentive
    const tier2Margin = Math.max(8, targetMargin - 4);
    const tier2Price = Math.round((totalLandCostToman * (1 + tier2Margin / 100)) / 1000) * 1000;
    const tier2Qty = moq * 3;
    const tier2UnitProfit = tier2Price - totalLandCostToman;

    // Tier 3: Enterprise / Master Carton (10x MOQ) - 8% volume incentive
    const tier3Margin = Math.max(6, targetMargin - 8);
    const tier3Price = Math.round((totalLandCostToman * (1 + tier3Margin / 100)) / 1000) * 1000;
    const tier3Qty = moq * 10;
    const tier3UnitProfit = tier3Price - totalLandCostToman;

    // Retail MSRP Recommendation (Consumer Market Price)
    const msrpPrice = Math.round((totalLandCostToman * (1 + (targetMargin + 35) / 100)) / 1000) * 1000;
    const buyerMarginPercent = Math.round(((msrpPrice - tier1Price) / msrpPrice) * 100);

    return {
      tier1: {
        qty: moq,
        price: tier1Price,
        margin: tier1Margin,
        unitProfit: tier1UnitProfit,
        totalProfit: tier1UnitProfit * moq,
      },
      tier2: {
        qty: tier2Qty,
        price: tier2Price,
        margin: tier2Margin,
        unitProfit: tier2UnitProfit,
        totalProfit: tier2UnitProfit * tier2Qty,
      },
      tier3: {
        qty: tier3Qty,
        price: tier3Price,
        margin: tier3Margin,
        unitProfit: tier3UnitProfit,
        totalProfit: tier3UnitProfit * tier3Qty,
      },
      msrp: {
        price: msrpPrice,
        buyerMarginPercent,
      },
    };
  }, [totalLandCostToman, targetMargin, product.moq]);

  // Handle 1-click apply to product
  const handleApplyToProduct = () => {
    if (!onApplyPricing) return;

    const newTieredPricing: TieredPrice[] = [
      {
        minQuantity: smartTiers.tier1.qty,
        maxQuantity: smartTiers.tier2.qty - 1,
        priceUsd: Number((smartTiers.tier1.price / currencyRates.usd).toFixed(2)),
        priceCny: Number((smartTiers.tier1.price / currencyRates.cny).toFixed(1)),
        priceAed: Number((smartTiers.tier1.price / currencyRates.aed).toFixed(1)),
        calculatedPriceToman: smartTiers.tier1.price,
      },
      {
        minQuantity: smartTiers.tier2.qty,
        maxQuantity: smartTiers.tier3.qty - 1,
        priceUsd: Number((smartTiers.tier2.price / currencyRates.usd).toFixed(2)),
        priceCny: Number((smartTiers.tier2.price / currencyRates.cny).toFixed(1)),
        priceAed: Number((smartTiers.tier2.price / currencyRates.aed).toFixed(1)),
        calculatedPriceToman: smartTiers.tier2.price,
      },
      {
        minQuantity: smartTiers.tier3.qty,
        maxQuantity: undefined,
        priceUsd: Number((smartTiers.tier3.price / currencyRates.usd).toFixed(2)),
        priceCny: Number((smartTiers.tier3.price / currencyRates.cny).toFixed(1)),
        priceAed: Number((smartTiers.tier3.price / currencyRates.aed).toFixed(1)),
        calculatedPriceToman: smartTiers.tier3.price,
      },
    ];

    const updated: ProductItem = {
      ...product,
      tieredPricing: newTieredPricing,
      estimatedMarginPercent: targetMargin,
      weightKg,
      routeType,
      customsPerKg,
    };

    onApplyPricing(updated);
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 3000);
  };

  return (
    <div className="relative rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-7 shadow-2xl space-y-6 transition-all">
      {/* Ambient Top Glow */}
      <div className="absolute top-0 right-1/4 w-80 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {!(baseCostForeign > 0) && (
        <div className="relative p-3 rounded-xl text-xs bg-rose-900/40 text-rose-200 border border-rose-500/40">
          قیمت خرید این محصول ثبت نشده است؛ محاسبه قیمت انجام نمی‌شود. ابتدا قیمت خرید را در کاتالوگ ثبت کنید.
        </div>
      )}

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20 shrink-0">
            <Calculator className="w-5 h-5 text-slate-950" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                موتور پیشنهاد قیمت‌گذاری هوشمند بازرگانی
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                نرخ زنده ارز
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              محاسبه قیمت تمام‌شده و بهینه‌سازی حاشیه سود عمده برای: <strong className="text-slate-200">{product.faTitle}</strong>
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-end sm:self-auto p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="بستن کارت"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Control Knobs: Currency, Margin, and Cargo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Knob 1: Currency & Live Rate */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>ارز پایه و نرخ لحظه‌ای</span>
            </span>
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <button
                onClick={() => setSelectedCurrency('USD')}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  selectedCurrency === 'USD' ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                USD
              </button>
              <button
                onClick={() => setSelectedCurrency('AED')}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  selectedCurrency === 'AED' ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                AED
              </button>
              <button
                onClick={() => setSelectedCurrency('CNY')}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  selectedCurrency === 'CNY' ? 'bg-rose-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                CNY
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">قیمت خرید ارزی:</span>
              <span className="font-mono font-bold text-white text-xs">
                {selectedCurrency === 'USD' ? `$${baseCostForeign}` : selectedCurrency === 'AED' ? `${baseCostForeign} AED` : `¥${baseCostForeign}`}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">نرخ تبدیل لحظه‌ای:</span>
              <span className="font-mono font-bold text-amber-300 text-xs">
                {activeRate.toLocaleString('en-US')} تومان
              </span>
            </div>

            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">خرید خام (بدون حمل):</span>
              <span className="font-mono text-slate-300 text-[11px]">
                {rawCostToman.toLocaleString('en-US')} تومان
              </span>
            </div>
          </div>
        </div>

        {/* Knob 2: Target Margin Slider */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-emerald-400" />
              <span>حاشیه سود هدف بازرگانی</span>
            </span>
            <span className="font-mono font-extrabold text-emerald-400 text-sm">
              {targetMargin}%
            </span>
          </div>

          <input
            type="range"
            min={5}
            max={75}
            step={1}
            value={targetMargin}
            onChange={(e) => setTargetMargin(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />

          {/* Quick Margin Presets */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {marginPresets.map((preset) => (
              <button
                key={preset.percent}
                onClick={() => setTargetMargin(preset.percent)}
                className={`text-[10px] py-1 px-2 rounded-lg text-right font-medium transition cursor-pointer ${
                  targetMargin === preset.percent
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{preset.percent}% </span>
                <span className="opacity-75">{preset.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Knob 3: Land Cost Breakdown */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-sky-400" />
              <span>کارگو و ترخیص وزنی</span>
            </span>
            <span className="font-mono text-sky-400 font-bold text-xs">{weightKg} kg</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">وزن ناخالص (کیلوگرم):</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">مسیر حمل هوایی:</label>
              <select
                value={routeType}
                onChange={(e) => setRouteType(e.target.value as typeof routeType)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white"
              >
                <option value="china_dubai_iran">چین ➔ دبی ➔ ایران (۴۸ درهم)</option>
                <option value="china_iran_direct">مستقیم چین ➔ ایران (۵۵ یوان)</option>
                <option value="dubai_iran">فقط دبی ➔ ایران (۲۰ درهم)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5 text-xs pt-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">هزینه کارگو + ترخیص:</span>
              <span className="font-mono text-slate-300 text-[11px]">
                {shippingCostToman.toLocaleString('en-US')} تومان
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="font-bold text-white text-[11px]">قیمت تمام‌شده نهایی:</span>
              <span className="font-mono font-extrabold text-amber-300 text-xs">
                {totalLandCostToman.toLocaleString('en-US')} تومان
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Tier Recommendations Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs sm:text-sm text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E63946]" />
            <span>سناریوهای پیشنهادی قیمت‌گذاری پلکانی بر اساس کشش بازار</span>
          </h4>
          <span className="text-[11px] text-slate-400">قیمت‌ها با رندسازی به نزدیک‌ترین هزار تومان</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Tier 1: Minimum MOQ */}
          <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 hover:border-amber-500/40 transition space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">تیراژ حداقل (MOQ)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold">
                {smartTiers.tier1.qty} عدد
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400">قیمت پیشنهادی هر واحد:</div>
              <div className="text-base font-extrabold text-amber-400 font-mono">
                {smartTiers.tier1.price.toLocaleString('en-US')} <span className="text-[10px] text-slate-400 font-sans">تومان</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">حاشیه سود:</span>
              <span className="font-bold text-emerald-400 font-mono">{smartTiers.tier1.margin}%</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">سود هر فاکتور:</span>
              <span className="font-bold text-slate-200 font-mono">
                {(smartTiers.tier1.totalProfit / 1000000).toFixed(2)} M تومان
              </span>
            </div>
          </div>

          {/* Tier 2: Bulk Carton (Best Seller) */}
          <div className="bg-slate-950/90 p-4 rounded-2xl border-2 border-amber-500/60 shadow-lg shadow-amber-500/10 space-y-2.5 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-br-lg uppercase">
              پیشنهاد ویژه همکار
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300">تیراژ کارتنی (متوسط)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                {smartTiers.tier2.qty} عدد
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400">قیمت پیشنهادی هر واحد:</div>
              <div className="text-base font-extrabold text-amber-300 font-mono">
                {smartTiers.tier2.price.toLocaleString('en-US')} <span className="text-[10px] text-slate-400 font-sans">تومان</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">حاشیه سود:</span>
              <span className="font-bold text-emerald-400 font-mono">{smartTiers.tier2.margin}%</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">سود کل فاکتور:</span>
              <span className="font-bold text-emerald-300 font-mono">
                {(smartTiers.tier2.totalProfit / 1000000).toFixed(2)} M تومان
              </span>
            </div>
          </div>

          {/* Tier 3: Enterprise / Master Carton */}
          <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">تیراژ کانتینری / پخش</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                {smartTiers.tier3.qty}+ عدد
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400">قیمت پیشنهادی هر واحد:</div>
              <div className="text-base font-extrabold text-emerald-400 font-mono">
                {smartTiers.tier3.price.toLocaleString('en-US')} <span className="text-[10px] text-slate-400 font-sans">تومان</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">حاشیه سود:</span>
              <span className="font-bold text-emerald-400 font-mono">{smartTiers.tier3.margin}%</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">سود کل فاکتور:</span>
              <span className="font-bold text-slate-200 font-mono">
                {(smartTiers.tier3.totalProfit / 1000000).toFixed(1)} M تومان
              </span>
            </div>
          </div>

          {/* Tier 4: Suggested Retail MSRP */}
          <div className="bg-gradient-to-br from-indigo-950/50 to-slate-950 p-4 rounded-2xl border border-indigo-800/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300">تک‌فروشی بازار (MSRP)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                دیجی‌کالا / وب‌استور
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400">قیمت فروش مصرف‌کننده:</div>
              <div className="text-base font-extrabold text-sky-400 font-mono">
                {smartTiers.msrp.price.toLocaleString('en-US')} <span className="text-[10px] text-slate-400 font-sans">تومان</span>
              </div>
            </div>

            <div className="pt-2 border-t border-indigo-900/50 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">جذابیت سود خریدار عمده:</span>
              <span className="font-bold text-emerald-400 font-mono">
                %{smartTiers.msrp.buyerMarginPercent} سود
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
              همکار با خرید از شما {smartTiers.msrp.buyerMarginPercent}٪ مارجین عالی در بازار خواهد داشت.
            </p>
          </div>
        </div>
      </div>

      {/* Strategic AI Recommendation & 1-Click Apply */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>توصیه استراتژیک الگوریتم قیمت‌گذاری:</span>
              <span className="text-emerald-400 font-normal">
                پوشش 100٪ نوسانات ارزی و تضمین سود ناخالص
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              این ساختار پلکانی باعث می‌شود مشتریان ترغیب به ثبت سفارش در تیراژ {smartTiers.tier2.qty} عددی شوند که سود نقدی فاکتور شما را به{' '}
              <strong className="text-white">{(smartTiers.tier2.totalProfit / 1000000).toFixed(1)} میلیون تومان</strong> می‌رساند.
            </p>
          </div>
        </div>

        {onApplyPricing && (
          <button
            onClick={handleApplyToProduct}
            className={`w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition cursor-pointer active:scale-95 ${
              appliedSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/20'
            }`}
          >
            {appliedSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>قیمت‌ها روی محصول اعمال شدند!</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 fill-slate-950" />
                <span>اعمال این قیمت‌ها روی کاتالوگ و شیت</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
