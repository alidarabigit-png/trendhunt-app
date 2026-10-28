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
  ChevronDown,
} from 'lucide-react';
import { ProductItem, CustomerUser, CurrencyRates, MiniAppNotification, CustomerInquiry, MiniAppUi, DEFAULT_MINIAPP_UI } from '../types';
import { NfsLogo } from './NfsLogo';
import { RegistrationGate } from './RegistrationGate';
import { RateBar } from './RateBar';
import { brandKey, uniqueBrands, deduplicateProducts } from '../utils/catalogUtils';

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
  ui?: MiniAppUi | null;
}

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#F6F7F9"/><rect x="60" y="70" width="80" height="60" rx="8" fill="none" stroke="#E0707F" stroke-width="4"/><circle cx="82" cy="90" r="7" fill="#E0707F"/><path d="M66 124l24-22 16 14 12-10 18 18z" fill="#A91D2E"/></svg>');

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
  ui = null,
}) => {
  const [activeCategory, setActiveCategory] = useState('همه');
  const [activeBrand, setActiveBrand] = useState('همه');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSub, setActiveSub] = useState('همه');
  const isDarkMode = true;
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

  // همگام‌سازی وضعیت تایید با وضعیت واقعی مشتری (از سرور)
  React.useEffect(() => {
    setPreviewAsApproved(currentCustomer?.status === 'approved');
  }, [currentCustomer?.status]);

  // Admin PIN Protection states
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  const cleanProducts = React.useMemo(() => deduplicateProducts(products), [products]);

  const currentProduct = activeProductModal || selectedProduct || cleanProducts[0];

  const categories = ['همه', ...Array.from(new Set(cleanProducts.map((p) => p.category)))];

  const brands = uniqueBrands(cleanProducts);

  const subCats = activeCategory === 'همه' ? [] : Array.from(new Set(cleanProducts.filter((p) => p.category === activeCategory).map((p) => (p.subCategory || '').trim()).filter(Boolean)));

  const filtered = cleanProducts.filter(
    (p) =>
      (activeCategory === 'همه' || p.category === activeCategory) &&
      (activeBrand === 'همه' || brandKey(p.brand) === activeBrand) &&
      (activeSub === 'همه' || (p.subCategory || '').trim() === activeSub) &&
      (!searchTerm.trim() || [p.faTitle, p.originalTitle, p.modelOrSku, p.brand, p.subCategory, ...(p.tags || [])].join(' ').toLowerCase().includes(searchTerm.trim().toLowerCase()))
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

  const t = ui ?? DEFAULT_MINIAPP_UI;
  const themeVars = {
    '--mx-page': t.pageBg,
    '--mx-card': t.cardBg,
    '--mx-border': t.cardBorder,
    '--mx-text': t.textColor,
    '--mx-muted': t.mutedColor,
    '--mx-body': t.roles.body.color,
    '--mx-price': t.roles.price.color,
    '--mx-accent': t.accent,
    '--mx-btn': t.buttonBg,
    '--mx-btn-text': t.buttonText,
    '--mx-ok': t.accent,
    '--mx-radius': `${t.radius}px`,
    fontFamily: t.fontFamily === 'Vazirmatn' ? "'Vazirmatn', system-ui, sans-serif" : t.fontFamily,
    color: t.textColor,
    background: t.pageBg,
  } as React.CSSProperties;

  const renderScreenContent = () => (
    <div
      data-phone-dark={isDarkMode ? 'true' : 'false'}
      style={themeVars}
      className={`w-full ${
        isStandalone ? 'min-h-screen max-w-lg mx-auto shadow-2xl' : 'h-[760px] rounded-[34px]'
      } overflow-hidden flex flex-col relative transition-colors duration-200 select-none ${
        isDarkMode ? 'bg-[var(--mx-page)] text-[color:var(--mx-text)]' : 'bg-[#ffffff] text-[#0f172a]'
      }`}
    >
            {/* Telegram Header Bar */}
            <div
              className="mx-header px-3.5 pt-8 pb-3 border-b-[3px] border-[#A91D2E] flex items-center justify-between z-20 bg-[#0B0C0E] text-white"
            >
              {miniAppView === 'detail' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMiniAppView('catalog')}
                    className="flex items-center gap-1 text-xs font-bold text-[color:var(--mx-accent)] hover:opacity-80 transition cursor-pointer bg-[color-mix(in_srgb,var(--mx-text)_8%,transparent)] px-2 py-1 rounded-[calc(var(--mx-radius)*0.55)]"
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
                  {/* دکمه منو + لوگو */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsMiniAppDrawerOpen((v) => !v); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#A91D2E] hover:bg-[#871523] text-white text-xs font-bold transition cursor-pointer"
                    title="منو"
                  >
                    <span>منو</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMiniAppDrawerOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <NfsLogo size="sm" variant="dark" />
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {/* Notification Bell with Badge */}
                <button
                  onClick={() => setIsNotificationsModalOpen(true)}
                  className="relative p-1.5 rounded-[calc(var(--mx-radius)*0.55)] bg-[color-mix(in_srgb,var(--mx-text)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--mx-text)_12%,transparent)] text-[color:var(--mx-body)] hover:text-[color:var(--mx-text)] transition cursor-pointer"
                  title="اعلان‌ها و پاسخ‌های ادمین"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[var(--mx-accent)] text-[color:var(--mx-btn-text)] text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold font-mono animate-pulse shadow-sm shadow-[var(--mx-accent)]/50">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {previewAsApproved ? (
                  <span className="text-[9px] bg-[#E7F6EC] text-[#166534] border border-[#BBE5C8] px-2 py-0.5 rounded-full font-bold">
                    همکار تایید شده
                  </span>
                ) : (
                  <span className="text-[9px] bg-[var(--mx-accent)]/20 text-[color:var(--mx-accent)] border border-[color:var(--mx-accent)]/30 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
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
                className="absolute top-16 left-3 right-3 z-45 bg-[var(--mx-card)] border-2 border-[color:var(--mx-accent)] text-[color:var(--mx-text)] p-3 rounded-[var(--mx-radius)] shadow-2xl backdrop-blur-md cursor-pointer animate-bounce flex items-start gap-2.5"
              >
                <div className="w-8 h-8 rounded-[calc(var(--mx-radius)*0.75)] bg-[var(--mx-accent)] text-[color:var(--mx-btn-text)] flex items-center justify-center shrink-0 shadow-md shadow-black/30">
                  <BellRing className="w-4 h-4 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-[color:var(--mx-accent)]">
                      {activePushToast.title}
                    </span>
                    <span className="text-[9px] text-[color:var(--mx-muted)] font-mono">
                      {activePushToast.timestamp}
                    </span>
                  </div>
                  <p className="text-[10px] text-[color:var(--mx-body)] line-clamp-2 mt-0.5 leading-snug">
                    {activePushToast.message}
                  </p>
                  <div className="text-[9px] text-[color:var(--mx-price)] font-bold mt-1 flex items-center gap-1">
                    <span>مشاهده پیش‌فاکتور و گفتگو</span>
                    <ChevronLeft className="w-3 h-3" />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePushToast(null);
                  }}
                  className="p-1 text-[color:var(--mx-muted)] hover:text-[color:var(--mx-text)]"
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
                    isDarkMode ? 'bg-[var(--mx-page)] border-[color:var(--mx-border)] text-[color:var(--mx-text)]' : 'bg-[var(--mx-card)] border-[color:var(--mx-border)] text-[color:var(--mx-text)]'
                  }`}
                >
                  {/* Modal Header */}
                  <div className="p-3.5 border-b border-[color:var(--mx-border)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[calc(var(--mx-radius)*0.55)] bg-[var(--mx-accent)]/20 text-[color:var(--mx-accent)] flex items-center justify-center">
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
                          className="text-[10px] text-[color:var(--mx-accent)] hover:underline px-2 py-1"
                        >
                          بازگشت به لیست
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsNotificationsModalOpen(false);
                          setSelectedInquiryDetail(null);
                        }}
                        className="p-1 rounded-[calc(var(--mx-radius)*0.55)] hover:bg-[color-mix(in_srgb,var(--mx-text)_8%,transparent)]"
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
                        <div className="p-3 rounded-[var(--mx-radius)] bg-[color-mix(in_srgb,var(--mx-text)_10%,transparent)] border border-[color:var(--mx-border)] space-y-2">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={selectedInquiryDetail.productImage}
                              alt={selectedInquiryDetail.productTitle}
                              className="w-12 h-12 rounded-[calc(var(--mx-radius)*0.75)] object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <h5 className="font-bold text-xs truncate text-[color:var(--mx-text)]">{selectedInquiryDetail.productTitle}</h5>
                              <div className="text-[10px] text-[color:var(--mx-muted)]">تیراژ درخواستی: {selectedInquiryDetail.requestedQuantity} عدد</div>
                              <div className="text-[11px] font-bold text-[color:var(--mx-ok)] font-mono">
                                مبلغ کل: {selectedInquiryDetail.totalPriceToman.toLocaleString('en-US')} تومان
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[color:var(--mx-border)] flex items-center justify-between text-[10px]">
                            <span className="text-[color:var(--mx-muted)]">وضعیت پیش‌فاکتور:</span>
                            <span className="font-bold text-[color:var(--mx-price)]">
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
                              className={`p-3 rounded-[var(--mx-radius)] text-xs max-w-[85%] leading-relaxed shadow-sm ${
                                m.sender === 'admin'
                                  ? 'bg-[var(--mx-btn)] text-[color:var(--mx-text)] mr-auto'
                                  : 'bg-[var(--mx-card)] text-[color:var(--mx-text)] border border-[color:var(--mx-border)] ml-auto'
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
                            className="flex-1 bg-[color-mix(in_srgb,var(--mx-text)_12%,transparent)] border border-[color:var(--mx-border)] rounded-[calc(var(--mx-radius)*0.75)] px-3 py-2 text-xs text-[color:var(--mx-text)] focus:outline-none focus:border-[color:var(--mx-accent)]"
                          />
                          <button
                            onClick={() => {
                              if (customerChatReplyText.trim() && onCustomerSendMessage) {
                                onCustomerSendMessage(selectedInquiryDetail.id, customerChatReplyText);
                                setCustomerChatReplyText('');
                              }
                            }}
                            className="p-2 bg-[var(--mx-accent)] text-[color:var(--mx-btn-text)] rounded-[calc(var(--mx-radius)*0.75)]"
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
                            className="w-full py-2.5 rounded-[calc(var(--mx-radius)*0.75)] bg-[var(--mx-btn)] hover:brightness-110 text-[color:var(--mx-text)] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-black/30 transition cursor-pointer"
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
                          <div className="text-center py-8 text-[color:var(--mx-muted)] space-y-1">
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
                              className={`p-3 rounded-[var(--mx-radius)] border transition cursor-pointer flex items-start gap-2.5 ${
                                notif.read
                                  ? 'bg-[color-mix(in_srgb,var(--mx-text)_8%,transparent)] border-[color:var(--mx-border)] opacity-75'
                                  : 'bg-[var(--mx-accent)]/10 border-[color:var(--mx-accent)]/40 text-[color:var(--mx-text)]'
                              }`}
                            >
                              <div className="w-7 h-7 rounded-[calc(var(--mx-radius)*0.75)] bg-[var(--mx-accent)]/20 text-[color:var(--mx-accent)] flex items-center justify-center shrink-0">
                                <Bell className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs">{notif.title}</span>
                                  <span className="text-[10px] text-[color:var(--mx-muted)] font-mono">{notif.timestamp}</span>
                                </div>
                                <p className="text-[11px] text-[color:var(--mx-body)] line-clamp-2 mt-0.5">{notif.message}</p>
                                <span className="text-[10px] text-[color:var(--mx-accent)] font-semibold mt-1 inline-block">
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
            {/* منوی کشویی رو به پایین (Slide-Down Dropdown) */}
            {isMiniAppDrawerOpen && (
              <div onClick={() => setIsMiniAppDrawerOpen(false)} onTouchStart={() => setIsMiniAppDrawerOpen(false)} className="absolute inset-0 z-40 bg-black/20" />
            )}
            {isMiniAppDrawerOpen && (
            <aside
              onClick={(e) => e.stopPropagation()}
              className="absolute top-[68px] left-3 right-3 z-50 max-h-[72%] rounded-2xl bg-[var(--mx-card)] text-[color:var(--mx-text)] border border-[color:var(--mx-border)] shadow-lg flex flex-col animate-[slideDown_0.22s_ease-out]"
            >
              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 no-scrollbar text-xs">
                {/* Customer Account Summary Card */}
                <div className="p-3 rounded-[var(--mx-radius)] bg-[color-mix(in_srgb,var(--mx-text)_10%,transparent)] border border-[color:var(--mx-border)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[color:var(--mx-muted)]">حساب کاربری همکار:</span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                        previewAsApproved ? 'bg-[color-mix(in_srgb,var(--mx-ok)_20%,transparent)] text-[color:var(--mx-ok)]' : 'bg-[var(--mx-accent)]/20 text-[color:var(--mx-accent)]'
                      }`}
                    >
                      {previewAsApproved ? 'تایید شده (قیمت فعال)' : 'در انتظار تایید (قیمت قفل)'}
                    </span>
                  </div>
                  <div className="font-bold text-[color:var(--mx-text)] text-xs">{currentCustomer?.name || 'کاربر همکار'}</div>
                  <div className="text-[10px] text-[color:var(--mx-muted)] flex items-center justify-between pt-0.5">
                    <span>سطح: {currentCustomer?.tier || 'همکار برنزی'}</span>
                    <span className="font-mono text-[color:var(--mx-accent)]">@{currentCustomer?.telegramUsername || 'nafis'}</span>
                  </div>
                </div>

                {/* Admin Switcher for Store Owner (Protected by PIN) */}
                {onSwitchToAdmin && (
                  <button
                    onClick={() => {
                      setIsMiniAppDrawerOpen(false);
                      if ((sessionStorage.getItem('nfs_admin_auth') === 'true' && !!sessionStorage.getItem('nfs_admin_key'))) {
                        onSwitchToAdmin();
                      } else {
                        setIsAdminPinModalOpen(true);
                        setAdminPinInput('');
                        setAdminPinError('');
                      }
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-[calc(var(--mx-radius)*0.75)] bg-[color-mix(in_srgb,var(--mx-price)_15%,transparent)] hover:brightness-110 border border-[color:color-mix(in_srgb,var(--mx-price)_40%,transparent)] text-[color:var(--mx-price)] font-bold text-xs transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[color:var(--mx-price)]" />
                      <span>ورود به پنل مدیریت بازرگانی</span>
                    </div>
                    <span className="text-[10px] bg-[color-mix(in_srgb,var(--mx-price)_20%,transparent)] text-[color:var(--mx-price)] px-1.5 py-0.5 rounded font-mono">رمزدار</span>
                  </button>
                )}

                {/* Notifications & Inquiries Center in Drawer */}
                <button
                  onClick={() => {
                    setIsMiniAppDrawerOpen(false);
                    setIsNotificationsModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-[calc(var(--mx-radius)*0.75)] bg-[var(--mx-card)] hover:brightness-110 border border-[color:var(--mx-border)] text-[color:var(--mx-text)] font-bold text-xs transition cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-[color:var(--mx-accent)]" />
                    <span>مرکز اعلان‌ها و استعلام‌های من</span>
                  </div>
                  {unreadCount > 0 ? (
                    <span className="bg-[var(--mx-btn)] text-[color:var(--mx-text)] text-[10px] px-2 py-0.5 rounded-full font-bold font-mono animate-pulse">
                      {unreadCount} جدید
                    </span>
                  ) : (
                    <span className="text-[10px] text-[color:var(--mx-muted)] font-normal">مشاهده</span>
                  )}
                </button>

                {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                  <button
                    onClick={() => {
                      Notification.requestPermission();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 p-2 rounded-[calc(var(--mx-radius)*0.75)] bg-[var(--mx-card)] hover:brightness-110 text-[color:var(--mx-body)] text-[10px] border border-[color:var(--mx-border)] transition cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 text-[color:var(--mx-price)]" />
                    <span>فعال‌سازی پوش‌نوتیفیکیشن مرورگر</span>
                  </button>
                )}

                {/* Currency Switcher in Drawer */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[color:var(--mx-body)] block">واحد پول نمایشی قیمت‌ها:</label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[color-mix(in_srgb,var(--mx-text)_10%,transparent)] rounded-[calc(var(--mx-radius)*0.75)] border border-[color:var(--mx-border)] text-center font-mono text-[10px]">
                    <button
                      onClick={() => setDisplayCurrency('TOMAN')}
                      className={`py-1 rounded-[calc(var(--mx-radius)*0.55)] transition font-sans cursor-pointer ${displayCurrency === 'TOMAN' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-text)] font-bold' : 'text-[color:var(--mx-muted)]'}`}
                    >
                      تومان
                    </button>
                    <button
                      onClick={() => setDisplayCurrency('USD')}
                      className={`py-1 rounded-[calc(var(--mx-radius)*0.55)] transition cursor-pointer ${displayCurrency === 'USD' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-text)] font-bold' : 'text-[color:var(--mx-muted)]'}`}
                    >
                      $ USD
                    </button>
                    <button
                      onClick={() => setDisplayCurrency('CNY')}
                      className={`py-1 rounded-[calc(var(--mx-radius)*0.55)] transition cursor-pointer ${displayCurrency === 'CNY' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-text)] font-bold' : 'text-[color:var(--mx-muted)]'}`}
                    >
                      ¥ CNY
                    </button>
                    <button
                      onClick={() => setDisplayCurrency('AED')}
                      className={`py-1 rounded-[calc(var(--mx-radius)*0.55)] transition cursor-pointer ${displayCurrency === 'AED' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-text)] font-bold' : 'text-[color:var(--mx-muted)]'}`}
                    >
                      AED
                    </button>
                  </div>
                </div>

                {/* Categories Navigation in Drawer */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-[color:var(--mx-muted)] px-1 pb-1">دسته‌بندی‌های کالای عمده:</div>
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
                        className={`w-full flex items-center justify-between p-2.5 rounded-[calc(var(--mx-radius)*0.75)] text-xs font-semibold transition cursor-pointer ${
                          isCatActive
                            ? 'bg-[var(--mx-btn)] text-[color:var(--mx-text)] border border-[color:var(--mx-accent)] font-bold shadow-md shadow-black/30'
                            : 'text-[color:var(--mx-body)] hover:bg-[color-mix(in_srgb,var(--mx-text)_6%,transparent)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Package className={`w-3.5 h-3.5 ${isCatActive ? 'text-[color:var(--mx-text)]' : 'text-[color:var(--mx-accent)]'}`} />
                          <span>{cat}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono ${isCatActive ? 'text-[color:var(--mx-text)] font-bold' : 'opacity-60'}`}>({catCount})</span>
                          <ChevronLeft className={`w-3.5 h-3.5 ${isCatActive ? 'text-[color:var(--mx-text)]' : 'text-[color:var(--mx-muted)]'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* External links */}
                <div className="pt-2 border-t border-[color:var(--mx-border)] space-y-1.5">
                  <a
                    href="https://t.me/NafisSmartTrade"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-2 rounded-[calc(var(--mx-radius)*0.75)] text-xs text-[color:var(--mx-body)] hover:bg-[color-mix(in_srgb,var(--mx-text)_6%,transparent)] transition"
                  >
                    <div className="flex items-center gap-2">
                      <Send className="w-3.5 h-3.5 text-[color:var(--mx-accent)]" />
                      <span>کانال رسمی تلگرام (@NafisSmartTrade)</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-[color:var(--mx-muted)]" />
                  </a>

                  <a
                    href="https://t.me/nafistejarat_bot"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-2 rounded-[calc(var(--mx-radius)*0.75)] text-xs text-[color:var(--mx-body)] hover:bg-[color-mix(in_srgb,var(--mx-text)_6%,transparent)] transition"
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5 text-[color:var(--mx-accent)]" />
                      <span>ربات هوشمند استعلام (@nafistejarat_bot)</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-[color:var(--mx-muted)]" />
                  </a>

                  <a
                    href="https://nafisstore.com"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-2 rounded-[calc(var(--mx-radius)*0.75)] text-xs text-[color:var(--mx-body)] hover:bg-[color-mix(in_srgb,var(--mx-text)_6%,transparent)] transition"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-[color:var(--mx-ok)]" />
                      <span>وب‌سایت نفیس‌استور (nafisstore.com)</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-[color:var(--mx-muted)]" />
                  </a>

                  <div className="p-2.5 rounded-[calc(var(--mx-radius)*0.75)] bg-[var(--mx-accent)]/10 border border-[color:var(--mx-accent)]/20 text-[10px] text-[color:var(--mx-body)] space-y-1">
                    <div className="font-bold text-[color:var(--mx-accent)] flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>پشتیبانی سفارشات شرکت:</span>
                    </div>
                    <p className="text-[color:var(--mx-muted)]">شرکت نفیس تجارت هوشمند (NFS) • تامین کانتینری و حواله ارزی مستقیم</p>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-3 border-t border-[color:var(--mx-border)] text-center text-[10px] text-[color:var(--mx-muted)]">
                <span>NFS Telegram MiniApp v2.4</span>
              </div>
            </aside>
            )}

            {/* Telegram Mini App Internal Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
              {miniAppView === 'detail' && currentProduct ? (
                /* Dedicated Full Product Detail Page inside Mini App */
                <div key={currentProduct.id} className="space-y-3 pb-2 mx-page-in">
                  {/* Large Image Gallery & Switcher */}
                  <div className="space-y-2">
                    <div className="relative aspect-square w-full rounded-[var(--mx-radius)] overflow-hidden bg-[var(--mx-card)] border border-[color:var(--mx-border)] shadow-md">
                      <img
                        src={selectedGalleryImage || currentProduct.mainImage || PLACEHOLDER_IMG}
                        alt={currentProduct.faTitle}
                        key={selectedGalleryImage || currentProduct.mainImage}
                        className="w-full h-full object-cover mx-img-in"
                      />
                      <div className="absolute top-2 right-2 bg-[#0F1115]/85 px-2 py-0.5 rounded-[calc(var(--mx-radius)*0.55)] text-[10px] text-white font-bold font-mono">
                        ترند {currentProduct.trendScore}%
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-[calc(var(--mx-radius)*0.55)] text-[9px] text-[color:var(--mx-body)]">
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
                            className={`w-12 h-12 rounded-[calc(var(--mx-radius)*0.75)] overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                              (selectedGalleryImage || currentProduct.mainImage) === imgUrl
                                ? 'border-[color:var(--mx-accent)] scale-105'
                                : 'border-[color:var(--mx-border)] opacity-70 hover:opacity-100'
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
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#0F1115] text-white">
                        {currentProduct.category}
                      </span>
                      {currentProduct.brand && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-[#0F1115] border border-[#E3E6EC]">
                          {currentProduct.brand}
                        </span>
                      )}
                      {currentProduct.supplier?.platform && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-[#6B7280] border border-[#E3E6EC] font-mono">
                          {currentProduct.supplier.platform}
                        </span>
                      )}
                      {currentProduct.supplier.hasTradeAssurance && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--mx-ok)_20%,transparent)] text-[color:var(--mx-ok)] border border-[color:color-mix(in_srgb,var(--mx-ok)_30%,transparent)] flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          ضمانت تجاری
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-extrabold leading-snug" style={{ fontSize: t.roles.heading.size, fontWeight: t.roles.heading.weight, color: t.roles.heading.color, lineHeight: t.roles.heading.lineHeight }}>
                      {currentProduct.faTitle}
                    </h3>

                    <p className="text-[10px] opacity-60 font-mono line-clamp-1" dir="ltr">
                      {currentProduct.originalTitle}
                    </p>
                  </div>

                  {/* Wholesale Tiered Pricing Card */}
                  <div
                    className={`rounded-[var(--mx-radius)] p-3 border space-y-2.5 ${
                      isDarkMode ? 'bg-[var(--mx-card)] border-[color:var(--mx-border)]' : 'bg-[var(--mx-card)] border-[color:var(--mx-border)]'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-[color:var(--mx-border)]">
                      <span className="text-[11px] font-bold flex items-center gap-1 text-[color:var(--mx-ok)]">
                        <Layers className="w-3.5 h-3.5" />
                        جدول قیمت‌های پلکانی عمده
                      </span>
                      {/* Currency Switcher */}
                      <div className="flex items-center gap-1 text-[9px] bg-[color-mix(in_srgb,var(--mx-text)_10%,transparent)] p-0.5 rounded-[calc(var(--mx-radius)*0.55)] border border-[color:var(--mx-border)]">
                        <button
                          onClick={() => setDisplayCurrency('TOMAN')}
                          className={`px-1.5 py-0.5 rounded ${displayCurrency === 'TOMAN' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] font-bold' : 'opacity-70'}`}
                        >
                          تومان
                        </button>
                        <button
                          onClick={() => setDisplayCurrency('USD')}
                          className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'USD' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] font-bold' : 'opacity-70'}`}
                        >
                          $
                        </button>
                        <button
                          onClick={() => setDisplayCurrency('CNY')}
                          className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'CNY' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] font-bold' : 'opacity-70'}`}
                        >
                          ¥
                        </button>
                      </div>
                    </div>

                    {previewAsApproved ? (
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {currentProduct.tieredPricing.map((tier, idx) => (
                          <div
                            key={`${idx}-${orderQuantity >= tier.minQuantity && (!tier.maxQuantity || orderQuantity <= tier.maxQuantity)}`}
                            className={`p-2 rounded-[calc(var(--mx-radius)*0.75)] border text-[10px] space-y-0.5 transition ${orderQuantity >= tier.minQuantity && (!tier.maxQuantity || orderQuantity <= tier.maxQuantity) ? 'mx-pop' : ''} 
                              orderQuantity >= tier.minQuantity && (!tier.maxQuantity || orderQuantity <= tier.maxQuantity)
                                ? 'bg-[#A91D2E] border-[#A91D2E] font-bold text-white'
                                : 'bg-white border-[#E3E6EC] text-[#0F1115]'
                            }`}
                          >
                            <div className="opacity-70 text-[9px]">
                              {tier.maxQuantity ? `${tier.minQuantity}-${tier.maxQuantity} عدد` : `+${tier.minQuantity} عدد`}
                            </div>
                            <div className="font-extrabold text-[11px] font-mono">
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
                      <div className="p-2.5 rounded-[calc(var(--mx-radius)*0.75)] bg-[color-mix(in_srgb,var(--mx-price)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--mx-price)_30%,transparent)] text-center space-y-1">
                        <div className="text-xs font-bold text-[color:var(--mx-price)] flex items-center justify-center gap-1">
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
                    className={`rounded-[var(--mx-radius)] p-3 border space-y-2.5 ${
                      isDarkMode ? 'bg-[var(--mx-card)] border-[color:var(--mx-border)]' : 'bg-[var(--mx-card)] border-[color:var(--mx-border)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[color:var(--mx-price)] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>محاسبه‌گر تیراژ سفارش</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOrderQuantity(Math.max(currentProduct.moq, orderQuantity - 10))}
                          className="w-6 h-6 rounded-[calc(var(--mx-radius)*0.55)] bg-[color-mix(in_srgb,var(--mx-text)_12%,transparent)] hover:bg-black/60 flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--mx-text)_10%,transparent)] text-[color:var(--mx-price)]">
                          {orderQuantity} عدد
                        </span>
                        <button
                          onClick={() => setOrderQuantity(orderQuantity + 10)}
                          className="w-6 h-6 rounded-[calc(var(--mx-radius)*0.55)] bg-[color-mix(in_srgb,var(--mx-text)_12%,transparent)] hover:bg-black/60 flex items-center justify-center text-xs font-bold cursor-pointer"
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
                      className="w-full accent-[var(--mx-accent)] cursor-pointer"
                    />

                    {/* Live Calculated Price Summary */}
                    {currentPricing && previewAsApproved && (
                      <div className="p-2.5 rounded-[calc(var(--mx-radius)*0.75)] bg-[color-mix(in_srgb,var(--mx-text)_10%,transparent)] border border-[color:var(--mx-border)] flex items-center justify-between text-xs">
                        <div>
                          <div className="text-[9px] opacity-70">قیمت واحد در این تیراژ:</div>
                          <div className="font-bold text-[color:var(--mx-ok)] font-mono">
                            {displayCurrency === 'TOMAN'
                              ? `${currentPricing.unitToman.toLocaleString('en-US')} تومان`
                              : displayCurrency === 'USD'
                              ? `$${currentPricing.unitUsd.toFixed(2)}`
                              : `¥${currentPricing.unitCny}`}
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="text-[9px] opacity-70">مبلغ کل پیش‌فاکتور:</div>
                          <div className="font-extrabold text-[color:var(--mx-price)] font-mono text-sm">
                            {(currentPricing.totalToman / 1000000).toFixed(2)} M تومان
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Customer Inquiry Memo / Special Request */}
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] opacity-80 flex items-center gap-1 font-semibold">
                        <MessageSquare className="w-3 h-3 text-[color:var(--mx-accent)]" />
                        <span>توضیحات و نیازمندی‌های این سفارش (اختیاری):</span>
                      </label>
                      <textarea
                        rows={2}
                        value={customerInquiryNotes}
                        onChange={(e) => setCustomerInquiryNotes(e.target.value)}
                        placeholder="مثال: درخواست رنگ‌بندی خاص، نمونه تستی، ترخیص در گمرک غرب تهران..."
                        className="w-full bg-[color-mix(in_srgb,var(--mx-text)_10%,transparent)] border border-[color:var(--mx-border)] rounded-[calc(var(--mx-radius)*0.75)] p-2 text-[11px] focus:outline-none focus:border-[color:var(--mx-accent)] placeholder:opacity-40 resize-none"
                      />
                    </div>
                  </div>

                  {/* Technical Specifications Table */}
                  {currentProduct.technicalSpecs && (
                    <div
                      className={`rounded-[var(--mx-radius)] p-3 border space-y-2 ${
                        isDarkMode ? 'bg-[var(--mx-card)] border-[color:var(--mx-border)]' : 'bg-[var(--mx-card)] border-[color:var(--mx-border)]'
                      }`}
                    >
                      <div className="text-[11px] font-bold flex items-center gap-1.5 opacity-90 pb-1 border-b border-[color:var(--mx-border)]">
                        <Info className="w-3.5 h-3.5 text-[color:var(--mx-accent)]" />
                        <span>مشخصات فنی و استانداردهای کالا:</span>
                      </div>
                      <div className="text-[10px] rounded-xl overflow-hidden border border-[color:var(--mx-border)]">
                        {Object.entries(currentProduct.technicalSpecs).map(([key, val], idx) => (
                          <div key={idx} className={`px-2 py-1.5 flex items-center justify-between ${idx % 2 === 0 ? 'bg-[#F6F7F9]' : 'bg-white'}`}>
                            <span className="opacity-70">{key}:</span>
                            <span className="font-semibold text-right max-w-[60%]">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Features & Full Description */}
                  <div
                    className={`rounded-[var(--mx-radius)] p-3 border space-y-2 ${
                      isDarkMode ? 'bg-[var(--mx-card)] border-[color:var(--mx-border)]' : 'bg-[var(--mx-card)] border-[color:var(--mx-border)]'
                    }`}
                  >
                    <div className="text-[11px] font-bold flex items-center gap-1.5 opacity-90 pb-1 border-b border-[color:var(--mx-border)]">
                      <FileText className="w-3.5 h-3.5 text-[color:var(--mx-price)]" />
                      <span>ویژگی‌های کلیدی و توضیحات جامع:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5" style={{ fontSize: t.roles.small.size, fontWeight: t.roles.small.weight, color: t.roles.small.color, lineHeight: t.roles.small.lineHeight }}>
                      {currentProduct.faFeatures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                    <p className="pt-2 border-t border-[color:var(--mx-border)] text-justify-fa" style={{ fontSize: t.roles.body.size, fontWeight: t.roles.body.weight, color: t.roles.body.color, lineHeight: t.roles.body.lineHeight, whiteSpace: 'pre-line' }}>
                      {currentProduct.faFullDesc}
                    </p>
                  </div>
                </div>
              ) : (
                /* Catalog Feed Grid View */
                <div className="space-y-3 mx-page-back">
                  {/* Gatekeeping: فرم احراز هویت تا تایید ادمین */}
                  {!previewAsApproved && <RegistrationGate />}

                  <RateBar rates={currencyRates} />

                  {/* User Greeting & Search inside Mini App */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold">کالاهای جدید عمده‌فروشی</h4>
                        <p className={`text-[10px] ${isDarkMode ? 'text-[color:var(--mx-muted)]' : 'text-[color:var(--mx-muted)]'}`}>
                          برای مشاهده مشخصات کامل و ثبت استعلام روی هر کالا بزنید
                        </p>
                      </div>

                      {/* Currency Switcher */}
                      {previewAsApproved && (
                        <div className="flex items-center gap-1 text-[9px] bg-[color-mix(in_srgb,var(--mx-card)_80%,transparent)] p-0.5 rounded-[calc(var(--mx-radius)*0.55)] border border-[color:var(--mx-border)]">
                          <button
                            onClick={() => setDisplayCurrency('TOMAN')}
                            className={`px-1.5 py-0.5 rounded ${displayCurrency === 'TOMAN' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] font-bold' : 'opacity-70'}`}
                          >
                            تومان
                          </button>
                          <button
                            onClick={() => setDisplayCurrency('USD')}
                            className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'USD' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] font-bold' : 'opacity-70'}`}
                          >
                            $
                          </button>
                          <button
                            onClick={() => setDisplayCurrency('CNY')}
                            className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'CNY' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] font-bold' : 'opacity-70'}`}
                          >
                            ¥
                          </button>
                          <button
                            onClick={() => setDisplayCurrency('AED')}
                            className={`px-1 py-0.5 rounded font-mono ${displayCurrency === 'AED' ? 'bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] font-bold' : 'opacity-70'}`}
                          >
                            درهم
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                      <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="جستجوی نام، مدل یا کد کالا…"
                        className="w-full bg-[var(--mx-card)] border border-[color:var(--mx-border)] rounded-xl pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-[#A91D2E] transition"
                      />
                    </div>
                    {/* منوی کشویی دسته‌بندی */}
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsCategoryOpen((v) => !v); }}
                        className="w-full flex items-center justify-between gap-2 bg-[var(--mx-card)] border border-[color:var(--mx-border)] rounded-xl px-3 py-2 text-xs font-bold cursor-pointer shadow-xs"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Package className="w-3.5 h-3.5 text-[color:var(--mx-accent)]" />
                          <span className="truncate">{activeCategory === 'همه' ? 'همه دسته‌بندی‌ها' : activeCategory}</span>
                        </span>
                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isCategoryOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setIsCategoryOpen(false)} onTouchStart={() => setIsCategoryOpen(false)} />
                          <div className="absolute z-40 top-full mt-1 left-0 right-0 max-h-64 overflow-y-auto no-scrollbar bg-[var(--mx-card)] border border-[color:var(--mx-border)] rounded-2xl shadow-lg p-1 animate-[slideDown_0.2s_ease-out]">
                            {categories.map((cat) => {
                              const cnt = cat === 'همه' ? cleanProducts.length : cleanProducts.filter((p) => p.category === cat).length;
                              const on = activeCategory === cat;
                              return (
                                <button
                                  key={cat}
                                  onClick={() => { setActiveCategory(cat); setActiveBrand('همه'); setActiveSub('همه'); setIsCategoryOpen(false); }}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[11px] cursor-pointer transition ${on ? 'bg-[#A91D2E] text-white font-bold' : 'hover:bg-[#F6F7F9]'}`}
                                >
                                  <span>{cat === 'همه' ? 'همه دسته‌بندی‌ها' : cat}</span>
                                  <span className={`font-mono text-[10px] ${on ? 'text-white' : 'text-[#6B7280]'}`}>{cnt}</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    {subCats.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 items-center">
                        {['همه', ...subCats].map((sc) => (
                          <button
                            key={sc}
                            onClick={() => setActiveSub(sc)}
                            className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer border ${activeSub === sc ? 'bg-[#0F1115] text-white border-[#0F1115] font-bold' : 'bg-white text-[#0F1115] border-[#E3E6EC]'}`}
                          >
                            {sc === 'همه' ? 'همه زیردسته‌ها' : sc}
                          </button>
                        ))}
                      </div>
                    )}
                    {brands.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 items-center">
                        <span className="text-[10px] text-[color:var(--mx-muted)] shrink-0">برند:</span>
                        {[{ key: 'همه', label: 'همه' }, ...brands].map((bo) => { const b = bo.key; return (
                          <button
                            key={b}
                            onClick={() => { setActiveBrand(b); setActiveCategory('همه'); setActiveSub('همه'); setIsCategoryOpen(false); }}
                            className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer border ${
                              activeBrand === b
                                ? 'bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] border-[color:var(--mx-btn)] font-bold'
                                : 'bg-transparent text-[color:var(--mx-body)] border-[color:var(--mx-border)]'
                            }`}
                          >
                            {bo.label}
                          </button>
                        ); })}
                      </div>
                    )}
                  </div>

                  {/* Products Feed inside Mini App */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {filtered.map((item, cardIdx) => {
                      const tiers = item.tieredPricing || [];
                      const lastTier = tiers.length > 0 ? tiers[tiers.length - 1] : null;
                      const lowestToman = lastTier?.calculatedPriceToman || Math.round((item.costPerUnitUsd || 10) * (currencyRates?.usd || 95000) * 1.3);
                      const lowestUsd = lastTier?.priceUsd || item.costPerUnitUsd || 10;
                      const lowestCny = lastTier?.priceCny || Number((lowestUsd * 7.24).toFixed(1));
                      const lowestAed = lastTier?.priceAed || Number((lowestUsd * 3.67).toFixed(1));

                      return (
                        <div
                          key={item.id}
                          style={{ animationDelay: `${Math.min(cardIdx, 12) * 45}ms` }}
                          onClick={() => {
                            setActiveProductModal(item);
                            setOrderQuantity(item.moq);
                            setSelectedGalleryImage(item.mainImage);
                            setMiniAppView('detail');
                          }}
                          className={`mx-card-in rounded-[var(--mx-radius)] p-2 cursor-pointer transition flex flex-col justify-between border active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-md shadow-xs ${
                            isDarkMode
                              ? 'bg-[var(--mx-card)] border-[color:var(--mx-border)] hover:border-[color:var(--mx-btn)]'
                              : 'bg-[var(--mx-card)] border-[color:var(--mx-border)] hover:border-[color:var(--mx-accent)]'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-[#EEF1F5]">
                              <img
                                src={item.mainImage || PLACEHOLDER_IMG}
                                alt={item.faTitle}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                              {item.isPostedToTelegram && (
                                <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-[#A91D2E] text-white rounded-full px-1.5 py-0.5 text-[8px] font-bold"><Send className="w-2.5 h-2.5" />تلگرام</div>
                              )}
                              <div className="absolute top-1 right-1 bg-[#0F1115]/85 px-1.5 py-0.5 rounded text-[9px] text-white font-bold font-mono">
                                {item.trendScore}%
                              </div>
                            </div>

                            <h5 className="text-[11px] font-bold line-clamp-2 leading-tight">
                              {item.faTitle}
                            </h5>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-[color:var(--mx-border)] space-y-1.5">
                            <div>
                              <div className="text-[9px] opacity-70">قیمت عمده:</div>
                              {previewAsApproved ? (
                                <div>
                                  <div className="text-[13px] font-black text-[#A91D2E] font-mono">
                                    {displayCurrency === 'TOMAN'
                                      ? `${lowestToman.toLocaleString('en-US')} ت`
                                      : displayCurrency === 'USD'
                                      ? `$${lowestUsd.toFixed(2)}`
                                      : displayCurrency === 'CNY'
                                      ? `¥${lowestCny}`
                                      : `${lowestAed} AED`}
                                  </div>
                                  <div className="text-[9px] text-[#6B7280] font-mono">${lowestUsd.toFixed(2)} · {lowestAed} AED</div>
                                </div>
                              ) : (
                                <div className="text-[10px] font-bold text-[#A91D2E] flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>قیمت قفل‌شده · مخصوص همکار</span>
                                </div>
                              )}
                              <div className="text-[9px] text-[#6B7280]">حداقل سفارش: {item.moq} عدد{item.brand ? ` · ${item.brand}` : ''}</div>
                            </div>

                            <button className="w-full py-1.5 rounded-xl bg-[#A91D2E] hover:bg-[#871523] text-white text-[10px] font-bold flex items-center justify-center gap-1 transition">
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
            <div key={miniAppView} className={`${miniAppView === 'detail' ? 'mx-bar-up' : ''} p-3 border-t ${isDarkMode ? 'bg-[var(--mx-page)] border-[color:var(--mx-border)]' : 'bg-[var(--mx-card)] border-[color:var(--mx-border)]'}`}>
              {miniAppView === 'detail' ? (
                <div className="flex items-center gap-3">
                  {previewAsApproved && currentPricing && (
                    <div className="shrink-0 text-right leading-tight">
                      <div className="text-[9px] text-[#6B7280]">قیمت واحد · {orderQuantity} عدد</div>
                      <div className="text-sm font-black text-[#A91D2E] font-mono">
                        {displayCurrency === 'TOMAN' ? `${currentPricing.unitToman.toLocaleString('en-US')} ت` : displayCurrency === 'USD' ? `$${currentPricing.unitUsd.toFixed(2)}` : displayCurrency === 'CNY' ? `¥${currentPricing.unitCny}` : `${currentPricing.unitAed} AED`}
                      </div>
                    </div>
                  )}
                <button
                  onClick={handleSendInquiry}
                  className="nfs-btn-primary flex-1 py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  {inquirySuccess ? (
                    <>
                      <Check className="w-4 h-4 text-[color:var(--mx-ok)]" />
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
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs px-2 py-1 opacity-80">
                  <span className="text-[10px]">روی هر کالا بزنید تا صفحه اختصاصی مشخصات و استعلام باز شود</span>
                  <span className="font-bold text-[color:var(--mx-accent)] flex items-center gap-1 font-mono text-[10px]">
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
        <div className="bg-[var(--mx-card)] border border-[color:color-mix(in_srgb,var(--mx-price)_40%,transparent)] rounded-[var(--mx-radius)] max-w-sm w-full p-5 shadow-2xl space-y-4 text-right">
          <div className="flex items-center justify-between pb-2 border-b border-[color:var(--mx-border)]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[calc(var(--mx-radius)*0.55)] bg-[color-mix(in_srgb,var(--mx-price)_20%,transparent)] text-[color:var(--mx-price)] flex items-center justify-center font-bold">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[color:var(--mx-text)]">ورود به پنل مدیریت بازرگانی</h3>
            </div>
            <button
              onClick={() => setIsAdminPinModalOpen(false)}
              className="p-1 rounded-[calc(var(--mx-radius)*0.55)] text-[color:var(--mx-muted)] hover:text-[color:var(--mx-text)] hover:brightness-110"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[color:var(--mx-muted)] leading-relaxed">
            این بخش ویژه مدیریت بازرگانی نفیس‌استور است. برای ورود، فقط کلید ادمین را یک بار وارد کنید:
          </p>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const key = adminPinInput.trim();
              if (!key) return;
              setAdminPinError('در حال بررسی…');
              try {
                const res = await fetch('/api.php?action=get_products_admin', { headers: { 'X-Admin-Key': key } });
                if (!res.ok) {
                  setAdminPinError('کلید ادمین اشتباه است.');
                  return;
                }
              } catch {
                setAdminPinError('ارتباط با سرور برقرار نشد.');
                return;
              }
              try {
                sessionStorage.setItem('nfs_admin_key', key);
                sessionStorage.setItem('nfs_admin_auth', 'true');
              } catch { /* ignore */ }
              setAdminPinError('');
              setIsAdminPinModalOpen(false);
              if (onSwitchToAdmin) onSwitchToAdmin();
            }}
            className="space-y-3"
          >
            <div>
              <input
                type="password"
                autoFocus
                placeholder="کلید ادمین"
                value={adminPinInput}
                onChange={(e) => {
                  setAdminPinInput(e.target.value);
                  setAdminPinError('');
                }}
                className="w-full bg-[var(--mx-page)] border border-[color:var(--mx-border)] rounded-[calc(var(--mx-radius)*0.75)] px-3 py-2.5 text-center text-sm font-mono text-[color:var(--mx-text)] tracking-widest focus:outline-none focus:border-[color:var(--mx-price)]"
              />
              {adminPinError && (
                <p className="text-[11px] text-[color:var(--mx-accent)] pt-1.5 text-center font-medium">
                  {adminPinError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-2 rounded-[calc(var(--mx-radius)*0.75)] bg-[var(--mx-btn)] hover:brightness-110 text-[color:var(--mx-btn-text)] font-bold text-xs transition cursor-pointer shadow-md"
              >
                ورود به پنل ادمین
              </button>
              <button
                type="button"
                onClick={() => setIsAdminPinModalOpen(false)}
                className="px-4 py-2 rounded-[calc(var(--mx-radius)*0.75)] bg-[var(--mx-card)] hover:brightness-110 text-[color:var(--mx-body)] text-xs transition cursor-pointer"
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
      <div style={themeVars} className="w-full min-h-screen bg-[var(--mx-page)] flex flex-col items-center justify-start selection:bg-[var(--mx-btn)] selection:text-[color:var(--mx-btn-text)]">
        {/* Desktop Header Bar (hidden on mobile and inside Telegram) */}
        <div className="w-full max-w-lg hidden md:flex items-center justify-between py-2.5 px-4 bg-[color-mix(in_srgb,var(--mx-card)_90%,transparent)] border-b border-[color:var(--mx-border)] text-xs text-[color:var(--mx-body)] z-30">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--mx-btn)] animate-pulse"></span>
            <span className="font-bold text-[color:var(--mx-text)]">مینی‌آپ تلگرام نفیس تجارت هوشمند</span>
          </div>
          {onSwitchToAdmin && (
            <button
              onClick={() => {
                if ((sessionStorage.getItem('nfs_admin_auth') === 'true' && !!sessionStorage.getItem('nfs_admin_key'))) {
                  onSwitchToAdmin();
                } else {
                  setIsAdminPinModalOpen(true);
                  setAdminPinInput('');
                  setAdminPinError('');
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[calc(var(--mx-radius)*0.55)] bg-[color-mix(in_srgb,var(--mx-price)_20%,transparent)] hover:brightness-110 text-[color:var(--mx-price)] border border-[color:color-mix(in_srgb,var(--mx-price)_30%,transparent)] font-semibold transition cursor-pointer text-[11px]"
              title="ورود به پنل شکار کالا، کاتالوگ و تنظیمات"
            >
              <Lock className="w-3 h-3 text-[color:var(--mx-price)]" />
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
        <div className="w-full max-w-[390px] mb-3 flex items-center justify-between p-2.5 rounded-[var(--mx-radius)] bg-[var(--mx-card)] border border-[color:var(--mx-border)] text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[color:var(--mx-body)]">
            {previewAsApproved ? (
              <Unlock className="w-4 h-4 text-[color:var(--mx-ok)]" />
            ) : (
              <Lock className="w-4 h-4 text-[color:var(--mx-price)]" />
            )}
            <span>نمایش قیمت‌ها:</span>
          </div>

          <div className="flex items-center gap-1 bg-[var(--mx-page)] p-1 rounded-[calc(var(--mx-radius)*0.75)] border border-[color:var(--mx-border)]">
            <button
              onClick={() => setPreviewAsApproved(true)}
              className={`px-2.5 py-1 rounded-[calc(var(--mx-radius)*0.55)] font-bold text-[11px] transition ${
                previewAsApproved
                  ? 'bg-[var(--mx-btn)] text-[color:var(--mx-text)] shadow-sm'
                  : 'text-[color:var(--mx-muted)] hover:text-[color:var(--mx-text)]'
              }`}
            >
              همکار تایید شده
            </button>
            <button
              onClick={() => setPreviewAsApproved(false)}
              className={`px-2.5 py-1 rounded-[calc(var(--mx-radius)*0.55)] font-bold text-[11px] transition ${
                !previewAsApproved
                  ? 'bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] shadow-sm'
                  : 'text-[color:var(--mx-muted)] hover:text-[color:var(--mx-text)]'
              }`}
            >
              مهمان (قیمت قفل)
            </button>
          </div>
        </div>

        <div className="telegram-phone-mockup relative w-full max-w-[390px] rounded-[44px] p-3.5 bg-[var(--mx-page)] shadow-2xl border-4 border-[color:var(--mx-border)] ring-1 ring-[color:var(--mx-border)]">
          {/* Dynamic Island / Speaker Notch */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--mx-card)] border border-[color:var(--mx-border)] mr-2"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--mx-btn)]"></div>
          </div>

          {renderScreenContent()}
        </div>
      </div>

      {/* Right Column: Implementation Guide & Live Currency Rates */}
      <div className="lg:col-span-5 space-y-6">
        {/* Live Currency Rates Board */}
        <div className="bg-[color-mix(in_srgb,var(--mx-card)_90%,transparent)] border border-[color:var(--mx-border)] rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[color:var(--mx-border)]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[color:var(--mx-price)]" />
              <h3 className="font-bold text-[color:var(--mx-text)] text-base">
                تابلو زنده نرخ ارزهای تجاری بازرگانی
              </h3>
            </div>
            <span className="text-[10px] text-[color:var(--mx-muted)] font-mono">ساعت: {currencyRates.lastUpdated}</span>
          </div>

          <p className="text-xs text-[color:var(--mx-muted)]">
            نرخ‌های مرجع استعلام از سایت‌های رسمی (TGJU / AlanChand / Navasan / ArzDigital):
          </p>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-[color-mix(in_srgb,var(--mx-card)_60%,transparent)] p-3 rounded-[var(--mx-radius)] border border-[color:var(--mx-border)] space-y-1">
              <div className="text-[11px] text-[color:var(--mx-muted)]">دلار آمریکا (USD)</div>
              <div className="text-sm font-extrabold text-[color:var(--mx-price)] font-mono">
                {currencyRates.usd.toLocaleString('en-US')}
              </div>
              <div className="text-[10px] text-[color:var(--mx-muted)]">تومان</div>
            </div>

            <div className="bg-[color-mix(in_srgb,var(--mx-card)_60%,transparent)] p-3 rounded-[var(--mx-radius)] border border-[color:var(--mx-border)] space-y-1">
              <div className="text-[11px] text-[color:var(--mx-muted)]">درهم امارات (AED)</div>
              <div className="text-sm font-extrabold text-[color:var(--mx-accent)] font-mono">
                {currencyRates.aed.toLocaleString('en-US')}
              </div>
              <div className="text-[10px] text-[color:var(--mx-muted)]">واردات دبی</div>
            </div>

            <div className="bg-[color-mix(in_srgb,var(--mx-card)_60%,transparent)] p-3 rounded-[var(--mx-radius)] border border-[color:var(--mx-border)] space-y-1">
              <div className="text-[11px] text-[color:var(--mx-muted)]">یوان چین (CNY)</div>
              <div className="text-sm font-extrabold text-[color:var(--mx-accent)] font-mono">
                {currencyRates.cny.toLocaleString('en-US')}
              </div>
              <div className="text-[10px] text-[color:var(--mx-muted)]">خرید 1688</div>
            </div>
          </div>
        </div>

        {/* Protection / B2B Wholesaler Shield Info */}
        <div className="nfs-info-card bg-gradient-to-br from-[color:var(--mx-card)] to-[color:var(--mx-card)] border border-[color:color-mix(in_srgb,var(--mx-accent)_40%,transparent)] rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-[color:var(--mx-accent)] font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-[color:var(--mx-ok)]" />
            <span>مکانیزم محافظت از قیمت‌های عمده (B2B Gatekeeping)</span>
          </div>

          <p className="text-xs text-[color:var(--mx-body)] leading-relaxed">
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
