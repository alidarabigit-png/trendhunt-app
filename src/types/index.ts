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
