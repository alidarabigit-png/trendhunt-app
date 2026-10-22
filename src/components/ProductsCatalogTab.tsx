import React, { useState } from 'react';
import {
  Package,
  Search,
  ExternalLink,
  ShieldCheck,
  Award,
  Send,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  TrendingUp,
  Tag,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Building,
  Globe,
  Sparkles,
  Calculator,
  RefreshCw,
  Plus,
  Image as ImageIcon,
  Link2,
  Copy,
  Check,
  Save,
  RotateCcw,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { ProductItem, CurrencyRates } from '../types';
import { exportProductsToCSV } from '../services/googleSheets';
import { CompetitorAnalysisModal } from './CompetitorAnalysisModal';
import { SmartPricingCard } from './SmartPricingCard';
import { ProductGalleryModal } from './ProductGalleryModal';
import { getPlatformSearchUrl, getGoogleImagesSearchUrl, getCleanWorkingSourceUrl } from '../utils/sourceUrlUtils';
import { deduplicateProducts } from '../utils/catalogUtils';

interface ProductsCatalogTabProps {
  products: ProductItem[];
  onSyncProductToSheets: (product: ProductItem) => void;
  onSyncAllToSheets: () => void;
  onSelectForTelegramPost: (product: ProductItem) => void;
  onSelectForMiniApp: (product: ProductItem) => void;
  onDeleteProduct: (productId: string) => void;
  onOpenWebStoreSync: (product: ProductItem) => void;
  isSyncing: boolean;
  usdRate: number;
  currencyRates: CurrencyRates;
  selectedProduct?: ProductItem | null;
  onSelectProduct?: (p: ProductItem) => void;
  onUpdateProductPricing?: (p: ProductItem) => void;
  onImportFromSheets?: () => void;
  sheetsConfig?: { spreadsheetId: string | null; sheetTitle?: string };
  onCleanDuplicates?: () => void;
  onUpdateProductImages?: (productId: string, newImages: string[], newMainImage: string) => void;
  onResetCatalogToMaster?: () => void;
  onSaveCatalogToCloud?: () => void;
  onRestoreBackup?: () => void;
  onOpenMediaUpload?: () => void;
  onSyncFromLiveHost?: () => void;
}

export const ProductsCatalogTab: React.FC<ProductsCatalogTabProps> = ({
  products,
  onSyncProductToSheets,
  onSyncAllToSheets,
  onSelectForTelegramPost,
  onSelectForMiniApp,
  onDeleteProduct,
  onOpenWebStoreSync,
  isSyncing,
  usdRate,
  currencyRates,
  selectedProduct,
  onSelectProduct,
  onUpdateProductPricing,
  onImportFromSheets,
  sheetsConfig,
  onCleanDuplicates,
  onUpdateProductImages,
  onResetCatalogToMaster,
  onSaveCatalogToCloud,
  onRestoreBackup,
  onOpenMediaUpload,
  onSyncFromLiveHost,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('همه');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(products[0]?.id || null);
  const [analyzingProduct, setAnalyzingProduct] = useState<ProductItem | null>(null);
  const [galleryProduct, setGalleryProduct] = useState<ProductItem | null>(null);
  const [activeImageMap, setActiveImageMap] = useState<Record<string, string>>({});
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const hasBackup = typeof window !== 'undefined' && Boolean(localStorage.getItem('nfs_catalog_last_backup'));
  const [activePricingProduct, setActivePricingProduct] = useState<ProductItem | null>(
    selectedProduct || products[0] || null
  );
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [copiedUrlProductId, setCopiedUrlProductId] = useState<string | null>(null);
  const [editingUrlProductId, setEditingUrlProductId] = useState<string | null>(null);
  const [tempUrlValue, setTempUrlValue] = useState<string>('');
  const [isCachingImages, setIsCachingImages] = useState(false);
  const [cacheResultMsg, setCacheResultMsg] = useState<string | null>(null);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    const currentSrc = target.src;
    if (!currentSrc.includes('action=image_proxy') && !currentSrc.includes('/uploads/')) {
      target.src = `https://nfs.nafisstore.com/api.php?action=image_proxy&url=${encodeURIComponent(currentSrc)}`;
    } else {
      target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%23f59e0b" font-family="sans-serif" font-weight="bold" font-size="16">NFS Smart Trade</text><text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="13">تصویر محصول عمده</text></svg>';
    }
  };

  const handleCacheImagesToHost = async () => {
    setIsCachingImages(true);
    setCacheResultMsg(null);
    try {
      const isPhpHost = window.location.hostname.includes('nafisstore.com') || window.location.pathname.includes('.php');
      const ep = isPhpHost ? '/api.php?action=cache_catalog_images' : 'https://nfs.nafisstore.com/api.php?action=cache_catalog_images';
      const res = await fetch(ep, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCacheResultMsg(`✅ تمام عکس‌ها (${data.cached_images_count || 0}) با موفقیت در پوشه uploads هاست ذخیره شدند.`);
        if (onSyncFromLiveHost) onSyncFromLiveHost();
      } else {
        setCacheResultMsg('⚠️ ' + (data.error || 'خطا در ارتباط با سرور هاست'));
      }
    } catch (e: any) {
      setCacheResultMsg('❌ خطا در برقراری ارتباط با هاست');
    } finally {
      setIsCachingImages(false);
      setTimeout(() => setCacheResultMsg(null), 8000);
    }
  };

  const handleCopySourceUrl = (productId: string, url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedUrlProductId(productId);
    setTimeout(() => setCopiedUrlProductId(null), 2500);
  };

  const handleSaveSourceUrl = (product: ProductItem) => {
    if (onUpdateProductPricing && tempUrlValue.trim()) {
      onUpdateProductPricing({
        ...product,
        sourceUrl: tempUrlValue.trim(),
      });
    }
    setEditingUrlProductId(null);
  };

  React.useEffect(() => {
    if (selectedProduct) {
      setActivePricingProduct(selectedProduct);
    }
  }, [selectedProduct]);

  const cleanProducts = React.useMemo(() => deduplicateProducts(products), [products]);
  const categories = ['همه', ...Array.from(new Set(cleanProducts.map((p) => p.category)))];

  const filtered = cleanProducts.filter((p) => {
    const matchesSearch =
      p.faTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.originalTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCat = selectedCategory === 'همه' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">

      {/* Controls & Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        {/* Top Row: Search & Global Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="جستجو در عنوان، دسته‌بندی، مشخصات یا تامین‌کننده..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 placeholder:text-slate-400 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-white text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">

            <button
              onClick={() => exportProductsToCSV(products)}
              title="دانلود جدول کاتالوگ به فرمت اکسل و CSV"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>خروجی اکسل / CSV</span>
            </button>

            {onOpenMediaUpload && (
              <button
                onClick={onOpenMediaUpload}
                title="مرکز آپلود عکس مستقیم به پوشه uploads هاست و دریافت لینک مستقیم"
                className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>📸 آپلودسنتر هاست</span>
              </button>
            )}

            {onSaveCatalogToCloud && (
              <button
                onClick={onSaveCatalogToCloud}
                title="ذخیره دائمی کاتالوگ و کلیه عکس‌های آپلودشده روی سرور ابری"
                className="flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>💾 ذخیره کاتالوگ در سرور</span>
              </button>
            )}

            {hasBackup && onRestoreBackup && (
              <button
                onClick={onRestoreBackup}
                title="بازیابی تغییرات و عکس‌ها از آخرین نسخه پشتیبان"
                className="flex items-center gap-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                <span>بازیابی پشتیبان قبلی</span>
              </button>
            )}


            <button
              onClick={handleCacheImagesToHost}
              disabled={isCachingImages}
              title="دانلود و ذخیره خودکار تمام عکس‌های کاتالوگ در پوشه uploads هاست برای رفع دائمی مشکل نمایش عکس در ایران"
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black shadow-md shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-slate-950" />
              <span>{isCachingImages ? 'در حال ذخیره عکس‌ها در هاست...' : '⚡ ذخیره خودکار عکس‌ها در هاست'}</span>
            </button>


          </div>
        </div>

        {cacheResultMsg && (
          <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs text-amber-200 animate-fadeIn flex items-center justify-between">
            <span>{cacheResultMsg}</span>
            <button onClick={() => setCacheResultMsg(null)} className="text-slate-400 hover:text-white text-xs px-2 cursor-pointer">✕</button>
          </div>
        )}

        {/* Bottom Row: Category Filter Tabs */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
            {categories.map((c) => {
              const count = c === 'همه' ? products.length : products.filter((p) => p.category === c).length;
              const isSelected = selectedCategory === c;
              return (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`text-xs px-3.5 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <span>{c}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Smart Pricing Recommendations Card for Selected Product */}
      {activePricingProduct && (
        <div className="animate-fadeIn">
          <SmartPricingCard
            product={activePricingProduct}
            currencyRates={currencyRates}
            onApplyPricing={(updated) => {
              if (onUpdateProductPricing) onUpdateProductPricing(updated);
              setActivePricingProduct(updated);
            }}
            onClose={() => setActivePricingProduct(null)}
          />
        </div>
      )}

      {/* Products List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">هیچ محصولی با این مشخصات یافت نشد</h3>
          <p className="text-xs text-slate-500">
            می‌توانید از تب ایجنت برای شکار محصولات جدید اقدام فرمایید.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((product) => {
            const isExpanded = expandedProduct === product.id;
            const isSelectedForPricing = activePricingProduct?.id === product.id;

            return (
              <div
                key={product.id}
                className={`bg-slate-900/90 border rounded-2xl overflow-hidden shadow-lg transition ${
                  isSelectedForPricing
                    ? 'border-amber-500/80 ring-2 ring-amber-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Product Summary Header Card */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row gap-5">
                  {/* Thumbnail, Multi-Image Strip & Trend Tag */}
                  <div className="flex flex-col gap-2 w-full md:w-56 shrink-0">
                    <div
                      onClick={() => {
                        setActivePricingProduct(product);
                        if (onSelectProduct) onSelectProduct(product);
                      }}
                      className="relative w-full h-48 md:h-44 rounded-xl overflow-hidden bg-slate-800 cursor-pointer group"
                      title="کلیک کنید برای انتخاب و مشاهده پیشنهادات هوشمند قیمت‌گذاری"
                    >
                      <img
                        src={activeImageMap[product.id] || product.mainImage}
                        alt={product.faTitle}
                        onError={handleImageError}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-300 flex items-center gap-1 border border-amber-500/30">
                        <TrendingUp className="w-3 h-3 text-amber-400" />
                        <span>ترند {product.trendScore}٪</span>
                      </div>

                      <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-slate-300">
                        حداقل سفارش: {product.moq} عدد
                      </div>

                      {product.images && product.images.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-amber-300 font-bold flex items-center gap-1 border border-white/10">
                          <Layers className="w-3 h-3" />
                          <span>{product.images.length} تصویر</span>
                        </div>
                      )}
                    </div>

                    {/* Interactive Thumbnail Carousel Strip */}
                    {product.images && product.images.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {product.images.map((imgUrl, i) => {
                          const isCurrent = (activeImageMap[product.id] || product.mainImage) === imgUrl;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveImageMap((prev) => ({ ...prev, [product.id]: imgUrl }));
                              }}
                              className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition cursor-pointer shrink-0 ${
                                isCurrent
                                  ? 'border-amber-400 scale-105 shadow-sm'
                                  : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600'
                              }`}
                            >
                              <img src={imgUrl} alt="" onError={handleImageError} className="w-full h-full object-cover" />
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGalleryProduct(product);
                          }}
                          className="w-10 h-10 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition cursor-pointer shrink-0"
                          title="مدیریت و افزودن عکس بیشتر"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {(!product.images || product.images.length <= 1) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGalleryProduct(product);
                        }}
                        className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center justify-center gap-1 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن تصاویر بیشتر</span>
                      </button>
                    )}
                  </div>

                  {/* Main Details */}
                  <div className="flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {product.category}
                        </span>

                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono">
                          {product.supplier.platform}
                        </span>

                        {product.supplier.hasTradeAssurance && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            تضمین Trade Assurance
                          </span>
                        )}

                        {product.isSyncedToSheets && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-600/30 text-emerald-200 border border-emerald-400/40 flex items-center gap-1 mr-auto">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ثبت در گوگل شیت
                          </span>
                        )}
                      </div>

                      {/* Persian SEO Title */}
                      <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                        {product.faTitle}
                      </h3>

                      <p className="text-xs text-slate-400 font-mono mt-0.5 line-clamp-1" dir="ltr">
                        {product.originalTitle}
                      </p>

                      {/* Short Description */}
                      <p className="text-xs text-slate-300 mt-2.5 leading-relaxed line-clamp-2">
                        {product.faShortDesc}
                      </p>
                    </div>

                    {/* Pricing Preview & Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                      {/* Price Range Preview */}
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-[11px] text-slate-400">قیمت خرید دلاری عمده:</div>
                          <div className="text-sm font-extrabold text-amber-300 font-mono">
                            ${product.tieredPricing[product.tieredPricing.length - 1]?.priceUsd} ~ ${product.tieredPricing[0]?.priceUsd}
                          </div>
                        </div>

                        <div className="w-px h-8 bg-slate-800"></div>

                        <div>
                          <div className="text-[11px] text-slate-400">فروش پیشنهادی تومانی:</div>
                          <div className="text-sm font-extrabold text-emerald-400 font-mono">
                            {product.tieredPricing[0]?.calculatedPriceToman?.toLocaleString('en-US')} تومان
                          </div>
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setGalleryProduct(product)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-semibold transition cursor-pointer"
                          title="مشاهده، افزودن و مدیریت تصاویر گالری کالا"
                        >
                          <Layers className="w-3.5 h-3.5 text-amber-400" />
                          <span>گالری ({product.images?.length || 1})</span>
                        </button>

                        <button
                          onClick={() => onSelectForMiniApp(product)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition cursor-pointer"
                          title="نمایش در مینی‌آپ تلگرام"
                        >
                          <span>مینی‌آپ</span>
                        </button>

                        <button
                          onClick={() => onSelectForTelegramPost(product)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 text-xs font-semibold transition cursor-pointer"
                          title="تولید پست کانال تلگرام"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>پست تلگرام</span>
                        </button>

                        <button
                          onClick={() => onSyncProductToSheets(product)}
                          disabled={isSyncing}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                          title="ارسال تکی به گوگل شیت در درایو"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>گوگل شیت</span>
                        </button>

                        <button
                          onClick={() => onOpenWebStoreSync(product)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#4A70A9]/20 hover:bg-[#4A70A9]/35 text-[#8FABD4] border border-[#4A70A9]/40 text-xs font-bold transition cursor-pointer"
                          title="انتقال اطلاعات سئوشده به صفحه محصول وب‌سایت nafisstore.com"
                        >
                          <Globe className="w-3.5 h-3.5 text-[#4A70A9]" />
                          <span>انتقال به سایت</span>
                          {product.isSyncedToWebsite && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setActivePricingProduct(product);
                            if (onSelectProduct) onSelectProduct(product);
                            window.scrollTo({ top: 100, behavior: 'smooth' });
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                            isSelectedForPricing
                              ? 'bg-amber-400 text-slate-950 font-black shadow-amber-500/20 ring-1 ring-amber-400'
                              : 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                          }`}
                          title="مشاهده و بهینه‌سازی پیشنهادات هوشمند قیمت‌گذاری بر اساس حاشیه سود هدف و نرخ ارز"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>پیشنهاد قیمت‌گذاری هوشمند</span>
                        </button>

                        <button
                          onClick={() => setAnalyzingProduct(product)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/40 text-xs font-bold transition cursor-pointer shadow-sm"
                          title="تحلیل قیمت و ویژگی‌ها در دیجی‌کالا و ترب با Gemini"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>تحلیل رقبا (ترب/دیجی‌کالا)</span>
                        </button>

                        {deletingProductId === product.id ? (
                          <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-500/70 rounded-xl px-2 py-1 shadow-lg animate-in fade-in">
                            <span className="text-[11px] text-rose-200 font-bold whitespace-nowrap">حذف کالا؟</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProduct(product.id);
                                setDeletingProductId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md transition cursor-pointer"
                            >
                              بله، حذف کن
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingProductId(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                            >
                              انصراف
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingProductId(product.id);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition cursor-pointer shadow-sm"
                            title="حذف دائمی این کالا از کاتالوگ"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>حذف محصول</span>
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                          title="مشاهده پرونده کامل فنی و تامین‌کننده"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Dossier: Technical Specs, Supplier Audit & Tiered Pricing */}
                {isExpanded && (
                  <div className="bg-slate-950/60 p-4 sm:p-6 border-t border-slate-800/80 space-y-6 animate-fadeIn">
                    {/* Full Description & Key Selling Features */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Info className="w-4 h-4" />
                        <span>معرفی تفصیلی و ویژگی‌های سئوشده:</span>
                      </h4>
                      <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                        {product.faFullDesc}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {product.faFeatures.map((feat, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/40 px-3 py-2 rounded-lg border border-slate-800/60"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Tiered Pricing Table */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-4 h-4" />
                          <span>جدول قیمت‌های پلکانی عمده (Wholesale Tiered Pricing):</span>
                        </h4>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-right border-collapse">
                            <thead>
                              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                                <th className="p-2.5">تیراژ سفارش</th>
                                <th className="p-2.5">قیمت واحد (ارز)</th>
                                <th className="p-2.5">قیمت واحد (تومان)</th>
                                <th className="p-2.5">سود تخمینی</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {product.tieredPricing.map((tier, idx) => (
                                <tr key={idx} className="hover:bg-slate-900/40">
                                  <td className="p-2.5 font-medium text-slate-200">
                                    {tier.maxQuantity
                                      ? `${tier.minQuantity} تا ${tier.maxQuantity} عدد`
                                      : `بیشتر از ${tier.minQuantity} عدد`}
                                  </td>
                                  <td className="p-2.5 font-mono text-amber-300 font-bold">
                                    ${tier.priceUsd.toFixed(2)}
                                  </td>
                                  <td className="p-2.5 font-mono text-emerald-400 font-bold">
                                    {tier.calculatedPriceToman?.toLocaleString('en-US')} تومان
                                  </td>
                                  <td className="p-2.5 text-slate-400">
                                    %{product.estimatedMarginPercent - idx * 5} سود
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Technical Specs Map */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag className="w-4 h-4" />
                          <span>مشخصات فنی و استانداردها (Technical Specifications):</span>
                        </h4>

                        <div className="bg-slate-900/60 rounded-xl border border-slate-800 divide-y divide-slate-800/60 text-xs">
                          {Object.entries(product.technicalSpecs).map(([specKey, specVal]) => (
                            <div key={specKey} className="flex justify-between items-center p-2.5">
                              <span className="text-slate-400">{specKey}:</span>
                              <span className="text-slate-200 font-medium text-left" dir="ltr">
                                {specVal}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Supplier Reliability & Audit Card with Direct Source URL */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3.5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold text-white">
                              تامین‌کننده: {product.supplier.name}
                            </span>
                            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                              {product.supplier.city}، {product.supplier.country}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                            <span>سابقه: <strong className="text-slate-200">{product.supplier.yearsInBusiness} سال</strong></span>
                            <span>•</span>
                            <span>امتیاز رضایت: <strong className="text-amber-300 font-mono">{product.supplier.rating} ★</strong> ({product.supplier.reviewCount} نظر)</span>
                            <span>•</span>
                            <span>نرخ پاسخگویی: <strong className="text-emerald-400 font-mono">{product.supplier.responseRate}</strong></span>
                            <span>•</span>
                            <span>تحویل به‌موقع: <strong className="text-emerald-400 font-mono">{product.supplier.onTimeDeliveryRate}</strong></span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-end md:self-auto shrink-0">
                          {/* Direct Google Images Multi-photo & Video Search */}
                          <a
                            href={getGoogleImagesSearchUrl(product.originalTitle || product.faTitle)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-500/30 text-xs font-semibold transition"
                            title="مشاهده صدها تصویر ژورنالی، تست کیفیت، بسته‌بندی و ویدیو در Google Images"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                            <span>عکس‌های بیشتر (Google)</span>
                          </a>

                          {/* If not Alibaba, offer quick Alibaba compare */}
                          {product.supplier.platform !== 'Alibaba' && (
                            <a
                              href={`https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(product.originalTitle || product.faTitle)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700"
                              title="مقایسه قیمت کارخانه‌های علی‌بابا"
                            >
                              <span>Alibaba</span>
                            </a>
                          )}

                          <button
                            onClick={() => onDeleteProduct(product.id)}
                            className="p-2 rounded-lg hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                            title="حذف از کاتالوگ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Direct Source Link Bar (Exact product URL from Alibaba/1688) */}
                      <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/90">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                            <Link2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>لینک مستقیم محصول در سایت مبدأ ({product.supplier.platform || 'Alibaba / 1688'}):</span>
                          </div>
                          {editingUrlProductId === product.id ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="text"
                                value={tempUrlValue}
                                onChange={(e) => setTempUrlValue(e.target.value)}
                                placeholder="https://detail.1688.com/offer/... یا https://alibaba.com/..."
                                className="flex-1 bg-slate-900 border border-amber-500/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                                dir="ltr"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveSourceUrl(product)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow"
                              >
                                ذخیره
                              </button>
                              <button
                                onClick={() => setEditingUrlProductId(null)}
                                className="px-2.5 py-1.5 bg-slate-800 text-slate-400 text-xs rounded-lg hover:text-white cursor-pointer"
                              >
                                انصراف
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {(() => {
                                const cleanWorkingUrl = getCleanWorkingSourceUrl(product);
                                return (
                                  <>
                                    <a
                                      href={cleanWorkingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs font-mono text-indigo-300 hover:text-indigo-200 underline truncate max-w-sm md:max-w-lg block"
                                      dir="ltr"
                                      title={cleanWorkingUrl}
                                    >
                                      {cleanWorkingUrl}
                                    </a>
                                    <button
                                      onClick={() => {
                                        setEditingUrlProductId(product.id);
                                        setTempUrlValue(cleanWorkingUrl);
                                      }}
                                      className="text-[10px] text-slate-400 hover:text-amber-300 transition shrink-0 underline cursor-pointer"
                                      title="تغییر یا الصاق لینک مستقیم این کالا"
                                    >
                                      ویرایش لینک
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {(() => {
                            const cleanWorkingUrl = getCleanWorkingSourceUrl(product);
                            return (
                              <>
                                <button
                                  onClick={() => handleCopySourceUrl(product.id, cleanWorkingUrl)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700 cursor-pointer shadow-sm"
                                  title="کپی لینک مستقیم کارخانجات در کلیپ‌بورد"
                                >
                                  {copiedUrlProductId === product.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="text-emerald-400 font-bold">کپی شد!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                      <span>کپی لینک</span>
                                    </>
                                  )}
                                </button>

                                <a
                                  href={cleanWorkingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition shadow-md shadow-amber-500/20 cursor-pointer"
                                  title={`مشاهده و باز کردن مستقیم کارخانجات و تامین‌کنندگان در ${product.supplier?.platform || 'سایت مبدأ'}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-950" />
                                  <span>باز کردن کارخانجات در {product.supplier?.platform || 'مبدأ'}</span>
                                </a>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Competitor Analysis Modal */}
      <CompetitorAnalysisModal
        product={analyzingProduct}
        isOpen={!!analyzingProduct}
        onClose={() => setAnalyzingProduct(null)}
        usdRate={usdRate}
      />

      {/* Multi-Image Gallery Manager Modal */}
      {galleryProduct && (
        <ProductGalleryModal
          isOpen={!!galleryProduct}
          onClose={() => setGalleryProduct(null)}
          product={galleryProduct}
          onUpdateProductImages={(pId, newImages, newMainImage) => {
            if (onUpdateProductImages) {
              onUpdateProductImages(pId, newImages, newMainImage);
            }
            setGalleryProduct((prev) =>
              prev && prev.id === pId
                ? { ...prev, images: newImages, mainImage: newMainImage }
                : prev
            );
            setActiveImageMap((prev) => ({ ...prev, [pId]: newMainImage }));
          }}
        />
      )}

      {/* Safe Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تأیید بازنشانی کاتالوگ</h3>
                <p className="text-xs text-slate-400">بازگردانی به نسخه پیش‌فرض سرور</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              با این کار کاتالوگ به نسخه اولیه سرور برمی‌گردد. قبل از اجرا، یک <strong>نسخه پشتیبان کامل</strong> از کاتالوگ فعلی شما ذخیره می‌شود تا در صورت نیاز با دکمه «بازیابی پشتیبان قبلی» آن را برگردانید.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsResetConfirmOpen(false);
                  if (onResetCatalogToMaster) onResetCatalogToMaster();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-rose-600/20"
              >
                تأیید و بازنشانی
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
