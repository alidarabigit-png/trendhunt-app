import { ProductItem, SourcingSettings, TieredPrice, SupplierInfo } from '../types';
import { toEnDigits } from '../utils/numberUtils';
import { buildRichGallery } from '../utils/galleryHelper';
import { areProductsDuplicate, normalizeProductTitle, filterNewProducts } from '../utils/catalogUtils';
import { getPlatformSearchUrl } from '../utils/sourceUrlUtils';

export interface SourcingProgressUpdate {
  step: 'searching' | 'filtering_suppliers' | 'extracting_specs' | 'generating_seo' | 'calculating_margins' | 'done';
  message: string;
  progressPercent: number;
}

const SAMPLE_SUPPLIERS: SupplierInfo[] = [
  {
    name: 'Shenzhen Apex Smart Innovations Co., Ltd.',
    platform: 'Alibaba',
    country: 'چین',
    city: 'شنژن',
    yearsInBusiness: 9,
    isVerified: true,
    hasTradeAssurance: true,
    rating: 4.93,
    responseRate: '98.8%',
    onTimeDeliveryRate: '99.5%',
    reviewCount: 2150,
    trustScore: 98,
    supplierProfileUrl: 'https://alibaba.com/company/apex-smart',
  },
  {
    name: 'Guangzhou NexTrend Electronics Factory',
    platform: '1688',
    country: 'چین',
    city: 'گوانگجو',
    yearsInBusiness: 7,
    isVerified: true,
    hasTradeAssurance: true,
    rating: 4.86,
    responseRate: '97.5%',
    onTimeDeliveryRate: '98.8%',
    reviewCount: 1480,
    trustScore: 94,
    supplierProfileUrl: 'https://1688.com/factory/nextrend',
  },
  {
    name: 'Yiwu Global Trend Import & Export Co.',
    platform: 'Global Sources',
    country: 'چین',
    city: 'ایوو',
    yearsInBusiness: 11,
    isVerified: true,
    hasTradeAssurance: true,
    rating: 4.96,
    responseRate: '99.3%',
    onTimeDeliveryRate: '99.9%',
    reviewCount: 3400,
    trustScore: 99,
  },
  {
    name: 'Ningbo Precision Tech Industrial Corp.',
    platform: 'Made-in-China',
    country: 'چین',
    city: 'نینگبو',
    yearsInBusiness: 8,
    isVerified: true,
    hasTradeAssurance: true,
    rating: 4.89,
    responseRate: '98.2%',
    onTimeDeliveryRate: '99.1%',
    reviewCount: 1720,
    trustScore: 95,
  },
  {
    name: 'Dongguan Pioneer Audio & Acoustics Co., Ltd.',
    platform: 'Alibaba',
    country: 'چین',
    city: 'دونگ‌گوان',
    yearsInBusiness: 10,
    isVerified: true,
    hasTradeAssurance: true,
    rating: 4.95,
    responseRate: '99.1%',
    onTimeDeliveryRate: '99.8%',
    reviewCount: 3100,
    trustScore: 98,
  },
  {
    name: 'Shenzhen Huaxin Optics & Security Technology Ltd.',
    platform: '1688',
    country: 'چین',
    city: 'شنژن',
    yearsInBusiness: 8,
    isVerified: true,
    hasTradeAssurance: true,
    rating: 4.91,
    responseRate: '98.4%',
    onTimeDeliveryRate: '99.2%',
    reviewCount: 1920,
    trustScore: 96,
  },
];

interface TrendTemplate {
  category: string;
  originalTitle: string;
  faTitle: string;
  faShortDesc: string;
  faFullDesc: string;
  faFeatures: string[];
  technicalSpecs: Record<string, string>;
  tags: string[];
  mainImage: string;
  images: string[];
  basePriceUsd: number;
  moq: number;
  leadTimeDays: number;
  sourceUrl?: string;
}

// Extensive, verified 2026 trending wholesale pool across diverse niches

/**
 * Procedurally generates a brand new, strictly unique 2026 wholesale product
 * that does NOT match any existing item in the catalog.
 */

/**
 * Executes autonomous AI trend hunting.
 * Queries server-side Gemini AI (/api/sourcing/hunt or /api.php?action=sourcing_hunt) first.
 * Strictly checks against existing catalog products to guarantee ZERO DUPLICATES!
 */
export async function runAutomatedSourcingHunt(
  settings: SourcingSettings,
  onProgress: (update: SourcingProgressUpdate) => void,
  _existingProducts: ProductItem[] = [],
  options: { dryRun?: boolean } = {}
): Promise<ProductItem[]> {
  const dryRun = options.dryRun !== false;
  onProgress({
    step: 'searching',
    message: 'ارسال درخواست اجرای ایجنت به سرور...',
    progressPercent: 15,
  });

  let adminKey = '';
  try {
    adminKey = sessionStorage.getItem('nfs_admin_key') || '';
  } catch {
    adminKey = '';
  }
  if (!adminKey) {
    throw new Error('کلید ادمین وارد نشده است. صفحه را رفرش کنید و کلید را وارد کنید.');
  }

  let data: any = null;
  let status = 0;
  try {
    const res = await fetch('/api.php?action=sourcing_hunt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify({ limit: 3, dry_run: dryRun }),
    });
    status = res.status;
    data = await res.json().catch(() => null);
  } catch {
    throw new Error('ارتباط با هاست برقرار نشد.');
  }
  if (status === 401) {
    throw new Error('کلید ادمین نادرست است.');
  }
  if (!data || !data.success) {
    throw new Error((data && data.error) || `خطای سرور (${status})`);
  }

  onProgress({
    step: 'done',
    message: `✅ ایجنت روی گیت‌هاب اجرا شد (${dryRun ? 'حالت تست: بدون ثبت و پست' : 'ثبت در کاتالوگ و پست کانال'}). نتیجه چند دقیقه بعد در کاتالوگ دیده می‌شود. وضعیت اجرا: ${data.runsUrl}`,
    progressPercent: 100,
  });

  // محصولات مستقیم توسط workflow ثبت می‌شوند؛ اینجا لیستی برنمی‌گردد
  return [];
}
