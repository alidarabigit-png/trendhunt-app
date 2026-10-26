export interface TieredPrice {
  minQuantity: number;
  maxQuantity?: number; // undefined means "and above"
  priceUsd: number;
  priceCny?: number; // Chinese Yuan
  priceAed?: number; // UAE Dirham
  calculatedPriceToman?: number;
}

export interface SupplierInfo {
  name: string;
  country: string;
  city?: string;
  platform: 'Alibaba' | '1688' | 'Made-in-China' | 'Global Sources' | 'Amazon B2B' | 'AliExpress';
  yearsInBusiness: number;
  isVerified: boolean;
  hasTradeAssurance: boolean;
  rating: number;
  responseRate: string;
  onTimeDeliveryRate: string;
  reviewCount: number;
  trustScore: number;
  supplierProfileUrl?: string;
}

export interface ProductItem {
  id: string;
  createdAt: string;
  sourceUrl: string;
  originalTitle: string;
  faTitle: string;
  faShortDesc: string;
  faFullDesc: string;
  faFeatures: string[];
  technicalSpecs: Record<string, string>;
  category: string;
  brand?: string;
  categoryLocked?: boolean;
  subCategory?: string;
  modelOrSku?: string;
  tags: string[];
  images: string[];
  mainImage: string;
  moq: number;
  leadTimeDays: number;
  tieredPricing: TieredPrice[];
  costPerUnitUsd: number;
  costPerUnitCny?: number;
  costPerUnitAed?: number;
  estimatedMarginPercent: number;
  weightKg?: number;
  routeType?: 'china_dubai_iran' | 'china_iran_direct' | 'dubai_iran';
  customsPerKg?: number;
  supplier: SupplierInfo;
  isSyncedToSheets: boolean;
  syncedSheetRowId?: string;
  isPostedToTelegram: boolean;
  isSyncedToWebsite?: boolean;
  websiteProductUrl?: string;
  trendScore: number;
}

export interface WebStoreConfig {
  storeUrl: string;
  subdomainUrl: string;
  consumerKey: string;
  consumerSecret: string;
  autoSyncOnScan: boolean;
  status: 'connected' | 'disconnected';
  lastSyncedAt?: string;
  totalProductsPublished: number;
}

export interface CurrencyRates {
  usd: number; // دلار آمریکا
  eur?: number; // یورو (اختیاری)
  aed: number; // درهم امارات
  cny: number; // یوان چین
  lastUpdated: string;
  source: string; // e.g. 'TGJU' | 'AlanChand' | 'Navasan' | 'ArzDigital'
  isAutoUpdate: boolean;
  updateIntervalMinutes: number;
}

export interface SourcingSettings {
  category: string;
  keyword: string;
  platforms: ('Alibaba' | '1688' | 'Made-in-China' | 'Global Sources')[];
  minSupplierYears: number;
  requireTradeAssurance: boolean;
  requireVerifiedSupplier: boolean;
  minRating: number;
  minMoq: number;
  maxMoq: number;
  usdToTomanRate: number;
  aedToTomanRate: number;
  cnyToTomanRate: number;
  targetMarginPercent: number;
  autoSyncToSheets: boolean;
  autoGenerateTelegramPost: boolean;
  autoBroadcastToTelegram?: boolean;
  autoScheduleEnabled?: boolean;
  autoScheduleTime?: string; // e.g. '08:00'
  lastAutoRunDate?: string; // e.g. '2026-10-06'
}

export interface GoogleSheetsConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  sheetTitle: string;
  lastSyncedAt: string | null;
  totalSyncedCount: number;
}

export interface TelegramConfig {
  botToken: string;
  channelId: string;
  miniAppUrl: string;
  adminUsername: string;
}

export interface CustomerUser {
  id: string;
  name: string;
  telegramUsername: string;
  telegramId?: string;
  companyName: string;
  city: string;
  phone: string;
  role: 'customer' | 'admin';
  status: 'approved' | 'pending' | 'rejected';
  requestedAt: string;
  approvedAt?: string;
  tier: 'همکار برنزی' | 'همکار نقره‌ای (تایید شده)' | 'خریدار عمده طلایی (VIP)';
  totalOrdersCount: number;
}

export interface InquiryMessage {
  id: string;
  sender: 'admin' | 'customer';
  senderName: string;
  text: string;
  timestamp: string;
}

export interface CustomerInquiry {
  id: string;
  customerId: string;
  customerName: string;
  customerTelegram: string;
  customerPhone: string;
  productId: string;
  productTitle: string;
  productImage: string;
  requestedQuantity: number;
  unitPriceToman: number;
  totalPriceToman: number;
  unitPriceUsd?: number;
  unitPriceCny?: number;
  status: 'pending_review' | 'quoted' | 'approved_by_client' | 'procuring' | 'rejected';
  createdAt: string;
  updatedAt: string;
  messages: InquiryMessage[];
  adminNotes?: string;
}

export interface MiniAppNotification {
  id: string;
  inquiryId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'inquiry_response' | 'status_update' | 'quote_ready';
  productTitle?: string;
  productImage?: string;
}

// ---------- ظاهر مینی‌اپ (تنظیمات ظاهر پنل مدیریت) ----------
export type MiniAppRoleKey = 'heading' | 'body' | 'small' | 'price' | 'button';

export interface MiniAppRoleStyle {
  size: number;      // px
  weight: number;    // 300..900
  color: string;     // #RRGGBB
  lineHeight: number;
}

export interface MiniAppUi {
  fontFamily: string;
  accent: string;
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  mutedColor: string;
  buttonBg: string;
  buttonText: string;
  radius: number;    // px
  roles: Record<MiniAppRoleKey, MiniAppRoleStyle>;
}

export const MINIAPP_FONTS = ['system-ui', 'Tahoma', 'Segoe UI', 'Arial', 'Vazirmatn'] as const;

export const MINIAPP_ROLE_LABELS: Record<MiniAppRoleKey, string> = {
  heading: 'عنوان کالا',
  body: 'متن توضیحات',
  small: 'ویژگی‌ها و مشخصات',
  price: 'قیمت',
  button: 'متن دکمه‌ها',
};

export const MINIAPP_ROLE_RANGES: Record<MiniAppRoleKey, { size: [number, number] }> = {
  heading: { size: [12, 28] },
  body: { size: [10, 20] },
  small: { size: [9, 16] },
  price: { size: [11, 24] },
  button: { size: [10, 18] },
};

export const DEFAULT_MINIAPP_UI: MiniAppUi = {
  fontFamily: 'Vazirmatn',
  accent: '#A91D2E',
  pageBg: '#F6F7F9',
  cardBg: '#FFFFFF',
  cardBorder: '#E3E6EC',
  textColor: '#0F1115',
  mutedColor: '#6B7280',
  buttonBg: '#A91D2E',
  buttonText: '#FFFFFF',
  radius: 14,
  roles: {
    heading: { size: 15, weight: 800, color: '#0F1115', lineHeight: 1.6 },
    body: { size: 13, weight: 400, color: '#0F1115', lineHeight: 1.9 },
    small: { size: 12, weight: 400, color: '#6B7280', lineHeight: 1.8 },
    price: { size: 16, weight: 800, color: '#A91D2E', lineHeight: 1.4 },
    button: { size: 13, weight: 700, color: '#FFFFFF', lineHeight: 1.4 },
  },
};

// دسته‌بندی استاندارد کاتالوگ (باید با catalog_categories در api.php یکی باشد)
export const CATALOG_CATEGORIES = [
  'شارژر دیواری و رومیزی',
  'پاوربانک',
  'شارژر بی‌سیم و مگ‌سیف',
  'شارژر فندکی خودرو',
  'کابل و تبدیل',
  'هاب و داک USB-C',
  'قاب و لوازم جانبی گوشی',
  'پوشیدنی هوشمند',
  'هدفون و صوتی',
  'کیبورد و لوازم گیمینگ',
  'دوربین و امنیت خانه',
  'پروژکتور و تجهیزات کنفرانس',
  'خانه هوشمند و روشنایی',
  'ردیاب و ابزار ارتباطی',
  'آشپزخانه و نوشیدنی',
  'خودرو، سفر و فضای باز',
  'متفرقه',
];
