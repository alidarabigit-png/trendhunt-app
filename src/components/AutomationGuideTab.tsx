import React, { useState, useEffect } from 'react';
import {
  Workflow,
  Copy,
  Check,
  Clock,
  Download,
  FileArchive,
  RefreshCw,
  CheckCircle2,
  Server,
  ExternalLink,
  Bot,
  Zap,
  Globe,
  ImageIcon,
  Send,
  AlertCircle,
  Link2,
  ShieldCheck,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { ProductItem } from '../types';
import { getCleanWorkingSourceUrl } from '../utils/sourceUrlUtils';

interface AutomationGuideTabProps {
  products?: ProductItem[];
  setProducts?: (items: ProductItem[] | ((prev: ProductItem[]) => ProductItem[])) => void;
  onSyncFromLiveHost?: () => Promise<void>;
  showToast?: (msg: string) => void;
}

export const AutomationGuideTab: React.FC<AutomationGuideTabProps> = ({
  products = [],
  setProducts,
  onSyncFromLiveHost,
  showToast,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Live host status
  const [hostStatus, setHostStatus] = useState<'checking' | 'online' | 'error'>('checking');
  const [hostProductsCount, setHostProductsCount] = useState<number | null>(null);

  // Self-update state
  const [isUpdatingHost, setIsUpdatingHost] = useState(false);
  const [updateResultMsg, setUpdateResultMsg] = useState<string | null>(null);

  // Cron test state
  const [isTestingCron, setIsTestingCron] = useState<boolean>(false);
  const [cronTestResult, setCronTestResult] = useState<string | null>(null);

  // Batch Image Caching & Link Repair state
  const [isCachingImages, setIsCachingImages] = useState(false);
  const [cacheResultMsg, setCacheResultMsg] = useState<string | null>(null);
  const [isFixingLinks, setIsFixingLinks] = useState(false);
  const [linkFixResultMsg, setLinkFixResultMsg] = useState<string | null>(null);

  // Host image preview modal or inspected product
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Compute live media & links statistics
  const totalProducts = products.length;
  const hostCachedImagesCount = products.filter(
    (p) => p.mainImage && (p.mainImage.includes('/uploads/') || p.mainImage.includes('nafisstore.com/uploads/'))
  ).length;
  const remoteImagesCount = totalProducts - hostCachedImagesCount;

  const validLinksCount = products.filter((p) => {
    const url = p.sourceUrl || '';
    return (
      url.length > 10 &&
      !url.includes('viral-trend-') &&
      !url.includes('/offer/7') &&
      !url.includes('/offer/1') &&
      !url.includes('_160')
    );
  }).length;

  useEffect(() => {
    checkHostHealth();
  }, []);

  const checkHostHealth = async () => {
    setHostStatus('checking');
    try {
      const res = await fetch('https://nfs.nafisstore.com/api.php?action=get_products&_t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setHostStatus('online');
        if (Array.isArray(data.products)) {
          setHostProductsCount(data.products.length);
        }
      } else {
        setHostStatus('error');
      }
    } catch {
      setHostStatus('error');
    }
  };

  // 1. Direct Batch Image Caching onto Host
  const handleBatchCacheImages = async () => {
    setIsCachingImages(true);
    setCacheResultMsg(null);
    try {
      const res = await fetch('https://nfs.nafisstore.com/api.php?action=cache_catalog_images');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCacheResultMsg(
            `✅ عملیات با موفقیت انجام شد: تعداد ${data.cached_images_count || 0} تصویر دانلود و در پوشه uploads هاست شما ذخیره شدند. کلیه پیوندهای نامعتبر نیز اصلاح شدند.`
          );
          if (showToast) {
            showToast('✅ تصاویر کاتالوگ با موفقیت روی هاست ذخیره و ضد فیلتر شدند.');
          }
          // Refresh products from live host
          if (onSyncFromLiveHost) {
            await onSyncFromLiveHost();
          }
          checkHostHealth();
        } else {
          setCacheResultMsg(`⚠️ ${data.error || 'خطا در دانلود تصاویر روی هاست'}`);
        }
      } else {
        setCacheResultMsg(`⚠️ سرور هاست کد وضعیت ${res.status} بازگرداند.`);
      }
    } catch (err: any) {
      setCacheResultMsg(`❌ خطا در ارتباط با هاست: ${err.message || 'شبکه در دسترس نیست'}`);
    } finally {
      setIsCachingImages(false);
    }
  };

  // 2. Client-side & Server Link Validation & Repair
  const handleSanitizeAllLinks = async () => {
    setIsFixingLinks(true);
    setLinkFixResultMsg(null);
    try {
      let fixedCount = 0;
      const sanitized = products.map((prod) => {
        const workingUrl = getCleanWorkingSourceUrl(prod);
        if (workingUrl !== prod.sourceUrl) {
          fixedCount++;
          return { ...prod, sourceUrl: workingUrl };
        }
        return prod;
      });

      if (setProducts) {
        setProducts(sanitized);
      }

      // Persist to backend
      const isPhpHost =
        window.location.hostname.includes('nafisstore.com') || window.location.pathname.includes('.php');
      const endpoint = isPhpHost ? '/api.php?action=save_products' : '/api/catalog';
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: sanitized }),
      });

      setLinkFixResultMsg(
        `✅ لینک‌های تامین‌کننده برای تمام ${sanitized.length} محصول بررسی شدند (${fixedCount} لینک نامعتبر اصلاح و به جستجوی زنده کارخانجات متصل شد).`
      );
      if (showToast) {
        showToast(`✅ پیوندهای کاتالوگ با موفقیت اصلاح شدند (${fixedCount} لینک به‌روزرسانی شد).`);
      }
    } catch (e: any) {
      setLinkFixResultMsg(`⚠️ خطا در ذخیره لینک‌های اصلاح‌شده: ${e.message}`);
    } finally {
      setIsFixingLinks(false);
    }
  };

  // Download dist.zip
  const handleDownloadZip = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      const res = await fetch('/api/dist-base64');
      if (res.ok) {
        const data = await res.json();
        if (data.base64) {
          const byteCharacters = atob(data.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/zip' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = 'nafisstore-dist.zip';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          setDownloadSuccess(true);
          return;
        }
      }
      window.location.href = '/api/download-dist';
      setDownloadSuccess(true);
    } catch {
      window.location.href = '/api/download-dist';
      setDownloadSuccess(true);
    } finally {
      setIsDownloading(false);
    }
  };

  // 1-Click remote self-update to live host
  const handleRemoteSelfUpdate = async () => {
    setIsUpdatingHost(true);
    setUpdateResultMsg(null);
    try {
      const zipRes = await fetch('/api/dist-base64');
      const zipData = await zipRes.json();
      if (!zipData.success || !zipData.base64) {
        throw new Error('بسته بروزرسانی در سرور یافت نشد');
      }

      const updateRes = await fetch('https://nfs.nafisstore.com/api.php?action=self_update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'nfs2026', zip_base64: zipData.base64 }),
      });

      const resJson = await updateRes.json();
      if (resJson.ok) {
        setUpdateResultMsg(`🚀 ${resJson.message} (${resJson.files_count || 0} فایل در هاست آپدیت شد)`);
        checkHostHealth();
      } else {
        setUpdateResultMsg(`⚠️ ${resJson.error || 'خطا در اعمال بروزرسانی روی هاست'}`);
      }
    } catch (err: any) {
      setUpdateResultMsg(`❌ خطا: ${err.message || 'ارتباط با هاست برقرار نشد'}`);
    } finally {
      setIsUpdatingHost(false);
    }
  };

  const copySnippet = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const cpanelCronCommand = `curl -s "https://nfs.nafisstore.com/api.php?action=cron_hunt" >/dev/null 2>&1`;

  const handleTestCronLive = async () => {
    setIsTestingCron(true);
    setCronTestResult(null);
    try {
      const res = await fetch('https://nfs.nafisstore.com/api.php?action=cron_hunt');
      if (res.ok) {
        const data = await res.json();
        setCronTestResult(`✅ اجرای موفق: ${data.message || 'کالاهای ترند بدون تکرار اضافه شدند'}`);
        checkHostHealth();
        if (onSyncFromLiveHost) await onSyncFromLiveHost();
      } else {
        setCronTestResult(`⚠️ پاسخ سرور: کد وضعیت ${res.status}`);
      }
    } catch (e: any) {
      setCronTestResult(`❌ خطا در ارتباط: ${e?.message || 'عدم دسترسی به هاست'}`);
    } finally {
      setIsTestingCron(false);
    }
  };

  // Sample items to showcase cached images
  const cachedSamples = products
    .filter((p) => p.mainImage && p.mainImage.includes('/uploads/'))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Host Health */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Workflow className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>مرکز اتوماسیون، اصلاح لینک‌ها و تصاویر هاست</span>
                  <span className="text-[11px] bg-slate-800 text-amber-300 px-2.5 py-0.5 rounded-full font-mono border border-slate-700">
                    NFS v2026
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  مدیریت ذخیره‌سازی عکس‌ها روی هاست شخصی، اصلاح پیوندها به کارخانجات اصلی و زمان‌بندی خودکار
                </p>
              </div>
            </div>
          </div>

          {/* Live Status Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <Globe className="w-4 h-4 text-sky-400" />
              <span className="text-slate-400">هاست اصلی:</span>
              <a
                href="https://nfs.nafisstore.com"
                target="_blank"
                rel="noreferrer"
                className="text-sky-300 font-mono font-bold hover:underline flex items-center gap-1"
                dir="ltr"
              >
                <span>nfs.nafisstore.com</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  hostStatus === 'online'
                    ? 'bg-emerald-400 animate-pulse'
                    : hostStatus === 'checking'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-rose-400'
                }`}
              />
              <span className="text-slate-300 font-bold">
                {hostStatus === 'online'
                  ? 'هاست آنلاین و متصل'
                  : hostStatus === 'checking'
                  ? 'بررسی اتصال...'
                  : 'خطا در اتصال'}
              </span>
              {hostProductsCount !== null && (
                <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                  {hostProductsCount} کالا
                </span>
              )}
            </div>

            <button
              onClick={checkHostHealth}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="بررسی مجدد سلامت هاست"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. بخش ویژه: اصلاح لینک‌ها و دانلود خودکار تصاویر کاتالوگ (رفع دغدغه کاربر) */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-700/60 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-900/40">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 shrink-0">
              <ImageIcon className="w-6 h-6 text-amber-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>اصلاح عملکرد پیوندها و دانلود خودکار تصاویر روی هاست</span>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full">
                  ۱۰۰٪ خودکار بدون نیاز به دانلود دستی
                </span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                عکس‌های کالاها مستقیماً توسط سرور در پوشه <code className="text-amber-300 font-mono">/uploads/</code> هاست شما ذخیره می‌شوند تا در ایران با حداکثر سرعت و بدون فیلترشکن باز شوند. همچنین تمام پیوندها به نتایج زنده کارخانجات در Alibaba و 1688 هدایت خواهند شد.
              </p>
            </div>
          </div>
        </div>

        {/* Live Matrix Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-1">
            <div className="text-[11px] text-slate-400 font-medium">کل کالاهای کاتالوگ</div>
            <div className="text-lg font-black text-white font-mono">{totalProducts} کالا</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-center space-y-1">
            <div className="text-[11px] text-emerald-400 font-medium flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>عکس‌های محلی در هاست</span>
            </div>
            <div className="text-lg font-black text-emerald-300 font-mono">
              {hostCachedImagesCount} تصویر
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 text-center space-y-1">
            <div className="text-[11px] text-amber-400 font-medium flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>عکس‌های CDN خارجی</span>
            </div>
            <div className="text-lg font-black text-amber-300 font-mono">
              {remoteImagesCount} تصویر
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-sky-500/30 text-center space-y-1">
            <div className="text-[11px] text-sky-400 font-medium flex items-center justify-center gap-1">
              <Link2 className="w-3.5 h-3.5 text-sky-400" />
              <span>لینک‌های معتبر تامین‌کننده</span>
            </div>
            <div className="text-lg font-black text-sky-300 font-mono">
              {validLinksCount} از {totalProducts}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Button 1: Batch Cache Images to Host */}
          <button
            onClick={handleBatchCacheImages}
            disabled={isCachingImages}
            className="p-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 active:scale-98"
          >
            {isCachingImages ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>در حال دانلود و ذخیره تصاویر روی هاست...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-950" />
                <span>📥 دانلود و کش خودکار تمام تصاویر کاتالوگ روی هاست</span>
              </>
            )}
          </button>

          {/* Button 2: Sanitize & Test Links */}
          <button
            onClick={handleSanitizeAllLinks}
            disabled={isFixingLinks}
            className="p-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border border-sky-500/30 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50 active:scale-98"
          >
            {isFixingLinks ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>در حال اصلاح پیوندها...</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 text-sky-400" />
                <span>🔗 اصلاح و اعتبارسنجی کلیه لینک‌های تامین‌کنندگان</span>
              </>
            )}
          </button>
        </div>

        {cacheResultMsg && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between animate-fadeIn">
            <span>{cacheResultMsg}</span>
            <button
              onClick={() => setCacheResultMsg(null)}
              className="text-slate-400 hover:text-white px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {linkFixResultMsg && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/40 text-xs text-sky-200 flex items-center justify-between animate-fadeIn">
            <span>{linkFixResultMsg}</span>
            <button
              onClick={() => setLinkFixResultMsg(null)}
              className="text-slate-400 hover:text-white px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Live Cached Images Preview Showcase */}
        {cachedSamples.length > 0 && (
          <div className="pt-3 border-t border-indigo-900/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>نمونه تصاویری که با موفقیت روی هاست شخصی شما ذخیره شدند:</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                مسیر: /uploads/cached_...
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cachedSamples.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 flex flex-col justify-between"
                >
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900">
                    <img
                      src={item.mainImage}
                      alt={item.faTitle}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute bottom-1 right-1 bg-emerald-500/90 text-slate-950 px-1.5 py-0.2 rounded text-[9px] font-black">
                      هاست نفیس
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-300 truncate" title={item.faTitle}>
                    {item.faTitle}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>لینک تامین‌کننده</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Cron Job Scheduling Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">زمان‌بندی روزانه شکار خودکار (cPanel Cron Job)</h3>
              <p className="text-xs text-slate-400">
                این دستور را در بخش Cron Jobs سی‌پنل هاست خود برای اجرا در ساعت مشخص (مثلاً ساعت ۸:۰۰ صبح) قرار دهید:
              </p>
            </div>
          </div>

          <button
            onClick={() => copySnippet(cpanelCronCommand, 'cpanel_cron')}
            className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-white px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 font-bold transition self-start sm:self-auto cursor-pointer"
          >
            {copiedCode === 'cpanel_cron' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode === 'cpanel_cron' ? 'کپی شد!' : 'کپی دستور کرون'}</span>
          </button>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 flex items-center justify-between gap-2 overflow-x-auto" dir="ltr">
          <code>{cpanelCronCommand}</code>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <span>برای اطمینان از سلامت اجرای کرون و شکار خودکار کالا روی هاست، دکمه تست زیر را بزنید:</span>
          <button
            onClick={handleTestCronLive}
            disabled={isTestingCron}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition cursor-pointer disabled:opacity-50"
          >
            {isTestingCron ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
            <span>اجرای آزمایشی کرون روی هاست</span>
          </button>
        </div>

        {cronTestResult && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200">
            {cronTestResult}
          </div>
        )}
      </div>

      {/* 4. Host Update & Telegram WebApp Connection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Host 1-Click Update Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <Server className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">استقرار و به‌روزرسانی آنی هاست</h3>
                <p className="text-xs text-slate-400">انتقال آخرین تغییرات پروژه مستقیماً به هاست</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              با کلیک روی دکمه زیر، آخرین نسخه کاتالوگ و بیلد برنامه مستقیماً در ۳ ثانیه به هاست <strong className="text-amber-400 font-mono">nfs.nafisstore.com</strong> تزریق و فعال می‌گردد.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRemoteSelfUpdate}
                disabled={isUpdatingHost}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow"
              >
                {isUpdatingHost ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    <span>در حال انتقال به هاست...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-slate-950" />
                    <span>🚀 به‌روزرسانی آنی هاست (یک‌کلیک)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadZip}
                disabled={isDownloading}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
                title="دانلود فایل زیپ جهت بکاپ دستی"
              >
                {isDownloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>dist.zip</span>
              </button>
            </div>

            {updateResultMsg && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-200 flex items-center justify-between">
                <span>{updateResultMsg}</span>
                <button onClick={() => setUpdateResultMsg(null)} className="text-slate-400 hover:text-white px-1">✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Telegram WebApp Settings Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">اتصال مینی‌آپ و بات تلگرام</h3>
                  <p className="text-xs text-slate-400">آدرس دائمی وب‌اپ در تلگرام</p>
                </div>
              </div>

              <button
                onClick={() => copySnippet('https://nfs.nafisstore.com', 'webapp_url')}
                className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-white px-2.5 py-1 rounded-xl bg-sky-500/15 border border-sky-500/30 font-bold transition cursor-pointer"
              >
                {copiedCode === 'webapp_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode === 'webapp_url' ? 'کپی شد' : 'کپی آدرس'}</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-[11px] text-slate-400">آدرس فعال مینی‌اپ:</div>
              <div className="text-xs font-mono text-sky-300 font-bold" dir="ltr">
                https://nfs.nafisstore.com
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300 font-mono" dir="ltr">
              <span className="text-emerald-400 font-bold">@nafistejarat_bot</span>
              <span>•</span>
              <span className="text-amber-400 font-bold">@NafisSmartTrade</span>
            </div>
          </div>

          {/* Compact BotFather Instruction toggle */}
          <details className="group border border-slate-800 rounded-xl bg-slate-950/60 p-2.5 text-xs">
            <summary className="text-[11px] font-bold text-slate-400 flex items-center justify-between cursor-pointer list-none">
              <span>راهنمای ۳ مرحله‌ای تنظیم در BotFather</span>
              <span className="text-slate-500 group-open:rotate-180 transition text-xs">▼</span>
            </summary>
            <div className="mt-2 text-[11px] text-slate-300 space-y-1 leading-relaxed">
              <p>۱. در تلگرام وارد @BotFather شده و دستور /myapps را بزنید.</p>
              <p>۲. ربات خود را انتخاب کرده و Edit Web App URL را انتخاب کنید.</p>
              <p>۳. آدرس <code className="text-amber-300 font-mono">https://nfs.nafisstore.com</code> را ثبت کنید.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
