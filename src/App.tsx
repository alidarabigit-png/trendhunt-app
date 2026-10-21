import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { ManualProcessTab } from './components/ManualProcessTab';
import { ProductsCatalogTab } from './components/ProductsCatalogTab';
import { TelegramMiniAppPreview } from './components/TelegramMiniAppPreview';
import { AppearanceSettingsTab } from './components/AppearanceSettingsTab';
import { TelegramPostGeneratorTab } from './components/TelegramPostGeneratorTab';
import { AdminPanelTab } from './components/AdminPanelTab';
import { CustomerPortalTab } from './components/CustomerPortalTab';
import { WebStoreSyncModal } from './components/WebStoreSyncModal';
import {
  ProductItem,
  SourcingSettings,
  GoogleSheetsConfig,
  TelegramConfig,
  CurrencyRates,
  CustomerUser,
  CustomerInquiry,
  WebStoreConfig,
  MiniAppNotification,
  MiniAppUi,
} from './types';
import { INITIAL_PRODUCTS } from './data/sampleProducts';
import { INITIAL_CUSTOMERS, INITIAL_INQUIRIES, DEFAULT_CUSTOMER } from './data/sampleCustomers';
import { DEFAULT_RATES, fetchLiveExchangeRates, saveCustomRatesToServer } from './services/currencyService';
import { initAuth, googleSignIn, logout } from './services/firebaseAuth';
import {
  createWholesaleSpreadsheet,
  appendProductsToSheet,
  readProductsFromSheet,
  cleanDuplicatesInSheet,
  extractSpreadsheetId,
} from './services/googleSheets';
import { CurrencyRatesModal } from './components/CurrencyRatesModal';
import { SheetCleanerModal } from './components/SheetCleanerModal';
import { HostMediaUploadModal } from './components/HostMediaUploadModal';
import { deduplicateProducts, filterNewProducts } from './utils/catalogUtils';

export default function App() {
  const [viewMode, setViewMode] = useState<'miniapp' | 'admin'>(() => {
    if (typeof window === 'undefined') return 'miniapp';
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'admin') return 'admin';
    if (params.get('view') === 'miniapp') return 'miniapp';
    if (params.get('productId') || params.get('product') || params.get('id')) return 'miniapp';

    const tgStartParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (tgStartParam) return 'miniapp';

    if (window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost')) {
      return 'admin';
    }

    return 'miniapp';
  });

  const [activeTab, setActiveTab] = useState<string>('manual');
  const [miniUi, setMiniUi] = useState<MiniAppUi | null>(null);
  useEffect(() => {
    fetch('/api.php?action=get_ui')
      .then((r) => r.json())
      .then((d) => { if (d?.ui && typeof d.ui === 'object' && d.ui.roles) setMiniUi(d.ui as MiniAppUi); })
      .catch(() => {});
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('nfs_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    }
    localStorage.setItem('nfs_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [currencyRates, setCurrencyRates] = useState<CurrencyRates>(DEFAULT_RATES);
  const [isRefreshingRates, setIsRefreshingRates] = useState<boolean>(false);

  const CATALOG_VERSION_TAG = '2026-10-05-v10-rich-gallery-safe';

  const [products, setProductsState] = useState<ProductItem[]>(() => {
    try {
      const storedVersion = localStorage.getItem('nfs_catalog_schema_version');
      if (storedVersion !== CATALOG_VERSION_TAG) {
        localStorage.setItem('nfs_catalog_schema_version', CATALOG_VERSION_TAG);
        const cleanInitial = deduplicateProducts(INITIAL_PRODUCTS);
        localStorage.setItem('nfs_products_catalog', JSON.stringify(cleanInitial));
        return cleanInitial;
      }
      const saved = localStorage.getItem('nfs_products_catalog');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return deduplicateProducts(parsed);
      }
    } catch (e) {
      console.warn('Failed to load products from storage', e);
    }
    return deduplicateProducts(INITIAL_PRODUCTS);
  });

  // ۱) بررسی کلید ادمین در هدر ذخیره‌سازی
  const syncToBackend = (items: ProductItem[]) => {
    const adminKey = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nfs_admin_key') : null;
    if (viewMode !== 'admin' || !adminKey) return;
    try {
      const isPhpHost = window.location.hostname.includes('nafisstore.com') || window.location.pathname.includes('.php');
      const endpoint = isPhpHost ? '/api.php?action=save_products' : '/api/catalog';
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ products: items }),
      }).catch((e) => console.warn('Host backend sync deferred', e));
    } catch (e) {}
  };

  const setProducts = (
    value: ProductItem[] | ((prev: ProductItem[]) => ProductItem[])
  ) => {
    setProductsState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      const cleanUnique = deduplicateProducts(next);
      try {
        localStorage.setItem('nfs_products_catalog', JSON.stringify(cleanUnique));
      } catch (e) {
        console.warn('Failed to save products to storage', e);
      }
      syncToBackend(cleanUnique);
      return cleanUnique;
    });
  };

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const targetId = params?.get('productId') || params?.get('product') || params?.get('id') || (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param : null);

      const saved = localStorage.getItem('nfs_products_catalog');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (targetId) {
            const found = parsed.find((p: any) => p.id === targetId || p.originalTitle?.includes(targetId) || p.faTitle?.includes(targetId));
            if (found) return found;
          }
          return parsed[0];
        }
      }
      if (targetId) {
        const found = INITIAL_PRODUCTS.find(p => p.id === targetId || p.originalTitle?.includes(targetId) || p.faTitle?.includes(targetId));
        if (found) return found;
      }
    } catch (e) {}
    return INITIAL_PRODUCTS[0];
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('productId') || params.get('product') || params.get('id') || (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (targetId && products.length > 0) {
      const found = products.find(p => p.id === targetId || p.originalTitle?.includes(targetId) || p.faTitle?.includes(targetId));
      if (found) {
        setSelectedProduct(found);
        setViewMode('miniapp');
      }
    }
  }, [products]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMediaUploadModalOpen, setIsMediaUploadModalOpen] = useState(false);

  const handleAddImageToProduct = (productId: string, imageUrl: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const updatedImages = p.images.includes(imageUrl) ? p.images : [imageUrl, ...p.images];
          return { ...p, images: updatedImages, mainImage: p.mainImage || imageUrl };
        }
        return p;
      })
    );
    showToast('تصویر به کاتالوگ محصول الصاق شد.');
  };

  const [pendingExtensionProducts, setPendingExtensionProducts] = useState<any[]>([]);

  useEffect(() => {
    const checkExt = async () => {
      try {
        const res = await fetch('/api/extension/pending');
        if (res.ok) {
          const data = await res.json();
          if (data.products) {
            setPendingExtensionProducts(data.products);
          }
        }
      } catch (e) {}
    };
    checkExt();
    const interval = setInterval(checkExt, 8000);
    return () => clearInterval(interval);
  }, []);

  // ۴) بررسی و دریافت کلید ادمین در صورت نیاز
  useEffect(() => {
    if (viewMode !== 'admin') return;
    if (!sessionStorage.getItem('nfs_admin_key')) {
      const k = window.prompt('کلید ادمین را وارد کنید');
      if (k) sessionStorage.setItem('nfs_admin_key', k.trim());
    }
  }, [viewMode]);

  // ۵) واکشی کاتالوگ با هدر ادمین
  useEffect(() => {
    const fetchRemoteCatalog = async () => {
      try {
        const adminKey = viewMode === 'admin' && typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nfs_admin_key') : null;
        const action = adminKey ? 'get_products_admin' : 'get_products';
        const headers: HeadersInit = adminKey ? { 'X-Admin-Key': adminKey } : {};

        const isPhpHost = window.location.hostname.includes('nafisstore.com') || window.location.pathname.includes('.php');
        const endpoints = isPhpHost
          ? [`/api.php?action=${action}`, '/api/catalog']
          : ['/api/catalog', `https://nfs.nafisstore.com/api.php?action=${action}`, `/api.php?action=${action}`];

        for (const ep of endpoints) {
          try {
            const cacheBusterUrl = `${ep}${ep.includes('?') ? '&' : '?'}_t=${Date.now()}`;
            const res = await fetch(cacheBusterUrl, {
              headers,
              cache: 'no-store',
            });
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.products) && data.products.length > 0) {
                const clean = deduplicateProducts(data.products);
                setProductsState(clean);
                try {
                  localStorage.setItem('nfs_products_catalog', JSON.stringify(clean));
                } catch (e) {}
                console.log('✅ Catalog successfully hydrated from:', ep, clean.length, 'items');
                break;
              }
            }
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Could not sync remote catalog on mount', err);
      }
    };

    const fetchRemoteSettings = async () => {
      try {
        const isPhpHost = window.location.hostname.includes('nafisstore.com') || window.location.pathname.includes('.php');
        const endpoints = isPhpHost
          ? ['/api.php?action=get_settings', '/api/settings']
          : ['/api/settings', 'https://nfs.nafisstore.com/api.php?action=get_settings', '/api.php?action=get_settings'];

        for (const ep of endpoints) {
          try {
            const cacheBusterUrl = `${ep}${ep.includes('?') ? '&' : '?'}_t=${Date.now()}`;
            const res = await fetch(cacheBusterUrl, { cache: 'no-store' });
            if (res.ok) {
              const data = await res.json();
              if (data.settings && typeof data.settings === 'object') {
                setTelegramConfigState((prev) => {
                  const serverToken = String(data.settings.botToken || '').trim();
                  const isRealServerToken = serverToken.length > 20 && serverToken.includes(':') && serverToken !== 'nfs2026';
                  const finalToken = isRealServerToken
                    ? serverToken
                    : (prev.botToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('nfs_telegram_bot_token_permanent') || '' : ''));

                  const merged: TelegramConfig = {
                    ...prev,
                    channelId: data.settings.channelId || prev.channelId || '@NafisSmartTrade',
                    adminUsername: data.settings.adminUsername || prev.adminUsername || 'nafistejarat_bot',
                    miniAppUrl: data.settings.miniAppUrl || prev.miniAppUrl || 'https://nfs.nafisstore.com',
                    botToken: finalToken,
                  };
                  try {
                    localStorage.setItem('nfs_telegram_config', JSON.stringify(merged));
                    if (finalToken) {
                      localStorage.setItem('nfs_telegram_bot_token_permanent', finalToken);
                    }
                  } catch (e) {}
                  return merged;
                });
                break;
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    };

    fetchRemoteCatalog();
    fetchRemoteSettings();
  }, [viewMode]);

  const [customers, setCustomersState] = useState<CustomerUser[]>(() => {
    try {
      const saved = localStorage.getItem('nfs_crm_customers');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_CUSTOMERS;
  });

  const setCustomers = (val: CustomerUser[] | ((prev: CustomerUser[]) => CustomerUser[])) => {
    setCustomersState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('nfs_crm_customers', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const [inquiries, setInquiriesState] = useState<CustomerInquiry[]>(() => {
    try {
      const saved = localStorage.getItem('nfs_crm_inquiries');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_INQUIRIES;
  });

  const setInquiries = (val: CustomerInquiry[] | ((prev: CustomerInquiry[]) => CustomerInquiry[])) => {
    setInquiriesState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('nfs_crm_inquiries', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const [currentCustomer, setCurrentCustomer] = useState<CustomerUser>(() => {
    try {
      const savedCust = localStorage.getItem('nfs_current_customer');
      if (savedCust) {
        const parsedCust = JSON.parse(savedCust);
        if (parsedCust && parsedCust.id && parsedCust.status) return parsedCust;
      }
      const saved = localStorage.getItem('nfs_crm_customers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.status) return parsed[0];
      }
    } catch (e) {}
    return DEFAULT_CUSTOMER;
  });


  const [settings, setSettingsState] = useState<SourcingSettings>(() => {
    try {
      const saved = localStorage.getItem('nfs_sourcing_settings');
      if (saved) {
        return {
          category: 'همه دسته‌ها (الگوریتم ترند کلی)',
          keyword: '',
          platforms: ['Alibaba', '1688', 'Made-in-China', 'Global Sources'],
          minSupplierYears: 5,
          requireTradeAssurance: true,
          requireVerifiedSupplier: true,
          minRating: 4.8,
          minMoq: 10,
          maxMoq: 50,
          usdToTomanRate: DEFAULT_RATES.usd,
          aedToTomanRate: DEFAULT_RATES.aed,
          cnyToTomanRate: DEFAULT_RATES.cny,
          targetMarginPercent: 50,
          autoSyncToSheets: true,
          autoGenerateTelegramPost: true,
          autoScheduleEnabled: true,
          autoScheduleTime: '08:00',
          lastAutoRunDate: '',
          ...JSON.parse(saved),
        };
      }
    } catch (e) {}
    return {
      category: 'همه دسته‌ها (الگوریتم ترند کلی)',
      keyword: '',
      platforms: ['Alibaba', '1688', 'Made-in-China', 'Global Sources'],
      minSupplierYears: 5,
      requireTradeAssurance: true,
      requireVerifiedSupplier: true,
      minRating: 4.8,
      minMoq: 10,
      maxMoq: 50,
      usdToTomanRate: DEFAULT_RATES.usd,
      aedToTomanRate: DEFAULT_RATES.aed,
      cnyToTomanRate: DEFAULT_RATES.cny,
      targetMarginPercent: 50,
      autoSyncToSheets: true,
      autoGenerateTelegramPost: true,
      autoScheduleEnabled: true,
      autoScheduleTime: '08:00',
      lastAutoRunDate: '',
    };
  });

  const setSettings = (
    value: SourcingSettings | ((prev: SourcingSettings) => SourcingSettings)
  ) => {
    setSettingsState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      try {
        localStorage.setItem('nfs_sourcing_settings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };


  const [sheetsConfig, setSheetsConfigState] = useState<GoogleSheetsConfig>(() => {
    try {
      const saved = localStorage.getItem('nfs_sheets_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      spreadsheetId: null,
      spreadsheetUrl: null,
      sheetTitle: 'کالاهای ترند عمده‌فروشی تلگرام',
      lastSyncedAt: null,
      totalSyncedCount: 0,
    };
  });

  const setSheetsConfig = (
    value: GoogleSheetsConfig | ((prev: GoogleSheetsConfig) => GoogleSheetsConfig)
  ) => {
    setSheetsConfigState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      try {
        localStorage.setItem('nfs_sheets_config', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);

  const [telegramConfig, setTelegramConfigState] = useState<TelegramConfig>(() => {
    try {
      const saved = localStorage.getItem('nfs_telegram_config');
      const permToken = (typeof localStorage !== 'undefined' ? localStorage.getItem('nfs_telegram_bot_token_permanent') : '') || '';
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedUrl = parsed.miniAppUrl;
        const cleanUrl = (!savedUrl || savedUrl.includes('ais-dev-') || savedUrl.includes('run.app') || savedUrl.includes('pages.dev'))
          ? 'https://nfs.nafisstore.com'
          : savedUrl;
        const resolvedToken = (parsed.botToken && parsed.botToken !== 'nfs2026') ? parsed.botToken : permToken;
        return {
          botToken: resolvedToken,
          channelId: parsed.channelId || '@NafisSmartTrade',
          miniAppUrl: cleanUrl,
          adminUsername: parsed.adminUsername || 'nafistejarat_bot',
        };
      }
      if (permToken) {
        return {
          botToken: permToken,
          channelId: '@NafisSmartTrade',
          miniAppUrl: 'https://nfs.nafisstore.com',
          adminUsername: 'nafistejarat_bot',
        };
      }
    } catch (e) {}
    return {
      botToken: '',
      channelId: '@NafisSmartTrade',
      miniAppUrl: 'https://nfs.nafisstore.com',
      adminUsername: 'nafistejarat_bot',
    };
  });

  const setTelegramConfig = (
    value: TelegramConfig | ((prev: TelegramConfig) => TelegramConfig)
  ) => {
    setTelegramConfigState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      try {
        localStorage.setItem('nfs_telegram_config', JSON.stringify(next));
        if (next.botToken && next.botToken !== 'nfs2026') {
          localStorage.setItem('nfs_telegram_bot_token_permanent', next.botToken);
        }
      } catch (e) {}
      return next;
    });
  };

  const [webStoreConfig, setWebStoreConfig] = useState<WebStoreConfig>({
    storeUrl: 'https://nafisstore.com',
    subdomainUrl: 'https://nfs.nafisstore.com',
    consumerKey: 'ck_nfs_748291047291048201',
    consumerSecret: 'cs_nfs_secret_92819481920',
    autoSyncOnScan: false,
    status: 'connected',
    lastSyncedAt: '18:30:00',
    totalProductsPublished: 4,
  });
  const [isWebStoreModalOpen, setIsWebStoreModalOpen] = useState(false);
  const [webStoreSyncProduct, setWebStoreSyncProduct] = useState<ProductItem | null>(null);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [isSheetCleanerOpen, setIsSheetCleanerOpen] = useState(false);

  const [miniAppNotifications, setMiniAppNotifications] = useState<MiniAppNotification[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleWebsitePublishSuccess = (productId: string, liveUrl: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, isSyncedToWebsite: true, websiteProductUrl: liveUrl } : p
      )
    );
    showToast(`محصول با موفقیت در سایت nafisstore.com منتشر شد!`);
  };

  const handleRefreshRates = async (showToastNotification: boolean = true) => {
    setIsRefreshingRates(true);
    try {
      const freshRates = await fetchLiveExchangeRates('TGJU / AlanChand');
      setCurrencyRates(freshRates);
      setSettings((s) => ({
        ...s,
        usdToTomanRate: freshRates.usd,
        aedToTomanRate: freshRates.aed,
        cnyToTomanRate: freshRates.cny,
      }));
      if (showToastNotification) {
        showToast(
          `نرخ ارز بروزرسانی شد: دلار ${freshRates.usd.toLocaleString('en-US')} تومان`
        );
      }
    } catch (err) {
      if (showToastNotification) showToast('خطا در دریافت نرخ‌های جدید.');
    } finally {
      setIsRefreshingRates(false);
    }
  };

  const handleSaveCustomRates = (customUsd: number, customAed: number, customCny: number) => {
    const updatedRates: CurrencyRates = {
      usd: customUsd,
      aed: customAed,
      cny: customCny,
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      source: 'تنظیم دستی همکار',
      isAutoUpdate: false,
      updateIntervalMinutes: 1,
    };
    setCurrencyRates(updatedRates);
    setSettings((s) => ({
      ...s,
      usdToTomanRate: customUsd,
      aedToTomanRate: customAed,
      cnyToTomanRate: customCny,
    }));
    saveCustomRatesToServer(customUsd, customAed, customCny);
    showToast(`نرخ دلار ذخیره شد.`);
  };

  useEffect(() => {
    handleRefreshRates(false);
    const interval = setInterval(() => {
      handleRefreshRates(false);
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncFromLiveHost = async () => {
    try {
      showToast('در حال دریافت کاتالوگ از هاست اصلی...');
      const isPhpHost = window.location.hostname.includes('nafisstore.com') || window.location.pathname.includes('.php');
      const ep = isPhpHost
        ? '/api.php?action=get_products&_t=' + Date.now()
        : 'https://nfs.nafisstore.com/api.php?action=get_products&_t=' + Date.now();

      const res = await fetch(ep, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products) && data.products.length > 0) {
          const clean = deduplicateProducts(data.products);
          setProducts(clean);
          showToast(`✅ کاتالوگ با موفقیت همگام‌سازی شد (${clean.length} محصول)`);
          return;
        }
      }
      showToast('⚠️ پاسخی دریافت نشد.');
    } catch (e: any) {
      showToast('❌ خطا در برقراری ارتباط');
    }
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser) => setUser(currentUser),
      () => setUser(null)
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // ۳) شرط viewMode !== 'admin' برای افکت تغییر قیمت
  useEffect(() => {
    if (viewMode !== 'admin') return;
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        tieredPricing: p.tieredPricing.map((tier) => ({
          ...tier,
          calculatedPriceToman: Math.round(tier.priceUsd * currencyRates.usd * (1 + settings.targetMarginPercent / 100)),
        })),
      }))
    );
  }, [currencyRates.usd, settings.targetMarginPercent, viewMode]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) setUser(res.user);
    } catch (err) {
      showToast('خطا در ورود به حساب گوگل.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
    } catch (err) {}
  };

  const handleCreateNewSheet = async () => {
    if (!user) {
      handleLogin();
      return;
    }
    setIsCreatingSheet(true);
    try {
      const res = await createWholesaleSpreadsheet();
      setSheetsConfig({
        spreadsheetId: res.spreadsheetId,
        spreadsheetUrl: res.spreadsheetUrl,
        sheetTitle: res.title,
        lastSyncedAt: new Date().toLocaleTimeString('en-US'),
        totalSyncedCount: 0,
      });
      await appendProductsToSheet(res.spreadsheetId, products);
      setProducts((prev) => prev.map((p) => ({ ...p, isSyncedToSheets: true })));
      showToast('✅ شیت ایجاد شد.');
    } catch (err: any) {
      showToast('خطا در ایجاد شیت.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleSyncProductToSheets = async (product: ProductItem) => {
    if (!user) {
      setActiveTab('sheets');
      return;
    }
    setIsSyncingSheets(true);
    try {
      let targetId = sheetsConfig.spreadsheetId;
      if (!targetId) {
        const newSheet = await createWholesaleSpreadsheet();
        targetId = newSheet.spreadsheetId;
        setSheetsConfig({
          spreadsheetId: newSheet.spreadsheetId,
          spreadsheetUrl: newSheet.spreadsheetUrl,
          sheetTitle: newSheet.title,
          lastSyncedAt: new Date().toLocaleTimeString('en-US'),
          totalSyncedCount: 1,
        });
      }
      await appendProductsToSheet(targetId, [product]);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, isSyncedToSheets: true } : p)));
      showToast('محصول در شیت ذخیره شد.');
    } catch (err: any) {
      showToast('خطا در همگام‌سازی محصول.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleSyncAllToSheets = async () => {
    if (!user) {
      setActiveTab('sheets');
      return;
    }
    setIsSyncingSheets(true);
    try {
      let targetId = sheetsConfig.spreadsheetId;
      if (!targetId) {
        const newSheet = await createWholesaleSpreadsheet();
        targetId = newSheet.spreadsheetId;
        setSheetsConfig({
          spreadsheetId: newSheet.spreadsheetId,
          spreadsheetUrl: newSheet.spreadsheetUrl,
          sheetTitle: newSheet.title,
          lastSyncedAt: new Date().toLocaleTimeString('en-US'),
          totalSyncedCount: products.length,
        });
      }
      const res = await appendProductsToSheet(targetId, products);
      setProducts((prev) => prev.map((p) => ({ ...p, isSyncedToSheets: true })));
      showToast(`تعداد ${res.updatedRows} محصول در شیت درج شد.`);
    } catch (err: any) {
      showToast('خطا در ذخیره در شیت.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleCleanSheetDuplicates = () => {
    if (!user || !sheetsConfig.spreadsheetId) return;
    setIsSheetCleanerOpen(true);
  };

  const handleImportFromSheet = async (showNotification = true) => {
    if (!sheetsConfig.spreadsheetId) return;
    setIsSyncingSheets(true);
    try {
      const items = await readProductsFromSheet(sheetsConfig.spreadsheetId, currencyRates.usd);
      if (items.length > 0) {
        setProducts(items);
        setSelectedProduct(items[0] || null);
        if (showNotification) showToast(`تعداد ${items.length} کالا از شیت بارگذاری شد.`);
      }
    } catch (err: any) {
      if (showNotification) showToast('خطا در خواندن اطلاعات از شیت.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleUpdateProductImages = (
    productId: string,
    newImages: string[],
    newMainImage: string
  ) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, images: newImages, mainImage: newMainImage } : p
      )
    );
    setSelectedProduct((prev) =>
      prev?.id === productId ? { ...prev, images: newImages, mainImage: newMainImage } : prev
    );
  };

  const handleSaveCatalogToCloud = async () => {
    try {
      const isPhpHost = window.location.hostname.includes('nafisstore.com') || window.location.pathname.includes('.php');
      const endpoint = isPhpHost ? '/api.php?action=save_products' : '/api/catalog';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      const data = await res.json();
      if (data.success || data.ok) {
        showToast('✅ کاتالوگ با موفقیت در سرور ذخیره شد.');
      }
    } catch (err) {
      showToast('خطا در ذخیره روی سرور.');
    }
  };

  const handleRestoreCatalogBackup = () => {
    try {
      const backup = localStorage.getItem('nfs_catalog_last_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          showToast('کاتالوگ بازیابی شد.');
          return;
        }
      }
    } catch (e) {}
  };

  const handleResetCatalogToMaster = async () => {
    setProducts(INITIAL_PRODUCTS);
    showToast('کاتالوگ بازنشانی شد.');
  };

  const handleCleanDuplicates = () => {
    const clean = deduplicateProducts(products);
    const removedCount = products.length - clean.length;
    setProducts(clean);
    if (removedCount > 0) {
      showToast(`تعداد ${removedCount} کالای تکراری حذف شد.`);
    } else {
      showToast('کاتالوگ بدون تکرار است.');
    }
  };

  const handleNewProductsFound = (newItems: ProductItem[]) => {
    const trulyNew = filterNewProducts(newItems, products);
    if (trulyNew.length === 0) return;
    setProducts((prev) => deduplicateProducts([...trulyNew, ...prev]));
    if (trulyNew.length > 0) setSelectedProduct(trulyNew[0]);
    setActiveTab('catalog');
    showToast(`⚡ ${trulyNew.length} محصول جدید افزوده شد!`);
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (selectedProduct?.id === id) {
      setSelectedProduct(products.find((p) => p.id !== id) || null);
    }
  };

  const handleUpdateProductPricing = (updatedProduct: ProductItem) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
  };

  const handleApproveCustomer = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'approved' } : c))
    );
  };

  const handleRejectCustomer = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'rejected' } : c))
    );
  };

  const handleRegisterCustomer = (
    data: Omit<CustomerUser, 'id' | 'requestedAt' | 'totalOrdersCount' | 'tier' | 'status'>
  ) => {
    const newCust: CustomerUser = {
      ...data,
      id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
      status: 'pending',
      requestedAt: new Date().toISOString().split('T')[0],
      tier: 'همکار برنزی',
      totalOrdersCount: 0,
    };
    setCustomers((prev) => [newCust, ...prev]);
    setCurrentCustomer(newCust);
  };

  const handleSubmitInquiry = (productId: string, quantity: number) => {
    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) return;
    let matchedTier = targetProduct.tieredPricing[0];
    for (const t of targetProduct.tieredPricing) {
      if (quantity >= t.minQuantity) matchedTier = t;
    }
    const unitToman = matchedTier?.calculatedPriceToman || Math.round(targetProduct.costPerUnitUsd * currencyRates.usd * 1.4);
    const newInquiry: CustomerInquiry = {
      id: `INQ-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: currentCustomer.id,
      customerName: currentCustomer.name,
      customerTelegram: currentCustomer.telegramUsername,
      customerPhone: currentCustomer.phone,
      productId: targetProduct.id,
      productTitle: targetProduct.faTitle,
      productImage: targetProduct.mainImage,
      requestedQuantity: quantity,
      unitPriceToman: unitToman,
      totalPriceToman: unitToman * quantity,
      unitPriceUsd: matchedTier?.priceUsd || targetProduct.costPerUnitUsd,
      status: 'pending_review',
      createdAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
      updatedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
      messages: [],
    };
    setInquiries((prev) => [newInquiry, ...prev]);
  };

  const handleReplyToInquiry = (
    inquiryId: string,
    replyText: string,
    newStatus?: CustomerInquiry['status'],
    newUnitPriceToman?: number
  ) => {
    setInquiries((prev) =>
      prev.map((inq) => {
        if (inq.id !== inquiryId) return inq;
        const updatedUnit = newUnitPriceToman !== undefined ? newUnitPriceToman : inq.unitPriceToman;
        return {
          ...inq,
          status: newStatus || inq.status,
          unitPriceToman: updatedUnit,
          totalPriceToman: updatedUnit * inq.requestedQuantity,
          updatedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
          messages: [
            ...inq.messages,
            {
              id: `msg-${Date.now()}`,
              sender: 'admin',
              senderName: 'مدیریت بازرگانی',
              text: replyText,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            },
          ],
        };
      })
    );
  };

  const handleCustomerSendMessage = (inquiryId: string, text: string) => {
    setInquiries((prev) =>
      prev.map((inq) => {
        if (inq.id !== inquiryId) return inq;
        return {
          ...inq,
          updatedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
          messages: [
            ...inq.messages,
            {
              id: `msg-${Date.now()}`,
              sender: 'customer',
              senderName: currentCustomer.name,
              text,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            },
          ],
        };
      })
    );
  };

  const handleApproveProforma = (inquiryId: string) => {
    setInquiries((prev) =>
      prev.map((i) => (i.id === inquiryId ? { ...i, status: 'approved_by_client' } : i))
    );
  };

  if (viewMode === 'miniapp') {
    return (
      <TelegramMiniAppPreview
        ui={miniUi}
        products={products}
        selectedProduct={selectedProduct}
        onSelectProduct={setSelectedProduct}
        currencyRates={currencyRates}
        currentCustomer={currentCustomer}
        onSubmitInquiry={handleSubmitInquiry}
        notifications={miniAppNotifications}
        onMarkNotificationRead={(id) =>
          setMiniAppNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
        }
        inquiries={inquiries}
        onApproveQuote={handleApproveProforma}
        onCustomerSendMessage={handleCustomerSendMessage}
        isStandalone={true}
        onSwitchToAdmin={() => setViewMode('admin')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        currencyRates={currencyRates}
        onRefreshRates={() => handleRefreshRates(true)}
        isRefreshingRates={isRefreshingRates}
        productsCount={products.length}
        syncedSheetsCount={(products || []).filter((p) => p?.isSyncedToSheets).length}
        pendingInquiriesCount={(inquiries || []).filter((i) => i?.status === 'pending_review').length}
        pendingCustomersCount={(customers || []).filter((c) => c?.status === 'pending').length}
        onOpenManualIngest={() => setActiveTab('manual')}
        currentCustomer={currentCustomer || DEFAULT_CUSTOMER}
        onOpenCurrencyModal={() => setIsCurrencyModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSwitchToMiniApp={() => setViewMode('miniapp')}
      />

      {pendingExtensionProducts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/20 via-indigo-600/25 to-amber-500/20 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <strong>⚡ {pendingExtensionProducts.length} محصول از افزونه دریافت شد:</strong>
            <span className="text-slate-300 font-mono truncate max-w-md">{pendingExtensionProducts[0]?.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('manual')}
              className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-lg text-xs"
            >
              مشاهده و ثبت
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'manual' && <ManualProcessTab />}

        {activeTab === 'appearance' && (
          <AppearanceSettingsTab
            adminKey={typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nfs_admin_key') : null}
            onSaved={(ui) => setMiniUi(ui)}
          />
        )}

        {activeTab === 'catalog' && (
          <ProductsCatalogTab
            products={products}
            onSyncProductToSheets={handleSyncProductToSheets}
            onSyncAllToSheets={handleSyncAllToSheets}
            onSelectForTelegramPost={(p) => {
              setSelectedProduct(p);
              setActiveTab('telegram');
            }}
            onSelectForMiniApp={(p) => {
              setSelectedProduct(p);
              setActiveTab('miniapp');
            }}
            onDeleteProduct={handleDeleteProduct}
            onOpenWebStoreSync={(p) => {
              setWebStoreSyncProduct(p);
              setIsWebStoreModalOpen(true);
            }}
            isSyncing={isSyncingSheets}
            usdRate={currencyRates.usd}
            currencyRates={currencyRates}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
            onUpdateProductPricing={handleUpdateProductPricing}
            onImportFromSheets={() => handleImportFromSheet(true)}
            sheetsConfig={sheetsConfig}
            onCleanDuplicates={handleCleanSheetDuplicates}
            onUpdateProductImages={handleUpdateProductImages}
            onResetCatalogToMaster={handleResetCatalogToMaster}
            onSaveCatalogToCloud={handleSaveCatalogToCloud}
            onRestoreBackup={handleRestoreCatalogBackup}
            onOpenMediaUpload={() => setIsMediaUploadModalOpen(true)}
            onSyncFromLiveHost={handleSyncFromLiveHost}
          />
        )}

        {activeTab === 'miniapp' && (
          <TelegramMiniAppPreview
        ui={miniUi}
            products={products}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
            currencyRates={currencyRates}
            currentCustomer={currentCustomer}
            onSubmitInquiry={handleSubmitInquiry}
            notifications={miniAppNotifications}
            onMarkNotificationRead={(id) =>
              setMiniAppNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
            }
            inquiries={inquiries}
            onApproveQuote={handleApproveProforma}
            onCustomerSendMessage={handleCustomerSendMessage}
          />
        )}

        {activeTab === 'telegram' && (
          <TelegramPostGeneratorTab
            products={products}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
            telegramConfig={telegramConfig}
            setTelegramConfig={setTelegramConfig}
            usdRate={currencyRates.usd}
            onImportFromSheets={() => handleImportFromSheet(true)}
            isSyncingSheets={isSyncingSheets}
            onUpdateProductImages={handleUpdateProductImages}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanelTab
            customers={customers}
            onApproveCustomer={handleApproveCustomer}
            onRejectCustomer={handleRejectCustomer}
            inquiries={inquiries}
            onReplyToInquiry={handleReplyToInquiry}
          />
        )}

        {activeTab === 'portal' && (
          <CustomerPortalTab
            currentCustomer={currentCustomer}
            onSwitchCustomer={setCurrentCustomer}
            allCustomers={customers}
            inquiries={inquiries}
            onCustomerSendMessage={handleCustomerSendMessage}
            onApproveProforma={handleApproveProforma}
            onRegisterCustomer={handleRegisterCustomer}
          />
        )}


      </main>


      <WebStoreSyncModal
        isOpen={isWebStoreModalOpen}
        onClose={() => setIsWebStoreModalOpen(false)}
        product={webStoreSyncProduct}
        currencyRates={currencyRates}
        webStoreConfig={webStoreConfig}
        onUpdateConfig={setWebStoreConfig}
        onPublishSuccess={handleWebsitePublishSuccess}
      />

      <CurrencyRatesModal
        isOpen={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
        currencyRates={currencyRates}
        onRefreshRates={() => handleRefreshRates(true)}
        isRefreshing={isRefreshingRates}
        onSaveCustomRates={handleSaveCustomRates}
      />

      <SheetCleanerModal
        isOpen={isSheetCleanerOpen}
        onClose={() => setIsSheetCleanerOpen(false)}
        spreadsheetId={sheetsConfig.spreadsheetId}
        spreadsheetUrl={sheetsConfig.spreadsheetUrl}
        onSelectSpreadsheet={(newId) => {
          setSheetsConfig((prev) => ({
            ...prev,
            spreadsheetId: newId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newId}`,
          }));
        }}
        onCleaningSuccess={async () => {
          await handleImportFromSheet(false);
        }}
      />

      <HostMediaUploadModal
        isOpen={isMediaUploadModalOpen}
        onClose={() => setIsMediaUploadModalOpen(false)}
        products={products}
        onAddImageToProduct={handleAddImageToProduct}
      />


      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-[#E63946]/50 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#E63946]"></span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}