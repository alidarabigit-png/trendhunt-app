import React, { useState } from 'react';
import {
  Smartphone,
  Bot,
  Search,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Package,
  Layers,
  Sparkles,
  Send,
  ExternalLink,
  MessageSquare,
  ShoppingCart,
  Check,
  Sun,
  Moon,
  Lock,
  Unlock,
  Building,
  UserCheck,
  Menu,
  X,
  Globe,
  ChevronLeft,
  Bell,
  BellRing,
  CheckCircle2,
  Plus,
  Minus,
  Info,
  FileText,
} from 'lucide-react';
import { ProductItem, CustomerUser, CurrencyRates, MiniAppNotification, CustomerInquiry } from '../types';
import { NfsLogo } from './NfsLogo';
import { deduplicateProducts } from '../utils/catalogUtils';

interface TelegramMiniAppPreviewProps {
  products: ProductItem[];
  selectedProduct: ProductItem | null;
  onSelectProduct: (p: ProductItem) => void;
  currencyRates: CurrencyRates;
  currentCustomer: CustomerUser;
  onSubmitInquiry: (productId: string, quantity: number, notes?: string) => void;
  notifications?: MiniAppNotification[];
  onMarkNotificationRead?: (notifId: string) => void;
  inquiries?: CustomerInquiry[];
  onApproveQuote?: (inquiryId: string) => void;
  onCustomerSendMessage?: (inquiryId: string, text: string) => void;
  isStandalone?: boolean;
  onSwitchToAdmin?: () => void;
}

export const TelegramMiniAppPreview: React.FC<TelegramMiniAppPreviewProps> = ({
  products,
  selectedProduct,
  onSelectProduct,
  currencyRates,
  currentCustomer,
  onSubmitInquiry,
  notifications = [],
  onMarkNotificationRead,
  inquiries = [],
  onApproveQuote,
  onCustomerSendMessage,
  isStandalone = false,
  onSwitchToAdmin,
}) => {
  const [activeCategory, setActiveCategory] = useState('همه');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMiniAppDrawerOpen, setIsMiniAppDrawerOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [selectedInquiryDetail, setSelectedInquiryDetail] = useState<CustomerInquiry | null>(null);
  const [customerChatReplyText, setCustomerChatReplyText] = useState('');
  const [activePushToast, setActivePushToast] = useState<MiniAppNotification | null>(null);
  const [activeProductModal, setActiveProductModal] = useState<ProductItem | null>(
    selectedProduct || products[0] || null
  );
  const [orderQuantity, setOrderQuantity] = useState<number>(
    selectedProduct?.moq || products[0]?.moq || 50
  );
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<'TOMAN' | 'CNY' | 'AED' | 'USD'>('TOMAN');

  // Mini App View Routing: 'catalog' (product feed) or 'detail' (full product page)
  const [miniAppView, setMiniAppView] = useState<'catalog' | 'detail'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('productId') || params.get('product') || params.get('id') || (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param) {
        return 'detail';
      }
    }
    return selectedProduct ? 'detail' : 'catalog';
  });

  // Keep activeProductModal and miniAppView synchronized when selectedProduct changes
  React.useEffect(() => {
    if (selectedProduct) {
      setActiveProductModal(selectedProduct);
      setOrderQuantity(selectedProduct.moq || 50);
      setMiniAppView('detail');
    }
  }, [selectedProduct?.id]);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [customerInquiryNotes, setCustomerInquiryNotes] = useState('');

  // Track latest notification to trigger in-app push banner
  const [prevNotifCount, setPrevNotifCount] = useState(notifications.length);

  React.useEffect(() => {
    if (notifications.length > prevNotifCount && notifications[0]) {
      const latest = notifications[0];
      setActivePushToast(latest);

      // Play soft chime sound
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch (e) {
        // ignore audio policy restrictions
      }

      // Auto dismiss push banner after 6 seconds
      const timer = setTimeout(() => {
        setActivePushToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
    setPrevNotifCount(notifications.length);
  }, [notifications.length]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Simulation mode: user can toggle between testing as approved or unapproved viewer
  const [previewAsApproved, setPreviewAsApproved] = useState<boolean>(
    currentCustomer?.status === 'approved'
  );

  // Admin PIN Protection states
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  const cleanProducts = React.useMemo(() => deduplicateProducts(products), [products]);

  const currentProduct = activeProductModal || selectedProduct || cleanProducts[0];

  const categories = ['همه', ...Array.from(new Set(cleanProducts.map((p) => p.category)))];

  const filtered = cleanProducts.filter(
    (p) => activeCategory === 'همه' || p.category === activeCategory
  );

  // Calculate tiered price based on slider quantity safely
  const getCalculatedPrice = (product: ProductItem | null, qty: number) => {
    if (!product) return null;
    const tiers = product.tieredPricing || [];
    let matchedTier = tiers[0];
    for (const tier of tiers) {
      if (qty >= tier.minQuantity) {
        matchedTier = tier;
      }
    }
    const safeUsdRate = currencyRates?.usd || 95000;
    const safeCostUsd = product.costPerUnitUsd || 10;
    const unitToman = matchedTier?.calculatedPriceToman || Math.round(safeCostUsd * safeUsdRate * 1.4);
    const unitUsd = matchedTier?.priceUsd || safeCostUsd;
    const unitCny = matchedTier?.priceCny || Number((unitUsd * 7.24).toFixed(1));
    const unitAed = matchedTier?.priceAed || Number((unitUsd * 3.67).toFixed(1));

    return {
      unitToman,
      totalToman: unitToman * qty,
      unitUsd,
      unitCny,
      unitAed,
    };
  };

  const currentPricing = currentProduct ? getCalculatedPrice(currentProduct, orderQuantity) : null;

  const handleSendInquiry = () => {
    if (!currentProduct) return;
    onSubmitInquiry(currentProduct.id, orderQuantity, customerInquiryNotes);
    setInquirySuccess(true);
    setCustomerInquiryNotes('');
    setTimeout(() => setInquirySuccess(false), 3500);
  };

  const renderScreenContent = () => (
    <div
      data-phone-dark={isDarkMode ? 'true' : 'false'}
      className={`w-full ${
        isStandalone ? 'min-h-screen max-w-lg mx-auto shadow-2xl' : 'h-[760px] rounded-[34px]'
      } overflow-hidden flex flex-col relative transition-colors duration-200 select-none ${
        isDarkMode ? 'bg-[#17212b] text-white' : 'bg-[#ffffff] text-[#0f172a]'
      }`}
    >
            {/* Telegram Header Bar */}
            <div
              className={`px-3.5 pt-8 pb-3 border-b flex items-center justify-between z-20 ${
                isDarkMode ? 'bg-[#17212b] border-[#232e3c]' : 'bg-[#0F172A] text-white border-slate-800'
              }`}
            >
              {miniAppView === 'detail' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMiniAppView('catalog')}
                    className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition cursor-pointer bg-white/10 px-2 py-1 rounded-lg"
                    title="بازگشت به کاتالوگ"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>کاتالوگ</span>
                  </button>
                  <div className="text-right truncate max-w-[150px]">
                    <div className="text-xs font-bold truncate">{currentProduct?.faTitle || 'جزئیات کالا'}</div>
                    <div className="text-[9px] opacity-75">مشخصات فنی و استعلام</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Mobile Drawer Trigger for Mini App */}
                  <button
                    onClick={() => setIsMiniAppDrawerOpen(true)}
                    className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-[#FF4D6D] border border-white/10 transition cursor-pointer"
                    title="باز کردن منوی کشویی مینی‌آپ"
                  >
                    <Menu className="w-4 h-4" />
                  </button>

                  <div className="text-right">
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span className="text-[#FF4D6D] font-mono font-black">NFS</span>
                      <span>کاتالوگ نفیس تجارت هوشمند</span>
                    </div>
                    <div className="text-[10px] opacity-75">nfs.nafisstore.com</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {/* Notification Bell with Badge */}
                <button
                  onClick={() => setIsNotificationsModalOpen(true)}
                  className="relative p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-slate-300 hover:text-white transition cursor-pointer"
                  title="اعلان‌ها و پاسخ‌های ادمین"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#E63946] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold font-mono animate-pulse shadow-sm shadow-[#E63946]/50">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 transition cursor-pointer"
                  title="تغییر تم تلگرام"
                >
                  {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-white" />}
                </button>

                {previewAsApproved ? (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    همکار تایید شده
                  </span>
                ) : (
                  <span className="text-[9px] bg-[#E63946]/20 text-[#FF4D6D] border border-[#E63946]/30 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    احراز نشده
                  </span>
                )}
              </div>
            </div>

            {/* Real-time In-App Push Banner Toast inside Phone Screen */}
            {activePushToast && (
              <div
                onClick={() => {
                  const targetInq = inquiries.find((i) => i.id === activePushToast.inquiryId);
                  if (targetInq) setSelectedInquiryDetail(targetInq);
                  setIsNotificationsModalOpen(true);
                  if (onMarkNotificationRead) onMarkNotificationRead(activePushToast.id);
                  setActivePushToast(null);
                }}
                className="absolute top-16 left-3 right-3 z-45 bg-[#0F172A]/95 border-2 border-[#E63946] text-white p-3 rounded-2xl shadow-2xl backdrop-blur-md cursor-pointer animate-bounce flex items-start gap-2.5"
              >
                <div className="w-8 h-8 rounded-xl bg-[#E63946] text-white flex items-center justify-center shrink-0 shadow-md shadow-red-500/30">
                  <BellRing className="w-4 h-4 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-[#FF4D6D]">
                      {activePushToast.title}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {activePushToast.timestamp}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-200 line-clamp-2 mt-0.5 leading-snug">
                    {activePushToast.message}
                  </p>
                  <div className="text-[9px] text-amber-400 font-bold mt-1 flex items-center gap-1">
                    <span>مشاهده پیش‌فاکتور و گفتگو</span>
                    <ChevronLeft className="w-3 h-3" />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePushToast(null);
                  }}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Modal: Notifications & Inquiries Center */}
            {isNotificationsModalOpen && (
              <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col justify-end">
                <div
                  className={`w-full max-h-[85%] rounded-t-3xl border-t flex flex-col shadow-2xl overflow-hidden ${
                    isDarkMode ? 'bg-[#17212b] border-[#2c3a4b] text-white' : 'bg-[#0F172A] border-slate-800 text-white'
                  }`}
                >
                  {/* Modal Header */}
                  <div className="p-3.5 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#E63946]/20 text-[#FF4D6D] flex items-center justify-center">
                        <Bell className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-xs">
                        {selectedInquiryDetail ? 'پاسخ و پیش‌فاکتور استعلام' : 'مرکز اعلان‌ها و استعلام‌های من'}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1">
                      {selectedInquiryDetail && (
                        <button
                          onClick={() => setSelectedInquiryDetail(null)}
                          className="text-[10px] text-sky-400 hover:underline px-2 py-1"
                        >
                          بازگشت به لیست
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsNotificationsModalOpen(false);
                          setSelectedInquiryDetail(null);
                        }}
                        className="p-1 rounded-lg hover:bg-white/10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Content */}
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-3 no-scrollbar text-xs">
                    {selectedInquiryDetail ? (
                      // Single Inquiry Conversation & Quotation View
                      <div className="space-y-3">
                        <div className="p-3 rounded-2xl bg-black/25 border border-white/10 space-y-2">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={selectedInquiryDetail.productImage}
                              alt={selectedInquiryDetail.productTitle}
                              className="w-12 h-12 rounded-xl object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <h5 className="font-bold text-xs truncate text-white">{selectedInquiryDetail.productTitle}</h5>
                              <div className="text-[10px] text-slate-400">تیراژ درخواستی: {selectedInquiryDetail.requestedQuantity} عدد</div>
                              <div className="text-[11px] font-bold text-emerald-400 font-mono">
                                مبلغ کل: {selectedInquiryDetail.totalPriceToman.toLocaleString('en-US')} تومان
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">وضعیت پیش‌فاکتور:</span>
                            <span className="font-bold text-amber-300">
                              {selectedInquiryDetail.status === 'quoted'
                                ? 'پیش‌فاکتور صادر شد'
                                : selectedInquiryDetail.status === 'approved_by_client'
                                ? 'تایید شده توسط همکار'
                                : 'در حال بررسی توسط ادمین'}
                            </span>
                          </div>
                        </div>

                        {/* Messages Thread */}
                        <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                          {selectedInquiryDetail.messages.map((m) => (
                            <div
                              key={m.id}
                              className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed shadow-sm ${
                                m.sender === 'admin'
                                  ? 'bg-rose-600 text-white mr-auto'
                                  : 'bg-slate-800 text-white border border-slate-700 ml-auto'
                              }`}
                            >
                              <div className="font-bold text-[10px] opacity-75 mb-0.5">{m.senderName}:</div>
                              <div>{m.text}</div>
                              <div className="text-[9px] opacity-60 font-mono text-left pt-1">{m.timestamp}</div>
                            </div>
                          ))}
                        </div>

                        {/* Customer Reply Input */}
                        <div className="flex items-center gap-2 pt-2">
                          <input
                            type="text"
                            placeholder="ارسال پیام تکمیلی به ادمین..."
                            value={customerChatReplyText}
                            onChange={(e) => setCustomerChatReplyText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && customerChatReplyText.trim() && onCustomerSendMessage) {
                                onCustomerSendMessage(selectedInquiryDetail.id, customerChatReplyText);
                                setCustomerChatReplyText('');
                              }
                            }}
                            className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E63946]"
                          />
                          <button
                            onClick={() => {
                              if (customerChatReplyText.trim() && onCustomerSendMessage) {
                                onCustomerSendMessage(selectedInquiryDetail.id, customerChatReplyText);
                                setCustomerChatReplyText('');
                              }
                            }}
                            className="p-2 bg-[#E63946] text-white rounded-xl"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Approve Quote Button */}
                        {selectedInquiryDetail.status === 'quoted' && onApproveQuote && (
                          <button
                            onClick={() => {
                              onApproveQuote(selectedInquiryDetail.id);
                              setSelectedInquiryDetail({ ...selectedInquiryDetail, status: 'approved_by_client' });
                            }}
                            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تایید نهایی پیش‌فاکتور و ارجاع به مرحله تامین</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      // Notifications List
                      <div className="space-y-2">
                        {notifications.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 space-y-1">
                            <Bell className="w-8 h-8 mx-auto opacity-30" />
                            <p className="text-xs">هیچ اعلان یا پاسخی ثبت نشده است.</p>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => {
                                if (onMarkNotificationRead) onMarkNotificationRead(notif.id);
                                const inq = inquiries.find((i) => i.id === notif.inquiryId);
                                if (inq) setSelectedInquiryDetail(inq);
                              }}
                              className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-2.5 ${
                                notif.read
                                  ? 'bg-black/15 border-white/5 opacity-75'
                                  : 'bg-[#E63946]/10 border-[#E63946]/40 text-white'
                              }`}
                            >
                              <div className="w-7 h-7 rounded-xl bg-[#E63946]/20 text-[#FF4D6D] flex items-center justify-center shrink-0">
                                <Bell className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs">{notif.title}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{notif.timestamp}</span>
                                </div>
                                <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{notif.message}</p>
                                <span className="text-[10px] text-sky-400 font-semibold mt-1 inline-block">
                                  مشاهده گفتگو و پیش‌فاکتور ←
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mini App Slide-Out Drawer (منوی کشویی سرسره‌ای از سمت راست داخل مینی‌آپ) */}
            {/* Backdrop */}
            <div
              onClick={() => setIsMiniAppDrawerOpen(false)}
              className={`absolute inset-0 bg-black/70 backdrop-blur-xs z-40 transition-opacity duration-300 ${
                isMiniAppDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            />

            {/* Drawer Container (Sliding from Right in RTL) */}
            <aside
              className={`absolute top-0 bottom-0 right-0 z-50 w-72 max-w-[85%] ${
                isDarkMode ? 'bg-[#17212b] text-white border-l border-[#232e3c]' : 'bg-[#0F172A] text-white border-l border-slate-800'
              } shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out transform ${
                isMiniAppDrawerOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <NfsLogo size="sm" />

                <button
                  onClick={() => setIsMiniAppDrawerOpen(false)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 no-scrollbar text-xs">
                {/* Customer Account Summary Card */}
                <div className="p-3 rounded-2xl bg-black/30 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">حساب کاربری همکار:</span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                        previewAsApproved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#E63946]/20 text-[#FF4D6D]'
                      }`}
                    >
                      {previewAsApproved ? 'تایید شده (قیمت فعال)' : 'در انتظار تایید (قیمت قفل)'}
                    </span>
                  </div>
                  <div className="font-bold text-white text-xs">{currentCustomer?.name || 'کاربر همکار'}</div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                    <span>سطح: {currentCustomer?.tier || 'همکار برنزی'}</span>
                    <span className="font-mono text-sky-400">@{currentCustomer?.telegramUsername || 'nafis'}</span>
                  </div>
                </div>

                {/* Admin Switcher for Store Owner (Protected by PIN) */}
                {onSwitchToAdmin && (
                  <button
                    onClick={() => {
                      setIsMiniAppDrawerOpen(false);
                      if (sessionStorage.getItem('nfs_admin_auth') === 'true') {
                        onSwitchToAdmin();
                      } else {
                        setIsAdminPinModalOpen(true);
                        setAdminPinInput('');
                        setAdminPinError('');
                      }
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>ورود به پنل مدیریت بازرگانی</span>
                    </div>
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">رمزدار</span>
                  </button>
                )}

                {/* Notifications & Inquiries Center in Drawer */}
                <button
                  onClick={() => {
                    setIsMiniAppDrawerOpen(false);
                    setIsNotificationsModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-rose-400" />
                    <span>مرکز اعلان‌ها و استعلام‌های من</span>
                  </div>
                  {unreadCount > 0 ? (
                    <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold font-mono animate-pulse">
                      {unreadCount} جدید
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-normal">مشاهده</span>
                  )}
                </button>

                {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                  <button
                    onClick={() => {
                      Notification.requestPermission();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 transition cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>فعال‌سازی پوش‌نوتیفیکیشن مرورگر</span>
                  </button>
                )}

                {/* Currency Switcher in Drawer */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-300 block">واحد پول نمایشی قیمت‌ها:</label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-black/30 rounded-xl border border-white/10 text-center font-mono text-[10px]">
                    <button
                      onClick={() => setDisplayCurrency('TOMAN')}
                      className={`py-1 rounded-lg transition font-sans cursor-pointer ${displayCurrency === 'TOMAN' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      تومان
                    </button>
                    <button
                      onClick={() => setDisplayCurrency('USD')}
                      className={`py-1 rounded-lg transition cursor-pointer ${displayCurrency === 'USD' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      $ USD
                    </button>
                    <button
                      onClick={() => setDisplayCurrency('CNY')}
                      className={`py-1 rounded-lg transition cursor-pointer ${displayCurrency === 'CNY' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      ¥ CNY
                    </button>
                    <button
                      onClick={() => setDisplayCurrency('AED')}
                      className={`py-1 rounded-lg transition cursor-pointer ${displayCurrency === 'AED' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      AED
                    </button>
                  </div>
                </div>

                {/* Categories Navigation in Drawer */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 px-1 pb-1">دسته‌بندی‌های کالای عمده:</div>
                  {categories.map((cat) => {
                    const isCatActive = activeCategory === cat;
                    const catCount = cat === 'همه' ? cleanProducts.length : cleanProducts.filter((p) => p.category === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveCategory(cat);
                          setIsMiniAppDrawerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          isCatActive
                            ? 'bg-rose-600 text-white border border-rose-500 font-bold shadow-md shadow-rose-900/30'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Package className={`w-3.5 h-3.5 ${isCatActive ? 'text-white' : 'text-rose-400'}`} />
                          <span>{cat}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono ${isCatActive ? 'text-white font-bold' : 'opacity-60'}`}>({catCount})</span>
                          <ChevronLeft className={`w-3.5 h-3.5 ${isCatActive ? 'text-white' : 'text-slate-500'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* External links */}
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <a
                    href="https://t.me/NafisSmartTrade"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-300 hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Send className="w-3.5 h-3.5 text-sky-400" />
                      <span>کانال رسمی تلگرام (@NafisSmartTrade)</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>

                  <a
                    href="https://t.me/nafistejarat_bot"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-300 hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5 text-[#FF4D6D]" />
                      <span>ربات هوشمند استعلام (@nafistejarat_bot)</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>

                  <a
                    href="https://nafisstore.com"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-300 hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>وب‌سایت نفیس‌استور (nafisstore.com)</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>

                  <div className="p-2.5 rounded-xl bg-[#E63946]/10 border border-[#E63946]/20 text-[10px] text-slate-300 space-y-1">
                    <div className="font-bold text-[#FF4D6D] flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>پشتیبانی سفارشات شرکت:</span>
                    </div>
                    <p className="text-slate-400">شرکت نفیس تجارت هوشمند (NFS) • تامین کانتینری و حواله ارزی مستقیم</p>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-3 border-t border-white/10 text-center text-[10px] text-slate-400">
                <span>NFS Telegram MiniApp v2.4</span>
              </div>
            </aside>

            {/* Telegram Mini App Internal Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
              {miniAppView === 'detail' && currentProduct ? (
                /* Dedicated Full Product Detail Page inside Mini App */
                <div className="space-y-3 pb-2 animate-fadeIn">
                  {/* Large Image Gallery & Switcher */}
                  <div className="space-y-2">
                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-md">
                      <img
                        src={selectedGalleryImage || currentProduct.mainImage}
                        alt={currentProduct.faTitle}
                        className="w-full h-full object-cover transition duration-300"
                      />
                      <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] text-amber-300 font-bold font-mono border border-amber-500/30">
                        ترند {currentProduct.trendScore}%
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] text-slate-300">
                        حداقل سفارش: {currentProduct.moq} عدد
                      </div>
                    </div>

                    {/* Multiple Gallery Thumbnails */}
                    {currentProduct.images && currentProduct.images.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                        {currentProduct.images.map((imgUrl, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedGalleryImage(imgUrl)}
                            className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                              (selectedGalleryImage || currentProduct.mainImage) === imgUrl
                                ? 'border-[#E63946] scale-105'
                                : 'border-white/10 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Product Titles & Sourcing Badges */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {currentProduct.category}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                        {currentProduct.supplier.platform}
                      </span>
                      {currentProduct.supplier.hasTradeAssurance && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          ضمانت تجاری
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-extrabold leading-snug">
                      {currentProduct.faTitle}
                    </h3>

                    <p className="text-[10px] opacity-60 font-mono line-clamp-1" dir="ltr">
                      {currentProduct.originalTitle}
                    </p>
                  </div>

                  {/* Wholesale Tiered Pricing Card */}
                  <div
                    className={`rounded-2xl p-3 border space-y-2.5 ${
                      isDarkMode ? 'bg-[#202b36] border-[#2c3a4b]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-white/10">
                      <span className="text-[11px] font-bold flex items-center gap-1 text-emerald-400">
                        <Layers className="w-3.5 h-3.5" />
                        جدول قیمت‌های پلکانی عمده
                      </span>
                      {/* Currency Switcher */}
                      <div className="flex items-center gap-1 text-[9px] bg-black/30 p-0.5 rounded-lg border border-white/10">
                        <button
                          onClick={() => setDisplayCurrency('TOMAN')}
                          className={`px-1.5 py-0.5 rounded ${displayCurrency === 'TOMAN' ? 'bg-[#5288c1] text-white font-bold' : 'opacity-70'}`}
                        >
                          تومان
                        </button>
                        <button
                          onClick={() => setDisplayCurrency('USD')}
                          className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'USD' ? 'bg-[#5288c1] text-white font-bold' : 'opacity-70'}`}
                        >
                          $
                        </button>
                        <button
                          onClick={() => setDisplayCurrency('CNY')}
                          className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'CNY' ? 'bg-[#5288c1] text-white font-bold' : 'opacity-70'}`}
                        >
                          ¥
                        </button>
                      </div>
                    </div>

                    {previewAsApproved ? (
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {currentProduct.tieredPricing.map((tier, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded-xl border text-[10px] space-y-0.5 ${
                              orderQuantity >= tier.minQuantity && (!tier.maxQuantity || orderQuantity <= tier.maxQuantity)
                                ? 'bg-[#5288c1]/20 border-[#5288c1] font-bold text-sky-300'
                                : 'bg-black/20 border-white/10 opacity-80'
                            }`}
                          >
                            <div className="opacity-70 text-[9px]">
                              {tier.maxQuantity ? `${tier.minQuantity}-${tier.maxQuantity} عدد` : `+${tier.minQuantity} عدد`}
                            </div>
                            <div className="font-extrabold text-[11px] font-mono text-emerald-400">
                              {displayCurrency === 'TOMAN'
                                ? `${(tier.calculatedPriceToman || 0).toLocaleString('en-US')}`
                                : displayCurrency === 'USD'
                                ? `$${tier.priceUsd.toFixed(2)}`
                                : `¥${tier.priceCny || (tier.priceUsd * 7.24).toFixed(1)}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-1">
                        <div className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1">
                          <Lock className="w-3.5 h-3.5" />
                          <span>قیمت‌های دقیق پلکانی مختص همکاران تایید شده است</span>
                        </div>
                        <p className="text-[10px] opacity-80">
                          برای استعلام و دریافت قیمت‌ها روی دکمه ثبت استعلام زیر بزنید.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Interactive Order Quantity Stepper & Calculator */}
                  <div
                    className={`rounded-2xl p-3 border space-y-2.5 ${
                      isDarkMode ? 'bg-[#202b36] border-[#2c3a4b]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>محاسبه‌گر تیراژ سفارش</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOrderQuantity(Math.max(currentProduct.moq, orderQuantity - 10))}
                          className="w-6 h-6 rounded-lg bg-black/40 hover:bg-black/60 flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-black/30 text-amber-300">
                          {orderQuantity} عدد
                        </span>
                        <button
                          onClick={() => setOrderQuantity(orderQuantity + 10)}
                          className="w-6 h-6 rounded-lg bg-black/40 hover:bg-black/60 flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={currentProduct.moq}
                      max={currentProduct.moq * 20}
                      step={10}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(Number(e.target.value))}
                      className="w-full accent-[#5288c1] cursor-pointer"
                    />

                    {/* Live Calculated Price Summary */}
                    {currentPricing && previewAsApproved && (
                      <div className="p-2.5 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between text-xs">
                        <div>
                          <div className="text-[9px] opacity-70">قیمت واحد در این تیراژ:</div>
                          <div className="font-bold text-emerald-400 font-mono">
                            {displayCurrency === 'TOMAN'
                              ? `${currentPricing.unitToman.toLocaleString('en-US')} تومان`
                              : displayCurrency === 'USD'
                              ? `$${currentPricing.unitUsd.toFixed(2)}`
                              : `¥${currentPricing.unitCny}`}
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="text-[9px] opacity-70">مبلغ کل پیش‌فاکتور:</div>
                          <div className="font-extrabold text-amber-300 font-mono text-sm">
                            {(currentPricing.totalToman / 1000000).toFixed(2)} M تومان
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Customer Inquiry Memo / Special Request */}
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] opacity-80 flex items-center gap-1 font-semibold">
                        <MessageSquare className="w-3 h-3 text-sky-400" />
                        <span>توضیحات و نیازمندی‌های این سفارش (اختیاری):</span>
                      </label>
                      <textarea
                        rows={2}
                        value={customerInquiryNotes}
                        onChange={(e) => setCustomerInquiryNotes(e.target.value)}
                        placeholder="مثال: درخواست رنگ‌بندی خاص، نمونه تستی، ترخیص در گمرک غرب تهران..."
                        className="w-full bg-black/30 border border-white/15 rounded-xl p-2 text-[11px] focus:outline-none focus:border-sky-400 placeholder:opacity-40 resize-none"
                      />
                    </div>
                  </div>

                  {/* Technical Specifications Table */}
                  {currentProduct.technicalSpecs && (
                    <div
                      className={`rounded-2xl p-3 border space-y-2 ${
                        isDarkMode ? 'bg-[#202b36] border-[#2c3a4b]' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold flex items-center gap-1.5 opacity-90 pb-1 border-b border-white/10">
                        <Info className="w-3.5 h-3.5 text-sky-400" />
                        <span>مشخصات فنی و استانداردهای کالا:</span>
                      </div>
                      <div className="divide-y divide-white/5 text-[10px]">
                        {Object.entries(currentProduct.technicalSpecs).map(([key, val], idx) => (
                          <div key={idx} className="py-1.5 flex items-center justify-between">
                            <span className="opacity-70">{key}:</span>
                            <span className="font-semibold text-right max-w-[60%]">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Features & Full Description */}
                  <div
                    className={`rounded-2xl p-3 border space-y-2 ${
                      isDarkMode ? 'bg-[#202b36] border-[#2c3a4b]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="text-[11px] font-bold flex items-center gap-1.5 opacity-90 pb-1 border-b border-white/10">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>ویژگی‌های کلیدی و توضیحات جامع:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[10px] opacity-85 leading-relaxed">
                      {currentProduct.faFeatures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] opacity-75 pt-1 border-t border-white/5 leading-relaxed">
                      {currentProduct.faFullDesc}
                    </p>
                  </div>
                </div>
              ) : (
                /* Catalog Feed Grid View */
                <div className="space-y-3">
                  {/* Gatekeeping notice if unapproved */}
                  {!previewAsApproved && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>قیمت‌های عمده اختصاصی همکاران تایید شده است</span>
                      </div>
                      <p className="opacity-80 leading-relaxed">
                        جهت جلوگیری از افشای حاشیه سود شما، قیمت‌ها برای عموم قفل است. با تایید مدیریت قیمت‌ها فعال می‌شوند.
                      </p>
                    </div>
                  )}

                  {/* User Greeting & Search inside Mini App */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold">کالاهای جدید عمده‌فروشی</h4>
                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          برای مشاهده مشخصات کامل و ثبت استعلام روی هر کالا بزنید
                        </p>
                      </div>

                      {/* Currency Switcher */}
                      {previewAsApproved && (
                        <div className="flex items-center gap-1 text-[9px] bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
                          <button
                            onClick={() => setDisplayCurrency('TOMAN')}
                            className={`px-1.5 py-0.5 rounded ${displayCurrency === 'TOMAN' ? 'bg-[#5288c1] text-white font-bold' : 'opacity-70'}`}
                          >
                            تومان
                          </button>
                          <button
                            onClick={() => setDisplayCurrency('USD')}
                            className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'USD' ? 'bg-[#5288c1] text-white font-bold' : 'opacity-70'}`}
                          >
                            $
                          </button>
                          <button
                            onClick={() => setDisplayCurrency('CNY')}
                            className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'CNY' ? 'bg-[#5288c1] text-white font-bold' : 'opacity-70'}`}
                          >
                            ¥
                          </button>
                          <button
                            onClick={() => setDisplayCurrency('AED')}
                            className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'AED' ? 'bg-[#5288c1] text-white font-bold' : 'opacity-70'}`}
                          >
                            درهم
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Category Chips inside Mini App */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
                            activeCategory === cat
                              ? 'bg-[#E63946] text-white font-bold shadow-sm shadow-[#E63946]/30'
                              : isDarkMode
                              ? 'bg-[#232e3c] text-slate-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Products Feed inside Mini App */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {filtered.map((item) => {
                      const tiers = item.tieredPricing || [];
                      const lastTier = tiers.length > 0 ? tiers[tiers.length - 1] : null;
                      const lowestToman = lastTier?.calculatedPriceToman || Math.round((item.costPerUnitUsd || 10) * (currencyRates?.usd || 95000) * 1.3);
                      const lowestUsd = lastTier?.priceUsd || item.costPerUnitUsd || 10;
                      const lowestCny = lastTier?.priceCny || Number((lowestUsd * 7.24).toFixed(1));
                      const lowestAed = lastTier?.priceAed || Number((lowestUsd * 3.67).toFixed(1));

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setActiveProductModal(item);
                            setOrderQuantity(item.moq);
                            setSelectedGalleryImage(item.mainImage);
                            setMiniAppView('detail');
                          }}
                          className={`rounded-2xl p-2 cursor-pointer transition flex flex-col justify-between border hover:scale-[1.02] active:scale-95 ${
                            isDarkMode
                              ? 'bg-[#202b36] border-[#293747] hover:border-[#5288c1]'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-800">
                              <img
                                src={item.mainImage}
                                alt={item.faTitle}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] text-amber-300 font-bold font-mono">
                                {item.trendScore}%
                              </div>
                            </div>

                            <h5 className="text-[11px] font-bold line-clamp-2 leading-tight">
                              {item.faTitle}
                            </h5>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-700/40 space-y-1.5">
                            <div>
                              <div className="text-[9px] opacity-70">قیمت عمده:</div>
                              {previewAsApproved ? (
                                <div className="text-[11px] font-bold text-emerald-400 font-mono">
                                  {displayCurrency === 'TOMAN'
                                    ? `${lowestToman.toLocaleString('en-US')} ت`
                                    : displayCurrency === 'USD'
                                    ? `$${lowestUsd.toFixed(2)}`
                                    : displayCurrency === 'CNY'
                                    ? `¥${lowestCny}`
                                    : `${lowestAed} AED`}
                                </div>
                              ) : (
                                <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>مخصوص همکار</span>
                                </div>
                              )}
                              <div className="text-[9px] opacity-60">حداقل: {item.moq} عدد</div>
                            </div>

                            <button className="w-full py-1 rounded-lg bg-[#5288c1]/20 hover:bg-[#5288c1]/30 text-[#5288c1] dark:text-sky-300 text-[10px] font-bold flex items-center justify-center gap-1">
                              <span>مشاهده و استعلام</span>
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Telegram WebApp Fixed MainButton at Bottom */}
            <div className={`p-3 border-t ${isDarkMode ? 'bg-[#17212b] border-[#232e3c]' : 'bg-white border-slate-200'}`}>
              {miniAppView === 'detail' ? (
                <button
                  onClick={handleSendInquiry}
                  className="nfs-btn-primary w-full py-3.5 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  {inquirySuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>استعلام با موفقیت ثبت شد و به پنل ادمین ارسال گردید!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {previewAsApproved
                          ? `ثبت استعلام رسمی تیراژ ${orderQuantity} عدد و صدور پیش‌فاکتور ⚡`
                          : 'ارسال درخواست احراز هویت همکار و قیمت عمده'}
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-between text-xs px-2 py-1 opacity-80">
                  <span className="text-[10px]">روی هر کالا بزنید تا صفحه اختصاصی مشخصات و استعلام باز شود</span>
                  <span className="font-bold text-[#FF4D6D] flex items-center gap-1 font-mono text-[10px]">
                    {filtered.length} کالا
                  </span>
                </div>
              )}
            </div>
          </div>
  );

  const renderAdminPinModal = () => {
    if (!isAdminPinModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-right">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">ورود به پنل مدیریت بازرگانی</h3>
            </div>
            <button
              onClick={() => setIsAdminPinModalOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            این بخش ویژه مدیریت بازرگانی نفیس‌استور است. لطفاً رمز عبور مدیریت را وارد کنید:
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const pin = adminPinInput.trim();
              if (pin === 'nfs2026' || pin === '1234' || pin === 'admin') {
                sessionStorage.setItem('nfs_admin_auth', 'true');
                setIsAdminPinModalOpen(false);
                if (onSwitchToAdmin) onSwitchToAdmin();
              } else {
                setAdminPinError('رمز عبور مدیریت اشتباه است. (رمز پیش‌فرض: nfs2026)');
              }
            }}
            className="space-y-3"
          >
            <div>
              <input
                type="password"
                autoFocus
                placeholder="رمز عبور مدیریت (پیش‌فرض: nfs2026)"
                value={adminPinInput}
                onChange={(e) => {
                  setAdminPinInput(e.target.value);
                  setAdminPinError('');
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-sm font-mono text-white tracking-widest focus:outline-none focus:border-amber-400"
              />
              {adminPinError && (
                <p className="text-[11px] text-rose-400 pt-1.5 text-center font-medium">
                  {adminPinError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md"
              >
                ورود به پنل ادمین
              </button>
              <button
                type="button"
                onClick={() => setIsAdminPinModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (isStandalone) {
    return (
      <div className="w-full min-h-screen bg-[#0e1621] flex flex-col items-center justify-start selection:bg-amber-500 selection:text-slate-900">
        {/* Desktop Header Bar (hidden on mobile and inside Telegram) */}
        <div className="w-full max-w-lg hidden md:flex items-center justify-between py-2.5 px-4 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300 z-30">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-white">مینی‌آپ تلگرام نفیس تجارت هوشمند</span>
          </div>
          {onSwitchToAdmin && (
            <button
              onClick={() => {
                if (sessionStorage.getItem('nfs_admin_auth') === 'true') {
                  onSwitchToAdmin();
                } else {
                  setIsAdminPinModalOpen(true);
                  setAdminPinInput('');
                  setAdminPinError('');
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold transition cursor-pointer text-[11px]"
              title="ورود به پنل شکار کالا، کاتالوگ و تنظیمات"
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>⚙️ پنل مدیریت بازرگانی</span>
            </button>
          )}
        </div>

        {renderScreenContent()}
        {renderAdminPinModal()}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Telegram Mini App Simulator in Phone Frame */}
      <div className="lg:col-span-7 flex flex-col items-center">
        {/* Quick Testing Bar for Approval Gatekeeping */}
        <div className="w-full max-w-[390px] mb-3 flex items-center justify-between p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            {previewAsApproved ? (
              <Unlock className="w-4 h-4 text-emerald-400" />
            ) : (
              <Lock className="w-4 h-4 text-amber-400" />
            )}
            <span>نمایش قیمت‌ها:</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setPreviewAsApproved(true)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                previewAsApproved
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              همکار تایید شده
            </button>
            <button
              onClick={() => setPreviewAsApproved(false)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                !previewAsApproved
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              مهمان (قیمت قفل)
            </button>
          </div>
        </div>

        <div className="telegram-phone-mockup relative w-full max-w-[390px] rounded-[44px] p-3.5 bg-slate-950 shadow-2xl border-4 border-slate-700/80 ring-1 ring-slate-800">
          {/* Dynamic Island / Speaker Notch */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800 mr-2"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-950"></div>
          </div>

          {renderScreenContent()}
        </div>
      </div>

      {/* Right Column: Implementation Guide & Live Currency Rates */}
      <div className="lg:col-span-5 space-y-6">
        {/* Live Currency Rates Board */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base">
                تابلو زنده نرخ ارزهای تجاری بازرگانی
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">ساعت: {currencyRates.lastUpdated}</span>
          </div>

          <p className="text-xs text-slate-400">
            نرخ‌های مرجع استعلام از سایت‌های رسمی (TGJU / AlanChand / Navasan / ArzDigital):
          </p>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50 space-y-1">
              <div className="text-[11px] text-slate-400">دلار آمریکا (USD)</div>
              <div className="text-sm font-extrabold text-amber-300 font-mono">
                {currencyRates.usd.toLocaleString('en-US')}
              </div>
              <div className="text-[10px] text-slate-500">تومان</div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50 space-y-1">
              <div className="text-[11px] text-slate-400">درهم امارات (AED)</div>
              <div className="text-sm font-extrabold text-sky-400 font-mono">
                {currencyRates.aed.toLocaleString('en-US')}
              </div>
              <div className="text-[10px] text-slate-500">واردات دبی</div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50 space-y-1">
              <div className="text-[11px] text-slate-400">یوان چین (CNY)</div>
              <div className="text-sm font-extrabold text-rose-400 font-mono">
                {currencyRates.cny.toLocaleString('en-US')}
              </div>
              <div className="text-[10px] text-slate-500">خرید 1688</div>
            </div>
          </div>
        </div>

        {/* Protection / B2B Wholesaler Shield Info */}
        <div className="nfs-info-card bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-800/40 rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>مکانیزم محافظت از قیمت‌های عمده (B2B Gatekeeping)</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            طبق نیاز اعلام شده، هیچ کاربری بدون تایید قبلی مدیریت به قیمت‌های عمده فروشی دسترسی ندارد.
            کاربران ناشناس تنها تصویر و ویژگی‌های فنی کالا را مشاهده می‌کنند و برای دیدن قیمت‌های پلکانی ملزم به ثبت نام و تایید در پنل ادمین هستند.
          </p>
        </div>
      </div>

      {/* Admin PIN Verification Modal */}
      {renderAdminPinModal()}
    </div>
  );
};
