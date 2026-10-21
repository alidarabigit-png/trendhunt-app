import React, { useState, useEffect } from 'react';
import {
  Send,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  MessageSquare,
  Bot,
  Settings,
  Sparkles,
  Layers,
  Share2,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  X,
  Globe,
  BookOpen,
  Download,
  CheckCircle2,
  ImagePlus,
  Upload,
} from 'lucide-react';
import { ProductItem, TelegramConfig } from '../types';

interface TelegramPostGeneratorTabProps {
  products: ProductItem[];
  selectedProduct: ProductItem | null;
  onSelectProduct: (p: ProductItem) => void;
  telegramConfig: TelegramConfig;
  setTelegramConfig: (value: TelegramConfig | ((prev: TelegramConfig) => TelegramConfig)) => void;
  usdRate: number;
  onImportFromSheets?: () => void;
  isSyncingSheets?: boolean;
  onUpdateProductImages?: (productId: string, newImages: string[], newMainImage: string) => void;
}

export const TelegramPostGeneratorTab: React.FC<TelegramPostGeneratorTabProps> = ({
  products,
  selectedProduct,
  onSelectProduct,
  telegramConfig,
  setTelegramConfig,
  usdRate,
  onImportFromSheets,
  isSyncingSheets,
  onUpdateProductImages,
}) => {
  // Always resolve the freshest product from the reactive products catalog
  const currentProduct =
    (selectedProduct ? products.find((p) => p.id === selectedProduct.id) : null) ||
    products[0] ||
    null;

  const [copied, setCopied] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [broadcastSuccess, setBroadcastSuccess] = useState<boolean | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [isVerifyingBot, setIsVerifyingBot] = useState(false);
  const [botVerifyResult, setBotVerifyResult] = useState<string | null>(null);
  const [savedSettingsNotice, setSavedSettingsNotice] = useState(false);

  const [primaryButtonTarget, setPrimaryButtonTarget] = useState<'bot' | 'miniapp' | 'website'>('miniapp');
  const [selectedTelegramPhoto, setSelectedTelegramPhoto] = useState<string>('');
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);


  // Sync photo with current product whenever it or its images change
  useEffect(() => {
    if (currentProduct) {
      if (!selectedTelegramPhoto || !(currentProduct.images || []).includes(selectedTelegramPhoto)) {
        setSelectedTelegramPhoto(currentProduct.mainImage);
      }
    }
  }, [currentProduct?.id, currentProduct?.mainImage, currentProduct?.images]);


  // Generate formatted Telegram post content (guaranteed to be under Telegram's 1024-char limit for sendPhoto)
  const generatePostText = (product: ProductItem | null, isCompactForPhoto = true) => {
    if (!product) return '';

    const tieredText = product.tieredPricing
      .slice(0, 3)
      .map((t) => {
        const qty = t.maxQuantity ? `${t.minQuantity} تا ${t.maxQuantity}` : `+${t.minQuantity}`;
        return `▫️ تیراژ ${qty} عدد: ${t.calculatedPriceToman?.toLocaleString('en-US')} تومان`;
      })
      .join('\n');

    // Limit features to 3 punchy points to respect Telegram's strict 1024 caption limit
    const featuresCount = isCompactForPhoto ? 3 : 4;
    const featuresText = product.faFeatures.slice(0, featuresCount).map((f) => `🔹 ${f}`).join('\n');

    // Truncate short description if needed to fit comfortably
    let cleanDesc = product.faShortDesc.trim();
    if (isCompactForPhoto && cleanDesc.length > 150) {
      cleanDesc = cleanDesc.slice(0, 145) + '...';
    }

    const tagsText = product.tags.slice(0, 3).map((t) => `#${t.replace(/\s+/g, '_')}`).join(' ');

    const text = `🔥 کالای ترند جدید عمده‌فروشی 2026 | نفیس تجارت هوشمند (NFS)
📦 ${product.faTitle}

💡 معرفی کالا:
${cleanDesc}

⚙️ مشخصات و مزیت‌های کلیدی:
${featuresText}

💰 قیمت‌های پلکانی همکار (هر عدد):
${tieredText}

📋 حداقل تیراژ (MOQ): ${product.moq} عدد | 🛡 سابقه کارخانه: ${product.supplier.yearsInBusiness} سال (${product.supplier.rating}★)

🏢 شرکت نفیس تجارت هوشمند (NFS)
📢 کانال: @NafisSmartTrade | 🤖 ربات استعلام: @nafistejarat_bot

👇 برای استعلام آنلاین و ثبت پیش‌فاکتور روی دکمه زیر کلیک کنید:
${tagsText}`;

    // Telegram caption absolute limit is 1024 characters; cap at 1000 to be 100% safe
    if (text.length > 1000) {
      return text.slice(0, 990) + '...';
    }
    return text;
  };

  const postText = generatePostText(currentProduct, true);

  const handleCopy = () => {
    navigator.clipboard.writeText(postText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save settings permanently to both localStorage and host server (data/settings.json)
  const handleSaveSettings = async () => {
    try {
      localStorage.setItem('nfs_telegram_config', JSON.stringify(telegramConfig));
      setTelegramConfig(telegramConfig);

      const isPhpHost =
        window.location.hostname.includes('nafisstore.com') ||
        window.location.pathname.includes('.php');
      const endpoints = isPhpHost
        ? ['/api.php?action=save_settings', '/api/settings']
        : ['/api/settings', '/api.php?action=save_settings'];

      for (const ep of endpoints) {
        try {
          await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: telegramConfig }),
          });
        } catch (e) {}
      }

      setSavedSettingsNotice(true);
      setTimeout(() => setSavedSettingsNotice(false), 3500);
    } catch (e) {
      console.error('Failed to save telegram settings:', e);
    }
  };

  // Verify bot token via server proxy (runs in Europe, zero filtering)
  const handleVerifyBot = async () => {
    const token = telegramConfig.botToken?.trim();
    if (!token) {
      setBotVerifyResult('⚠️ لطفاً ابتدا توکن ربات را وارد کنید.');
      return;
    }
    setIsVerifyingBot(true);
    setBotVerifyResult('در حال بررسی اتصال به تلگرام...');

    try {
      const res = await fetch('/api/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: token }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        setBotVerifyResult(`✅ ربات متصل شد: @${data.result.username} (${data.result.first_name})`);
        if (!telegramConfig.adminUsername) {
          setTelegramConfig((prev) => ({ ...prev, adminUsername: data.result.username }));
        }
      } else {
        setBotVerifyResult(`❌ توکن نامعتبر است: ${data.description || 'توکن را بررسی کنید'}`);
      }
    } catch (err: any) {
      setBotVerifyResult('❌ خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsVerifyingBot(false);
    }
  };

  // Broadcast to channel via server proxy (bypasses browser filtering and CORS)
  const handleTestBroadcast = async () => {
    const token = telegramConfig.botToken?.trim();
    const channel = telegramConfig.channelId?.trim();

    if (!token || !channel) {
      setBroadcastStatus('لطفاً ابتدا توکن ربات (Bot Token) و آیدی کانال را در بخش تنظیمات وارد کنید.');
      setBroadcastSuccess(false);
      return;
    }

    setIsBroadcasting(true);
    setBroadcastStatus('در حال ارسال مستقیم از طریق سرور ابری اروپا به کانال تلگرام...');
    setBroadcastSuccess(null);

    try {
      const miniAppButtonUrl = telegramConfig.miniAppUrl || window.location.href;
      const safeCaption = generatePostText(currentProduct, true);
      const botUser = (telegramConfig.adminUsername || 'nafistejarat_bot').replace('@', '').trim();

      // Configure buttons according to selected destination
      const baseMiniApp = (telegramConfig.miniAppUrl && !telegramConfig.miniAppUrl.includes('ais-dev-'))
        ? telegramConfig.miniAppUrl.replace(/\/+$/, '')
        : 'https://nfs.nafisstore.com';

      let primaryBtn: { text: string; url: string };
      if (primaryButtonTarget === 'miniapp') {
        const separator = baseMiniApp.includes('?') ? '&' : '?';
        const productParam = currentProduct ? `&productId=${encodeURIComponent(currentProduct.id)}` : '';
        const deepLinkUrl = `${baseMiniApp}${separator}view=miniapp${productParam}&_t=${Date.now()}`;

        primaryBtn = {
          text: '🛒 مشاهده کالا و استعلام در مینی‌آپ',
          url: deepLinkUrl,
        };
      } else if (primaryButtonTarget === 'bot') {
        primaryBtn = {
          text: `🤖 گفتگو و سفارش با مدیریت @${botUser}`,
          url: `https://t.me/${botUser}?start=${encodeURIComponent(currentProduct?.id || 'inquiry')}`,
        };
      } else {
        primaryBtn = {
          text: '🌐 مشاهده کالا در وب‌سایت نفیس‌استور',
          url: 'https://nafisstore.com',
        };
      }

      // Call our cloud backend proxy which has direct, unfiltered access to Telegram Bot API
      const response = await fetch('/api/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: token,
          channelId: channel,
          photo: selectedTelegramPhoto || currentProduct?.mainImage,
          caption: safeCaption,
          replyMarkup: {
            inline_keyboard: [
              [primaryBtn],
              [
                {
                  text: `💬 پیام مستقیم به پشتیبانی @${botUser}`,
                  url: `https://t.me/${botUser}`,
                },
                {
                  text: '🌐 سایت نفیس‌استور',
                  url: 'https://nafisstore.com',
                },
              ],
            ],
          },
        }),
      });

      const resData = await response.json();
      if (resData.ok) {
        setBroadcastSuccess(true);
        setBroadcastStatus('✅ عالی! پست با موفقیت به همراه تصویر و دکمه شیشه‌ای فعال در کانال منتشر شد.');
      } else {
        setBroadcastSuccess(false);
        let errorMsg = resData.description || 'خطا در انتشار پیام در تلگرام';

        // Provide friendly Persian explanations for common Telegram errors
        if (errorMsg.includes('chat not found')) {
          errorMsg = '❌ کانال تلگرام یافت نشد! مطمئن شوید آیدی کانال به درستی با @ وارد شده است (مثلاً @NafisSmartTrade) و کانال عمومی است یا ربات به آن اضافه شده است.';
        } else if (errorMsg.includes('bot is not a member') || errorMsg.includes('need administrator rights') || errorMsg.includes('CHAT_ADMIN_REQUIRED')) {
          errorMsg = '❌ ربات هنوز ادمین کانال نیست! لطفاً در تلگرام به بخش تنظیمات کانال رفته و در قسمت Administrators ربات @nafistejarat_bot را به عنوان مدیر با دسترسی «ارسال پیام» اضافه نمایید.';
        } else if (errorMsg.includes('Unauthorized')) {
          errorMsg = '❌ توکن ربات نامعتبر است. لطفاً توکنی که از BotFather@ دریافت کرده‌اید را بررسی فرمایید.';
        }

        setBroadcastStatus(errorMsg);
      }
    } catch (err: any) {
      setBroadcastSuccess(false);
      setBroadcastStatus('خطا در ارتباط با سرور. لطفاً مجدداً امتحان کنید.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 🚀 Cloudflare & Telegram Bot Deployment & Download Banner */}
      {/* Top Selector Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base">
              ژنراتور پست‌های خودکار کانال تلگرام
            </h3>
            <p className="text-xs text-slate-400">
              تولید اتوماتیک کپشن با اموجی‌های استاندارد، مشخصات فنی و دکمه شیشه‌ای مینی‌آپ
            </p>
          </div>
        </div>

        {/* Product Dropdown Selector & Sheet Refresh */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <select
            value={currentProduct?.id || ''}
            onChange={(e) => {
              const p = products.find((x) => x.id === e.target.value);
              if (p) onSelectProduct(p);
            }}
            className="w-full md:w-80 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-400"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.faTitle.substring(0, 45)}...
              </option>
            ))}
          </select>

          {onImportFromSheets && (
            <button
              onClick={onImportFromSheets}
              disabled={isSyncingSheets}
              title="بارگذاری و همگام‌سازی کالاهای جدید از گوگل شیت"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-xl text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">همگام‌سازی با شیت</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Interactive Telegram Post Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#182533] border border-[#243547] rounded-3xl p-5 shadow-2xl space-y-4 max-w-lg mx-auto">
            {/* Telegram Channel Post Bubble */}
            <div className="rounded-2xl overflow-hidden bg-[#242f3d] border border-[#2b394a] shadow-md">
              {/* Product Image & Multi-Image Gallery Selector */}
              {currentProduct && (
                <div className="space-y-0">
                  <div className="relative aspect-video w-full bg-slate-800">
                    <img
                      src={selectedTelegramPhoto || currentProduct.mainImage}
                      alt={currentProduct.faTitle}
                      className="w-full h-full object-cover transition duration-200"
                    />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] text-amber-300 font-bold">
                      ترند {currentProduct.trendScore}٪
                    </div>

                    {currentProduct.images && currentProduct.images.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-amber-300 font-bold">
                        گالری {currentProduct.images.length} تصویر
                      </div>
                    )}
                  </div>

                  {/* Thumbnail Selector for Telegram Post */}
                  {currentProduct.images && currentProduct.images.length > 0 && (
                    <div className="px-3 py-2 bg-[#1b2633] border-b border-[#2b394a] flex items-center gap-2 overflow-x-auto no-scrollbar">
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">عکس پست:</span>
                      {currentProduct.images.map((imgUrl, i) => {
                        const isCurrent = (selectedTelegramPhoto || currentProduct.mainImage) === imgUrl;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedTelegramPhoto(imgUrl)}
                            className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition cursor-pointer shrink-0 ${
                              isCurrent
                                ? 'border-sky-400 scale-105 shadow-sm'
                                : 'border-white/10 opacity-60 hover:opacity-100 hover:border-slate-500'
                            }`}
                            title={`انتخاب عکس ${i + 1}`}
                          >
                            <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                          </button>
                        );
                      })}

                      {/* Direct Upload New Photo to Product and Post */}
                      <label
                        className="w-9 h-9 rounded-lg border border-dashed border-sky-500/50 hover:border-sky-400 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 flex items-center justify-center cursor-pointer transition shrink-0"
                        title="آپلود تصویر جدید برای این کالا و انتخاب برای پست تلگرام"
                      >
                        <ImagePlus className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0 || !currentProduct) return;
                            const reader = new FileReader();
                            reader.onload = (uploadEvent) => {
                              const result = uploadEvent.target?.result as string;
                              if (result) {
                                const updated = [...(currentProduct.images || []), result];
                                setSelectedTelegramPhoto(result);
                                if (onUpdateProductImages) {
                                  onUpdateProductImages(currentProduct.id, updated, currentProduct.mainImage || result);
                                }
                              }
                            };
                            reader.readAsDataURL(files[0]);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Text Caption */}
              <div className="p-4 text-xs text-slate-100 whitespace-pre-line leading-relaxed font-sans select-text">
                {postText}
              </div>

              {/* Character Limit Badge */}
              <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>سازگار با محدودیت 1024 حرف کپشن تلگرام</span>
                </span>
                <span className="font-mono font-bold text-slate-300 bg-black/30 px-2 py-0.5 rounded-md border border-white/10">
                  {postText.length} / 1024
                </span>
              </div>

              {/* Telegram Inline WebApp Buttons Preview */}
              <div className="p-3 pt-0 space-y-2">
                {/* Target Selector */}
                <div className="bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80 mb-2">
                  <div className="text-[10px] text-slate-400 font-medium px-2 py-0.5">عملکرد دکمه اصلی زیر پست در تلگرام:</div>
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPrimaryButtonTarget('bot')}
                      className={`py-1.5 px-2 rounded-lg font-bold transition cursor-pointer text-center ${
                        primaryButtonTarget === 'bot'
                          ? 'bg-sky-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      🤖 چت با ربات
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrimaryButtonTarget('miniapp')}
                      className={`py-1.5 px-2 rounded-lg font-bold transition cursor-pointer text-center ${
                        primaryButtonTarget === 'miniapp'
                          ? 'bg-sky-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      🛒 مینی‌آپ
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrimaryButtonTarget('website')}
                      className={`py-1.5 px-2 rounded-lg font-bold transition cursor-pointer text-center ${
                        primaryButtonTarget === 'website'
                          ? 'bg-sky-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      🌐 وب‌سایت
                    </button>
                  </div>
                </div>

                <button className="w-full py-2.5 rounded-xl font-bold text-xs bg-[#5288c1] hover:bg-[#4375a8] text-white flex items-center justify-center gap-2 shadow transition">
                  {primaryButtonTarget === 'bot' ? (
                    <>
                      <Bot className="w-4 h-4" />
                      <span>💬 گفتگو و سفارش با مدیریت @{(telegramConfig.adminUsername || 'nafistejarat_bot').replace('@', '')}</span>
                    </>
                  ) : primaryButtonTarget === 'miniapp' ? (
                    <>
                      <Smartphone className="w-4 h-4" />
                      <span>🛒 مشاهده کالا و استعلام در مینی‌آپ</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      <span>🌐 مشاهده کالا در وب‌سایت نفیس‌استور</span>
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button className="py-2 rounded-xl text-[11px] font-semibold bg-[#2a3746] hover:bg-[#344456] text-slate-200 flex items-center justify-center gap-1.5 transition">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                    <span>پیام به پشتیبانی</span>
                  </button>

                  <button className="py-2 rounded-xl text-[11px] font-semibold bg-[#2a3746] hover:bg-[#344456] text-slate-200 flex items-center justify-center gap-1.5 transition">
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    <span>سایت نفیس‌استور</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">متن پست کپی شد!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>کپی کامل متن پست تلگرام</span>
                  </>
                )}
              </button>

              <button
                onClick={handleTestBroadcast}
                disabled={isBroadcasting}
                className="nfs-btn-primary flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isBroadcasting ? 'در حال انتشار...' : 'ارسال تست به کانال'}</span>
              </button>
            </div>

            {broadcastStatus && (
              <div
                className={`p-3.5 rounded-xl text-xs border leading-relaxed ${
                  broadcastSuccess === true
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-900/20'
                    : broadcastSuccess === false
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 shadow-lg shadow-rose-900/20'
                    : 'bg-slate-900/90 text-slate-300 border-slate-700'
                }`}
              >
                {broadcastStatus}
              </div>
            )}
          </div>
        </div>

        {/* Right: Bot & Channel Integration Settings */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-base">
                  تنظیمات ربات و کانال تلگرام
                </h3>
              </div>
              <button
                onClick={handleSaveSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                title="ذخیره همیشگی در این دستگاه"
              >
                <Save className="w-3.5 h-3.5" />
                <span>ذخیره تنظیمات</span>
              </button>
            </div>

            {savedSettingsNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>توکن و تنظیمات با موفقیت در مرورگر شما ذخیره شد و همیشه باقی می‌ماند.</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">توکن ربات تلگرام (Bot Token):</label>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    {showToken ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>مخفی‌سازی توکن</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>نمایش کامل توکن</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="مثال: 123456789:ABCdefGHIjklMNOpqrs..."
                    value={telegramConfig.botToken}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTelegramConfig((prev) => ({ ...prev, botToken: val }));
                      try {
                        localStorage.setItem(
                          'nfs_telegram_config',
                          JSON.stringify({ ...telegramConfig, botToken: val })
                        );
                      } catch (err) {}
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-200 text-left font-mono focus:outline-none focus:border-sky-400 placeholder:text-slate-500"
                    dir="ltr"
                  />
                </div>

                {/* Bot Verification Button */}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-slate-400">
                    از ربات <code className="text-amber-300 font-mono">@BotFather</code> دریافت می‌شود.
                  </span>
                  <button
                    type="button"
                    onClick={handleVerifyBot}
                    disabled={isVerifyingBot || !telegramConfig.botToken}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isVerifyingBot ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
                    ) : (
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    )}
                    <span>تست صحت توکن</span>
                  </button>
                </div>

                {botVerifyResult && (
                  <div className="mt-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                    {botVerifyResult}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">آیدی یا شناسه کانال تلگرام:</label>
                <input
                  type="text"
                  placeholder="مثال: @NafisSmartTrade"
                  value={telegramConfig.channelId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTelegramConfig((prev) => ({ ...prev, channelId: val }));
                    try {
                      localStorage.setItem(
                        'nfs_telegram_config',
                        JSON.stringify({ ...telegramConfig, channelId: val })
                      );
                    } catch (err) {}
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-left font-mono focus:outline-none focus:border-sky-400 placeholder:text-slate-500"
                  dir="ltr"
                />
                <span className="text-[10px] text-amber-300/90 block mt-1">
                  ⚠️ حتماً ربات <code className="font-mono text-white">@nafistejarat_bot</code> را در کانال <code className="font-mono text-white">@NafisSmartTrade</code> به عنوان ادمین اضافه کنید.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">آیدی تلگرام ادمین سفارشات:</label>
                <input
                  type="text"
                  placeholder="مثال: nafistejarat_bot"
                  value={telegramConfig.adminUsername}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTelegramConfig((prev) => ({ ...prev, adminUsername: val }));
                    try {
                      localStorage.setItem(
                        'nfs_telegram_config',
                        JSON.stringify({ ...telegramConfig, adminUsername: val })
                      );
                    } catch (err) {}
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-left font-mono focus:outline-none focus:border-sky-400 placeholder:text-slate-500"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-medium text-xs">آدرس وب‌اپ مینی‌آپ (URL):</label>
                  <button
                    type="button"
                    onClick={() => {
                      const hostUrl = 'https://nfs.nafisstore.com';
                      setTelegramConfig((prev) => ({ ...prev, miniAppUrl: hostUrl }));
                      try {
                        localStorage.setItem(
                          'nfs_telegram_config',
                          JSON.stringify({ ...telegramConfig, miniAppUrl: hostUrl })
                        );
                      } catch (err) {}
                    }}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <span>⚡ تنظیم خودکار nfs.nafisstore.com</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="https://nfs.nafisstore.com"
                  value={telegramConfig.miniAppUrl || 'https://nfs.nafisstore.com'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTelegramConfig((prev) => ({ ...prev, miniAppUrl: val }));
                    try {
                      localStorage.setItem(
                        'nfs_telegram_config',
                        JSON.stringify({ ...telegramConfig, miniAppUrl: val })
                      );
                    } catch (err) {}
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-left font-mono text-[11px] focus:outline-none focus:border-sky-400"
                  dir="ltr"
                />
              </div>

              {/* Notice if ais-dev URL is detected */}
              {(telegramConfig.miniAppUrl?.includes('ais-dev-') || telegramConfig.miniAppUrl?.includes('run.app')) && (
                <div className="p-3 rounded-xl bg-rose-500/15 border-2 border-rose-500/50 text-rose-200 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>علت خطای «Error: Page not found» در تلگرام شما:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-200">
                    آدرسی که وارد کرده‌اید آدرس موقت گوگل است. تلگرام اجازه باز کردن این لینک را ندارد. باید دقیقاً آدرس اختصاصی ساب‌دامین شما یعنی 
                    <strong className="text-white font-mono mx-1 font-bold">https://nfs.nafisstore.com</strong> 
                    را هم در این فیلد و هم در BotFather ثبت کنید.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const hostUrl = 'https://nfs.nafisstore.com';
                      setTelegramConfig((prev) => ({ ...prev, miniAppUrl: hostUrl }));
                      try {
                        localStorage.setItem(
                          'nfs_telegram_config',
                          JSON.stringify({ ...telegramConfig, miniAppUrl: hostUrl })
                        );
                      } catch (err) {}
                    }}
                    className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow cursor-pointer"
                  >
                    اصلاح فوری به https://nfs.nafisstore.com
                  </button>
                </div>
              )}

              {/* Mini App URL helper notice */}
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-200/90 space-y-2">
                <div className="font-bold flex items-center justify-between text-sky-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>آدرس عمومی و پایدار مینی‌آپ تلگرام شما:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://nfs.nafisstore.com');
                      alert('آدرس کپی شد: https://nfs.nafisstore.com');
                    }}
                    className="text-[10px] text-emerald-400 hover:underline font-mono"
                  >
                    کپی آدرس
                  </button>
                </div>
                <div className="font-mono text-xs text-white bg-black/40 p-2 rounded-lg text-left select-all" dir="ltr">
                  https://nfs.nafisstore.com
                </div>
                <p className="leading-relaxed text-[10px] text-slate-300">
                  این آدرس را در <span className="text-amber-300 font-bold">@BotFather</span> در بخش‌های <code className="font-mono text-sky-300">Edit Web App URL</code> و <code className="font-mono text-sky-300">Configure Menu Button</code> بفرستید تا دکمه کاتالوگ در ربات به درستی باز شود.
                </p>
              </div>

              {/* Permanent Save Action Bar */}
              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer mt-2"
                title="ذخیره توکن و مشخصات ربات در دیتابیس هاست (ماندگار در همه دستگاه‌ها و مرورگرها)"
              >
                <Save className="w-4 h-4" />
                <span>💾 ذخیره دائمی تنظیمات و توکن در هاست (ماندگار در همه مرورگرها)</span>
              </button>

              {savedSettingsNotice && (
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold text-center animate-fadeIn">
                  ✅ تنظیمات و توکن ربات با موفقیت در دیتابیس هاست ذخیره شدند و روی همه دستگاه‌ها حفظ می‌شوند!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Mini App Deployment Guide Modal */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    آموزش گام‌به‌گام رفع خطای 404 و اجرای مینی‌آپ در تلگرام
                  </h3>
                  <p className="text-xs text-slate-400">
                    نحوه ثبت آدرس عمومی در BotFather برای باز شدن تمام‌صفحه مینی‌آپ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
              <span className="font-bold text-amber-300">💡 علت خطا چیست؟</span> تلگرام صفحات وب‌اپ را داخل محیط موبایل باز می‌کند. آدرسی که با <code className="font-mono text-amber-300">ais-dev</code> شروع می‌شود، یک محیط موقت و تحت احراز هویت داخلی گوگل است. برای اینکه مینی‌آپ تلگرام باز شود، تلگرام به یک آدرس اینترنتی عمومی HTTPS بدون نیاز به لاگین گوگل نیاز دارد.
            </div>

            {/* Actionable Ways for Cloudflare */}
            <div className="space-y-4">
              {/* Method 1: Cloudflare Pages Direct Drag & Drop */}
              {/* Primary Method: Host nfs.nafisstore.com */}
              <div className="bg-slate-800/80 border border-emerald-500/40 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <h4 className="font-bold text-white text-sm">
                      میزبانی و استقرار دائمی روی ساب‌دامین اختصاصی nfs.nafisstore.com
                    </h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                    دیتابیس دائم + بدون فیلتر در ایران
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  وب‌اپ و مینی‌آپ تلگرام شما روی ساب‌دامین اختصاصی <code className="font-mono text-emerald-300">https://nfs.nafisstore.com</code> مستقر است. این آدرس فایل‌های کاتالوگ را به صورت پایدار ذخیره کرده و عکس‌ها را بدون مشکل فیلترینگ نمایش می‌دهد.
                </p>
              </div>

              {/* Step 2: BotFather Setup */}
              <div className="bg-sky-950/40 border border-sky-800/50 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-xs">
                    2
                  </span>
                  <h4 className="font-bold text-white text-sm">
                    ثبت و فعال‌سازی در BotFather (تنها ۳۰ ثانیه):
                  </h4>
                </div>
                <ol className="text-xs text-slate-200 space-y-1.5 list-decimal list-inside pr-1">
                  <li>در تلگرام وارد ربات <code className="font-mono text-amber-300">@BotFather</code> شوید.</li>
                  <li>دستور <code className="font-mono text-sky-300">/myapps</code> را ارسال کرده و مینی‌آپ یا ربات <code className="font-mono text-emerald-300">@nafistejarat_bot</code> را انتخاب کنید.</li>
                  <li>روی گزینه <strong>Edit App</strong> و سپس <strong>Edit Web App URL</strong> کلیک کنید.</li>
                  <li>آدرس هاست دائمی را ارسال نمایید: <code className="font-mono text-amber-300">https://nfs.nafisstore.com</code></li>
                  <li>سپس با دستور <code className="font-mono text-sky-300">/setmenubutton</code> آدرس دکمه منو را نیز به همین لینک تغییر دهید.</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                متوجه شدم و بستن راهنما
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
