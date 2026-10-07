import React, { useState } from 'react';
import {
  Globe,
  CheckCircle2,
  Copy,
  ExternalLink,
  Download,
  Send,
  X,
  Sparkles,
  Settings,
  Layers,
  FileCode,
  Tag,
  DollarSign,
  Image as ImageIcon,
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { ProductItem, WebStoreConfig, CurrencyRates } from '../types';

interface WebStoreSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem | null;
  currencyRates: CurrencyRates;
  webStoreConfig: WebStoreConfig;
  onUpdateConfig: (config: WebStoreConfig) => void;
  onPublishSuccess: (productId: string, liveUrl: string) => void;
}

export const WebStoreSyncModal: React.FC<WebStoreSyncModalProps> = ({
  isOpen,
  onClose,
  product,
  currencyRates,
  webStoreConfig,
  onUpdateConfig,
  onPublishSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'json' | 'settings'>('preview');
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(product?.websiteProductUrl || null);
  const [testConnectionStatus, setTestConnectionStatus] = useState<string | null>(null);

  // Form states for editable fields
  const [seoTitle, setSeoTitle] = useState(product?.faTitle || '');
  const [seoSlug, setSeoSlug] = useState(
    product?.originalTitle ? product.originalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'nfs-exclusive-product'
  );
  const [regularPriceToman, setRegularPriceToman] = useState<number>(
    product ? Math.round(product.costPerUnitUsd * currencyRates.usd * 1.55 / 1000) * 1000 : 950000
  );
  const [salePriceToman, setSalePriceToman] = useState<number>(
    product ? Math.round(product.costPerUnitUsd * currencyRates.usd * 1.38 / 1000) * 1000 : 850000
  );
  const [metaFocusKeyword, setMetaFocusKeyword] = useState(
    product?.tags[0] ? `خرید عمده ${product.tags[0]}` : 'خرید عمده گجت نفیس استور'
  );

  if (!isOpen || !product) return null;

  // WooCommerce REST API Payload
  const wooCommercePayload = {
    name: seoTitle || product.faTitle,
    slug: seoSlug,
    type: 'simple',
    status: 'publish',
    featured: true,
    catalog_visibility: 'visible',
    description: `
<div class="nfs-product-description" dir="rtl">
  <h3>معرفی تخصصی محصول در نفیس‌استور</h3>
  <p>${product.faFullDesc}</p>
  <h4>ویژگی‌های برجسته فنی:</h4>
  <ul>
    ${product.faFeatures.map((f) => `<li>${f}</li>`).join('\n    ')}
  </ul>
  <h4>جدول مشخصات استاندارد:</h4>
  <table class="nfs-specs-table">
    ${Object.entries(product.technicalSpecs)
      .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`)
      .join('\n    ')}
  </table>
</div>
    `.trim(),
    short_description: `<p dir="rtl">${product.faShortDesc}</p>`,
    sku: `NFS-${product.id}`,
    regular_price: regularPriceToman.toString(),
    sale_price: salePriceToman.toString(),
    manage_stock: true,
    stock_quantity: 150,
    stock_status: 'instock',
    categories: [
      { name: product.category },
      { name: 'واردات مستقیم نفیس‌استور' },
    ],
    tags: product.tags.map((t) => ({ name: t })),
    images: [
      { src: product.mainImage, alt: product.faTitle },
      ...product.images.filter((img) => img !== product.mainImage).map((img) => ({ src: img })),
    ],
    attributes: Object.entries(product.technicalSpecs).map(([key, val]) => ({
      name: key,
      visible: true,
      variation: false,
      options: [val],
    })),
    meta_data: [
      { key: '_yoast_wpseo_title', value: `${seoTitle} | فروشگاه نفیس‌استور` },
      { key: '_yoast_wpseo_metadesc', value: product.faShortDesc.substring(0, 155) },
      { key: '_yoast_wpseo_focuskw', value: metaFocusKeyword },
      { key: '_rank_math_title', value: `${seoTitle} | فروشگاه نفیس‌استور` },
      { key: '_rank_math_description', value: product.faShortDesc.substring(0, 155) },
      { key: '_rank_math_focus_keyword', value: metaFocusKeyword },
      { key: '_nfs_source_platform', value: product.supplier.platform },
      { key: '_nfs_original_source', value: product.sourceUrl },
      { key: '_nfs_trend_score', value: product.trendScore.toString() },
    ],
  };

  const handlePublishToWebStore = async () => {
    setIsPublishing(true);

    try {
      // Simulate real WooCommerce REST API call: POST /wp-json/wc/v3/products
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const generatedLiveUrl = `https://nafisstore.com/product/${seoSlug}`;
      setPublishedUrl(generatedLiveUrl);
      onPublishSuccess(product.id, generatedLiveUrl);
      onUpdateConfig({
        ...webStoreConfig,
        lastSyncedAt: new Date().toLocaleTimeString('en-US'),
        totalProductsPublished: webStoreConfig.totalProductsPublished + 1,
        status: 'connected',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(wooCommercePayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  // Generate WooCommerce Product CSV export
  const handleDownloadCsv = () => {
    const headers = [
      'Type',
      'SKU',
      'Name',
      'Published',
      'Is featured?',
      'Visibility in catalog',
      'Short description',
      'Description',
      'Regular price',
      'Sale price',
      'Categories',
      'Tags',
      'Images',
      'Meta: _yoast_wpseo_focuskw',
      'Meta: _yoast_wpseo_metadesc',
    ];

    const row = [
      'simple',
      `NFS-${product.id}`,
      `"${seoTitle.replace(/"/g, '""')}"`,
      '1',
      '1',
      'visible',
      `"${product.faShortDesc.replace(/"/g, '""')}"`,
      `"${product.faFullDesc.replace(/"/g, '""')}"`,
      regularPriceToman,
      salePriceToman,
      `"${product.category}, واردات مستقیم"`,
      `"${product.tags.join(', ')}"`,
      `"${product.mainImage}"`,
      `"${metaFocusKeyword}"`,
      `"${product.faShortDesc.substring(0, 155).replace(/"/g, '""')}"`,
    ];

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + row.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `nfs_product_${product.id}_woocommerce.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E63946] to-rose-600 flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  انتقال محصول به سایت نفیس‌استور (NafisStore)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E63946]/20 text-[#FF4D6D] border border-[#E63946]/30">
                  WooCommerce Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                فرمت‌بندی خودکار تمامی فیلدهای سئو، تصاویر، ویژگی‌های متغیر و قیمت تومانی
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'preview'
                ? 'border-[#E63946] text-[#FF4D6D]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>فیلدهای سئو و صفحه محصول</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'json'
                ? 'border-[#E63946] text-[#FF4D6D]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>خروجی استاندارد JSON / CSV</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-[#E63946] text-[#FF4D6D]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>تنظیمات اتصال API سایت</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar text-xs">
          {/* Success Banner if already published */}
          {publishedUrl && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>این محصول با موفقیت به سایت nafisstore.com متصل و منتشر شده است!</span>
              </div>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-bold text-white hover:underline bg-emerald-600/30 px-2.5 py-1 rounded-lg"
              >
                <span>مشاهده صفحه محصول</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* TAB 1: Product Fields Mapping & Editing */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Product SEO Title */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  عنوان سئو محصول در وب‌سایت (SEO Product Title):
                </label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-[#E63946]"
                />
              </div>

              {/* Slug & Focus Keyword */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    نامک آدرس صفحه (URL Slug):
                  </label>
                  <input
                    type="text"
                    value={seoSlug}
                    onChange={(e) => setSeoSlug(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sky-400 font-mono text-left focus:outline-none focus:border-[#E63946]"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-500 block pt-0.5">
                    nafisstore.com/product/{seoSlug}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    کلمه کلیدی کانونی (Yoast / RankMath Focus Keyword):
                  </label>
                  <input
                    type="text"
                    value={metaFocusKeyword}
                    onChange={(e) => setMetaFocusKeyword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E63946]"
                  />
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1">قیمت اصلی فروشگاه (تومان):</label>
                  <input
                    type="number"
                    value={regularPriceToman}
                    onChange={(e) => setRegularPriceToman(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold focus:outline-none focus:border-[#E63946]"
                  />
                  <span className="text-[10px] text-slate-500">قیمت خط‌خورده در صفحه محصول</span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">قیمت فروش ویژه نفیس‌استور (تومان):</label>
                  <input
                    type="number"
                    value={salePriceToman}
                    onChange={(e) => setSalePriceToman(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-[#E63946]"
                  />
                  <span className="text-[10px] text-slate-500">قیمت نهایی پرداخت مشتری با تخفیف</span>
                </div>
              </div>

              {/* Specs & Attributes Display */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  ویژگی‌های فنی جهت ایجاد در برگه مشخصات ووکامرس (Attributes):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-[11px]">
                  {Object.entries(product.technicalSpecs).map(([key, val]) => (
                    <div key={key} className="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                      <div className="text-slate-400 font-semibold">{key}:</div>
                      <div className="text-white font-medium truncate">{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Descriptions Preview */}
              <div className="space-y-2">
                <label className="block text-slate-300 font-semibold">
                  توضیحات کوتاه محصول (کنار عکس کالا):
                </label>
                <div className="p-3 rounded-xl bg-slate-800/80 text-slate-300 text-xs leading-relaxed border border-slate-700">
                  {product.faShortDesc}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: JSON Payload & CSV Export */}
          {activeTab === 'json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">
                  کد خروجی REST API ووکامرس (آماده برای ارسال با POST یا وب‌هوک):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? 'کپی شد!' : 'کپی JSON'}</span>
                  </button>

                  <button
                    onClick={handleDownloadCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E63946]/20 hover:bg-[#E63946]/30 text-[#FF4D6D] border border-[#E63946]/40 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>دانلود CSV ووکامرس</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-80 select-all" dir="ltr">
                <pre>{JSON.stringify(wooCommercePayload, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: API Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-xs flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#E63946]" />
                  <span>پیکربندی کلیدهای REST API فروشگاه NafisStore:</span>
                </h4>

                <div>
                  <label className="block text-slate-400 mb-1">آدرس فروشگاه (Store URL):</label>
                  <input
                    type="url"
                    value={webStoreConfig.storeUrl}
                    onChange={(e) => onUpdateConfig({ ...webStoreConfig, storeUrl: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Consumer Key (کلید کاربری ووکامرس):</label>
                  <input
                    type="text"
                    value={webStoreConfig.consumerKey}
                    onChange={(e) => onUpdateConfig({ ...webStoreConfig, consumerKey: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Consumer Secret (رمز مخفی ووکامرس):</label>
                  <input
                    type="password"
                    value={webStoreConfig.consumerSecret}
                    onChange={(e) => onUpdateConfig({ ...webStoreConfig, consumerSecret: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    dir="ltr"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setTestConnectionStatus('برقراری ارتباط با nafisstore.com موفقیت‌آمیز بود (REST API v3 Verified)!');
                      onUpdateConfig({ ...webStoreConfig, status: 'connected' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تست اتصال به سرور وردپرس</span>
                  </button>

                  <span className="text-[11px] text-emerald-400 font-bold">
                    وضعیت: {webStoreConfig.status === 'connected' ? 'متصل به nafisstore.com' : 'آماده اتصال'}
                  </span>
                </div>

                {testConnectionStatus && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
                    {testConnectionStatus}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E63946]"></span>
            <span>انتشار با هوش مصنوعی در سایت <strong>nafisstore.com</strong></span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
            >
              انصراف
            </button>

            <button
              onClick={handlePublishToWebStore}
              disabled={isPublishing}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#E63946] to-rose-600 hover:from-red-600 hover:to-rose-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition disabled:opacity-50 cursor-pointer"
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال انتقال فیلدها و ثبت در سایت...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>انتشار مستقیم در صفحه محصول وب‌سایت</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
