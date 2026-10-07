import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Link,
  DollarSign,
  Layers,
  CheckCircle2,
  RotateCw,
  X,
  FileSpreadsheet,
  Building,
  Upload,
  Trash2,
  Code,
  Zap,
  ArrowRight,
  ClipboardPaste,
  RefreshCw,
  Plus,
  Edit3,
} from 'lucide-react';
import { ProductItem, CurrencyRates } from '../types';
import { upgradeAlibabaImageQuality } from '../utils/imageQuality';
import { generateSmartSeo } from '../utils/seoGenerator';

interface ManualProductIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: ProductItem) => void;
  currencyRates: CurrencyRates;
  targetMarginPercent: number;
}

function normalizeQueueItem(raw: any) {
  const title = (
    raw.title_en ||
    raw.title ||
    raw.title_fa ||
    raw['نام کامل محصول (انگلیسی)'] ||
    raw['عنوان تجاری و کوتاه (فارسی)'] ||
    ''
  ).trim();

  const titleFa = (raw.title_fa || raw['عنوان تجاری و کوتاه (فارسی)'] || '').trim();

  const img = upgradeAlibabaImageQuality(
    (Array.isArray(raw.images) && raw.images[0]) ||
    raw.image ||
    raw.image1 ||
    raw['لینک مستقیم تصویر اصلی و باکیفیت کالا'] ||
    ''
  );

  const img2 = upgradeAlibabaImageQuality(
    (Array.isArray(raw.images) && raw.images[1]) ||
    raw.image2 ||
    raw['لینک مستقیم تصویر 2 (زاویه دوم/بسته‌بندی)'] ||
    img
  );

  const moqVal = String(raw.moq || raw['حداقل تیراژ سفارش (MOQ)'] || '5');
  const price = String(raw.price || raw.priceRange || raw['قیمت پله‌ای عمده (دلار)'] || 'استعلام روز');
  const sourceUrl = (raw.source_url || raw.sourceUrl || raw['لینک مستقیم محصول در سایت مبدأ'] || '').trim();
  const supplier = raw.supplier || raw.supplierName || raw['نام تأمین‌کننده / کارخانه'] || 'Shenzhen Penglianwei Trading Co., Ltd.';
  const code = raw.code || raw.id || '';

  return {
    id: raw.id || code || `Q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    code: code,
    title: title || titleFa || 'محصول وارداتی بدون عنوان',
    title_en: title,
    title_fa: titleFa,
    short_desc: raw.short_desc || '',
    full_desc: raw.full_desc || '',
    features: raw.features || '',
    image: img,
    image2: img2,
    images: [img, img2].filter(Boolean),
    moq: moqVal,
    priceRange: price,
    source_url: sourceUrl,
    supplierName: supplier,
    status: raw.status || 'در انتظار',
  };
}

export const ManualProductIngestModal: React.FC<ManualProductIngestModalProps> = ({
  isOpen,
  onClose,
  onAddProduct,
  currencyRates,
  targetMarginPercent,
}) => {
  const [ingestMode, setIngestMode] = useState<'queue' | 'paste' | 'manual'>('queue');

  // Form Fields
  const [sourceUrl, setSourceUrl] = useState('');
  const [productTitle, setProductTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [category, setCategory] = useState('گجت و لوازم دیجیتال');
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'CNY' | 'AED'>('USD');
  const [manualPrice, setManualPrice] = useState<string>('');
  const [moq, setMoq] = useState<number>(5);

  const [supplierName, setSupplierName] = useState('');
  const [supplierYears, setSupplierYears] = useState<number>(6);
  const [supplierRating, setSupplierRating] = useState<number>(4.2);
  const [customSpecs, setCustomSpecs] = useState<Record<string, string>>({});

  // Queue & Paste states
  const [extensionRawText, setExtensionRawText] = useState('');
  const [pendingQueue, setPendingQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('nfs_extension_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .map(normalizeQueueItem)
            .filter((p) => (p.title_en && p.title_en.length > 3) || (p.source_url && p.source_url.length > 10));
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  });
  const [isCheckingQueue, setIsCheckingQueue] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');

  // Reset form completely
  const resetForm = () => {
    setSourceUrl('');
    setProductTitle('');
    setImageUrl('');
    setUploadedImages([]);
    setCategory('گجت و لوازم دیجیتال');
    setInputCurrency('USD');
    setManualPrice('');
    setMoq(5);
    setSupplierName('');
    setSupplierYears(6);
    setSupplierRating(4.2);
    setCustomSpecs({});
    setExtensionRawText('');
  };

  useEffect(() => {
    if (isOpen) {
      checkPendingQueue();
    }
  }, [isOpen]);

  const saveQueue = (items: any[]) => {
    setPendingQueue(items);
    try {
      localStorage.setItem('nfs_extension_queue', JSON.stringify(items));
    } catch (e) {}
  };

  const clearEntireQueue = () => {
    saveQueue([]);
  };

  const checkPendingQueue = async () => {
    setIsCheckingQueue(true);
    try {
      const allFound: any[] = [];

      // 1. Fetch from local/server extension ingest queue
      try {
        const res = await fetch('/api/extension/pending');
        if (res.ok) {
          const data = await res.json();
          if (data.products && Array.isArray(data.products)) {
            allFound.push(...data.products);
          }
        }
      } catch (e) {}

      // 2. Fetch directly from Google Sheets Apps Script Queue
      try {
        const sheetRes = await fetch('/api/sheets/fetch-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (sheetRes.ok) {
          const sheetData = await sheetRes.json();
          if (sheetData.products && Array.isArray(sheetData.products)) {
            allFound.push(...sheetData.products);
          }
        }
      } catch (e) {}

      if (allFound.length > 0) {
        // Normalize and filter out empty / corrupt items
        const validItems = allFound
          .map(normalizeQueueItem)
          .filter((p) => (p.title_en && p.title_en.length > 3) || (p.source_url && p.source_url.length > 10));

        // Deduplicate
        const seen = new Set();
        const deduplicated: any[] = [];
        for (const item of validItems) {
          const key = (item.title_en || '') + '|' + (item.source_url || '');
          if (!seen.has(key)) {
            seen.add(key);
            deduplicated.push(item);
          }
        }

        saveQueue(deduplicated);
      } else if (allFound.length === 0 && !isCheckingQueue) {
        // If sheet is empty, reflect empty
        saveQueue([]);
      }
    } catch (e) {
      // Ignore network errors
    } finally {
      setIsCheckingQueue(false);
    }
  };

  const removeItemFromQueue = (index: number) => {
    const updated = pendingQueue.filter((_, i) => i !== index);
    saveQueue(updated);
  };

  // Populate form cleanly with item data
  const loadItemIntoForm = (item: any) => {
    resetForm();

    const titleEn = item.title || item['نام کامل محصول (انگلیسی)'] || '';
    const src = item.source_url || item['لینک مستقیم محصول در سایت مبدأ'] || '';
    const moqVal = parseInt(item.moq || item['حداقل تیراژ سفارش (MOQ)'], 10) || 5;
    const sup = item.supplierName || item['نام تأمین‌کننده / کارخانه'] || 'Shenzhen Penglianwei Trading Co., Ltd.';

    // Images
    const imgs: string[] = [];
    if (Array.isArray(item.images)) {
      item.images.forEach((u: string) => {
        const clean = upgradeAlibabaImageQuality(u);
        if (clean && !imgs.includes(clean)) imgs.push(clean);
      });
    }
    if (item['لینک مستقیم تصویر اصلی و باکیفیت کالا']) {
      const clean1 = upgradeAlibabaImageQuality(item['لینک مستقیم تصویر اصلی و باکیفیت کالا']);
      if (clean1 && !imgs.includes(clean1)) imgs.push(clean1);
    }
    if (item['لینک مستقیم تصویر 2 (زاویه دوم/بسته‌بندی)']) {
      const clean2 = upgradeAlibabaImageQuality(item['لینک مستقیم تصویر 2 (زاویه دوم/بسته‌بندی)']);
      if (clean2 && !imgs.includes(clean2)) imgs.push(clean2);
    }

    // Price
    const rawPrice = String(item.priceRange || item['قیمت پله‌ای عمده (دلار)'] || '');
    let parsedUsd = 32.5;
    const eurMatch = rawPrice.match(/€\s*([\d\.]+)/);
    const usdMatch = rawPrice.match(/\$\s*([\d\.]+)/);
    const numMatch = rawPrice.match(/([\d\.]+)/);
    if (eurMatch) {
      parsedUsd = Number((parseFloat(eurMatch[1]) * 1.09).toFixed(2));
    } else if (usdMatch) {
      parsedUsd = parseFloat(usdMatch[1]);
    } else if (numMatch) {
      parsedUsd = parseFloat(numMatch[1]);
    }

    // Specs
    const specs: Record<string, string> = {};
    if (Array.isArray(item.attributes)) {
      item.attributes.forEach((a: any) => {
        if (a.key && a.value) specs[a.key] = a.value;
      });
    } else if (typeof item['ویژگی‌های کلیدی و کاربردی (فارسی)'] === 'string') {
      item['ویژگی‌های کلیدی و کاربردی (فارسی)'].split('؛').forEach((part: string) => {
        const [k, v] = part.split(':');
        if (k && v) specs[k.trim()] = v.trim();
      });
    }

    setProductTitle(titleEn);
    setSourceUrl(src);
    setMoq(moqVal);
    setManualPrice(String(parsedUsd));
    setInputCurrency('USD');
    setSupplierName(sup);
    if (imgs.length > 0) setUploadedImages(imgs);
    if (Object.keys(specs).length > 0) setCustomSpecs(specs);

    setIngestMode('manual');
  };

  // Directly generate SEO and save item to catalog with 1-click
  const handleQuickAddFromQueue = async (item: any, queueIdx?: number) => {
    setIsProcessing(true);
    setProgressText('در حال آنالیز کالا و نگارش هوشمند محتوای سئو فارسی...');

    await new Promise((r) => setTimeout(r, 600));

    const titleEn = item.title || item['نام کامل محصول (انگلیسی)'] || 'Imported Wholesale Product';
    const src = item.source_url || item['لینک مستقیم محصول در سایت مبدأ'] || '';
    const moqVal = parseInt(item.moq || item['حداقل تیراژ سفارش (MOQ)'], 10) || 5;

    // Collect images
    const imgs: string[] = [];
    if (Array.isArray(item.images)) {
      item.images.forEach((u: string) => {
        const c = upgradeAlibabaImageQuality(u);
        if (c && !imgs.includes(c)) imgs.push(c);
      });
    }
    if (item['لینک مستقیم تصویر اصلی و باکیفیت کالا']) {
      const c1 = upgradeAlibabaImageQuality(item['لینک مستقیم تصویر اصلی و باکیفیت کالا']);
      if (c1 && !imgs.includes(c1)) imgs.push(c1);
    }
    if (item['لینک مستقیم تصویر 2 (زاویه دوم/بسته‌بندی)']) {
      const c2 = upgradeAlibabaImageQuality(item['لینک مستقیم تصویر 2 (زاویه دوم/بسته‌بندی)']);
      if (c2 && !imgs.includes(c2)) imgs.push(c2);
    }

    const fallbackImgs = imgs.length > 0 ? imgs : [
      'https://sc04.alicdn.com/kf/Heb8ce61c862442588719263ab2276ab93.jpg',
      'https://s.alicdn.com/@sc04/kf/H425d49fc85c4439b9922211b3558960ay.jpg',
    ];

    // Price
    const rawPrice = String(item.priceRange || item['قیمت پله‌ای عمده (دلار)'] || '');
    let baseUsd = 32.5;
    const eurMatch = rawPrice.match(/€\s*([\d\.]+)/);
    const usdMatch = rawPrice.match(/\$\s*([\d\.]+)/);
    const numMatch = rawPrice.match(/([\d\.]+)/);
    if (eurMatch) {
      baseUsd = Number((parseFloat(eurMatch[1]) * 1.09).toFixed(2));
    } else if (usdMatch) {
      baseUsd = parseFloat(usdMatch[1]);
    } else if (numMatch) {
      baseUsd = parseFloat(numMatch[1]);
    }

    // Dynamic SEO Generator for this SPECIFIC product
    const seo = generateSmartSeo(titleEn, undefined, src);
    const calculatedBaseToman = Math.round(baseUsd * currencyRates.usd * (1 + targetMarginPercent / 100));

    const newProd: ProductItem = {
      id: `TRD-2026-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString().split('T')[0],
      sourceUrl: src || 'https://www.alibaba.com',
      originalTitle: titleEn,
      faTitle: seo.titleFa,
      faShortDesc: seo.shortDesc,
      faFullDesc: seo.fullDesc,
      faFeatures: seo.features,
      technicalSpecs: seo.specs,
      category: seo.category,
      tags: seo.tags,
      mainImage: fallbackImgs[0],
      images: fallbackImgs,
      moq: moqVal,
      leadTimeDays: 7,
      costPerUnitUsd: Number(baseUsd.toFixed(2)),
      costPerUnitCny: Number((baseUsd * 7.24).toFixed(1)),
      costPerUnitAed: Number((baseUsd * 3.67).toFixed(1)),
      estimatedMarginPercent: targetMarginPercent,
      trendScore: Math.floor(94 + Math.random() * 5),
      isSyncedToSheets: true,
      isPostedToTelegram: false,
      tieredPricing: [
        {
          minQuantity: moqVal,
          maxQuantity: 99,
          priceUsd: Number(baseUsd.toFixed(2)),
          priceCny: Number((baseUsd * 7.24).toFixed(1)),
          priceAed: Number((baseUsd * 3.67).toFixed(1)),
          calculatedPriceToman: calculatedBaseToman,
        },
        {
          minQuantity: 100,
          maxQuantity: 999,
          priceUsd: Number((baseUsd * 0.97).toFixed(2)),
          priceCny: Number((baseUsd * 0.97 * 7.24).toFixed(1)),
          priceAed: Number((baseUsd * 0.97 * 3.67).toFixed(1)),
          calculatedPriceToman: Math.round(calculatedBaseToman * 0.97),
        },
        {
          minQuantity: 1000,
          priceUsd: Number((baseUsd * 0.94).toFixed(2)),
          priceCny: Number((baseUsd * 0.94 * 7.24).toFixed(1)),
          priceAed: Number((baseUsd * 0.94 * 3.67).toFixed(1)),
          calculatedPriceToman: Math.round(calculatedBaseToman * 0.94),
        },
      ],
      supplier: {
        name: item.supplierName || item['نام تأمین‌کننده / کارخانه'] || 'Shenzhen Penglianwei Trading Co., Ltd.',
        platform: src.includes('1688') ? '1688' : 'Alibaba',
        country: 'چین',
        city: 'شنژن',
        yearsInBusiness: 6,
        isVerified: true,
        hasTradeAssurance: true,
        rating: 4.2,
        responseRate: '≤1h',
        onTimeDeliveryRate: '≥95%',
        reviewCount: 420,
        trustScore: 94,
      },
    };

    onAddProduct(newProd);

    if (queueIdx !== undefined) {
      removeItemFromQueue(queueIdx);
    }

    setIsProcessing(false);
    onClose();
  };

  const handlePasteData = (text: string) => {
    setExtensionRawText(text);
    if (!text.trim()) return;

    // Check if TSV (row from Google Sheet)
    if (text.includes('\t')) {
      const cols = text.split('\t').map((c) => c.replace(/&#39;/g, "'").trim());
      if (cols.length >= 10) {
        const item = {
          title: (cols[3] || '').replace(/\s*-\s*Buy\s+Product\s+on\s+Alibaba.*$/i, '').trim(),
          source_url: cols[15] || '',
          moq: cols[8] || '5',
          priceRange: cols[9] || '32.50',
          'لینک مستقیم تصویر اصلی و باکیفیت کالا': cols[10] || '',
          'لینک مستقیم تصویر 2 (زاویه دوم/بسته‌بندی)': cols[11] || '',
          supplierName: cols[13] || 'Shenzhen Penglianwei Trading Co., Ltd.',
        };
        // Add to queue
        saveQueue([item, ...pendingQueue]);
        setExtensionRawText('');
        setIngestMode('queue');
        return;
      }
    }

    // Try parsing JSON
    try {
      const parsed = JSON.parse(text);
      if (parsed) {
        saveQueue([parsed, ...pendingQueue]);
        setExtensionRawText('');
        setIngestMode('queue');
      }
    } catch (e) {
      // not valid json
    }
  };

  // Submit the manual form
  const handleStartAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productTitle && !sourceUrl && !imageUrl && uploadedImages.length === 0) return;

    setIsProcessing(true);
    setProgressText('در حال تحلیل ویژگی‌ها و نگارش تخصصی عنوان و محتوای سئو...');

    await new Promise((r) => setTimeout(r, 700));

    const finalTitleEn = productTitle || 'Commercial Grade High Performance Wholesale Product';
    const seo = generateSmartSeo(finalTitleEn, customSpecs, sourceUrl);

    let baseUsd = Number(manualPrice) || 32.5;
    if (inputCurrency === 'CNY') {
      baseUsd = Number(manualPrice) / 7.24 || 32.5;
    } else if (inputCurrency === 'AED') {
      baseUsd = Number(manualPrice) / 3.67 || 32.5;
    }

    const calculatedBaseToman = Math.round(baseUsd * currencyRates.usd * (1 + targetMarginPercent / 100));

    const manualUrlImages = imageUrl
      .split(/[\n,;]+/)
      .map((u) => upgradeAlibabaImageQuality(u.trim()))
      .filter((u) => u.startsWith('http') || u.startsWith('data:'));

    const combinedImages = [...uploadedImages, ...manualUrlImages];
    const finalImages = combinedImages.length > 0 ? combinedImages : [
      'https://sc04.alicdn.com/kf/Heb8ce61c862442588719263ab2276ab93.jpg',
      'https://s.alicdn.com/@sc04/kf/H425d49fc85c4439b9922211b3558960ay.jpg',
    ];

    const newProduct: ProductItem = {
      id: `TRD-2026-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString().split('T')[0],
      sourceUrl: sourceUrl || 'https://www.alibaba.com',
      originalTitle: finalTitleEn,
      faTitle: seo.titleFa,
      faShortDesc: seo.shortDesc,
      faFullDesc: seo.fullDesc,
      faFeatures: seo.features,
      technicalSpecs: seo.specs,
      category: category || seo.category,
      tags: seo.tags,
      mainImage: finalImages[0],
      images: finalImages,
      moq: moq,
      leadTimeDays: 7,
      costPerUnitUsd: Number(baseUsd.toFixed(2)),
      costPerUnitCny: Number((baseUsd * 7.24).toFixed(1)),
      costPerUnitAed: Number((baseUsd * 3.67).toFixed(1)),
      estimatedMarginPercent: targetMarginPercent,
      trendScore: Math.floor(94 + Math.random() * 5),
      isSyncedToSheets: false,
      isPostedToTelegram: false,
      tieredPricing: [
        {
          minQuantity: moq,
          maxQuantity: 99,
          priceUsd: Number(baseUsd.toFixed(2)),
          priceCny: Number((baseUsd * 7.24).toFixed(1)),
          priceAed: Number((baseUsd * 3.67).toFixed(1)),
          calculatedPriceToman: calculatedBaseToman,
        },
        {
          minQuantity: 100,
          maxQuantity: 999,
          priceUsd: Number((baseUsd * 0.97).toFixed(2)),
          priceCny: Number((baseUsd * 0.97 * 7.24).toFixed(1)),
          priceAed: Number((baseUsd * 0.97 * 3.67).toFixed(1)),
          calculatedPriceToman: Math.round(calculatedBaseToman * 0.97),
        },
        {
          minQuantity: 1000,
          priceUsd: Number((baseUsd * 0.94).toFixed(2)),
          priceCny: Number((baseUsd * 0.94 * 7.24).toFixed(1)),
          priceAed: Number((baseUsd * 0.94 * 3.67).toFixed(1)),
          calculatedPriceToman: Math.round(calculatedBaseToman * 0.94),
        },
      ],
      supplier: {
        name: supplierName || 'Shenzhen Penglianwei Trading Co., Ltd.',
        platform: sourceUrl.includes('1688') ? '1688' : 'Alibaba',
        country: 'چین',
        city: 'شنژن',
        yearsInBusiness: supplierYears || 6,
        isVerified: true,
        hasTradeAssurance: true,
        rating: supplierRating || 4.2,
        responseRate: '≤1h',
        onTimeDeliveryRate: '≥95%',
        reviewCount: 380,
        trustScore: 92,
      },
    };

    onAddProduct(newProduct);
    setIsProcessing(false);
    resetForm();
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setUploadedImages((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-5 left-5 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-slate-950 font-bold shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>ورود سریع و ثبت کاتالوگ بازرگانی</span>
              {pendingQueue.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  {pendingQueue.length} کالا در صف
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              یکپارچه با افزونه کروم کالا‌یاب و تفکیک مستقل مشخصات هر کالا
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-800/80 rounded-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => setIngestMode('queue')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              ingestMode === 'queue'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>صف استخراج کالا‌یاب ({pendingQueue.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIngestMode('paste')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              ingestMode === 'paste'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>پیست سطر شیت یا JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setIngestMode('manual')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              ingestMode === 'manual'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>فرم دستی و لینک</span>
          </button>
        </div>

        {/* 1. QUEUE TAB (صف هوشمند کالاها) */}
        {ingestMode === 'queue' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>کالاهای منتظر در صف استخراج افزونه کروم:</span>
              </span>
              <div className="flex items-center gap-2">
                {pendingQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={clearEntireQueue}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition cursor-pointer px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20"
                    title="پاک کردن تمام کالاهای ذخیره شده در صف"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>پاکسازی کل صف</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={checkPendingQueue}
                  disabled={isCheckingQueue}
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer px-2.5 py-1 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingQueue ? 'animate-spin' : ''}`} />
                  <span>بروزرسانی از شیت</span>
                </button>
              </div>
            </div>

            {pendingQueue.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-2">
                <Zap className="w-8 h-8 text-amber-400/60 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">صف استخراج فعلاً خالی است</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  هر کالایی را در علی‌بابا یا 1688 با افزونه استخراج کنید یا ردیف آن را در تب «پیست» قرار دهید، فوراً اینجا با مشخصات و عکس اصلی ظاهر می‌شود.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {pendingQueue.map((item, idx) => {
                  const title = item.title_en || item.title || item.title_fa || 'محصول وارداتی جدید';
                  const img = item.image || (Array.isArray(item.images) && item.images[0]) || '';
                  const price = item.priceRange || item.price || 'استعلام روز';
                  const moqVal = item.moq || '5';

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-amber-500/40 transition flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {img ? (
                          <img
                            src={upgradeAlibabaImageQuality(img)}
                            alt=""
                            className="w-14 h-14 rounded-xl object-cover bg-slate-900 border border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 text-slate-500">
                            <Layers className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 space-y-1">
                          <h4 className="text-xs font-bold text-slate-100 line-clamp-1 leading-snug" title={title}>
                            {title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span className="text-amber-300 font-mono font-bold">قیمت: {price}</span>
                            <span>•</span>
                            <span>حداقل تیراژ: {moqVal}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickAddFromQueue(item, idx)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition cursor-pointer shadow-md flex items-center gap-1 disabled:opacity-50"
                          title="تولید خودکار سئو و ثبت مستقیم در کاتالوگ"
                        >
                          <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                          <span>ثبت با سئو خودکار</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => loadItemIntoForm(item)}
                          className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition cursor-pointer"
                          title="ویرایش دستی در فرم قبل از ثبت"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => removeItemFromQueue(idx)}
                          className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                          title="حذف از صف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. PASTE TAB (پیست مستقیم سطر شیت یا خروجی JSON) */}
        {ingestMode === 'paste' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 space-y-1">
              <strong className="block font-bold">📋 ورودی مستقیم داده‌ها:</strong>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                می‌توانید کل یک سطر کپی‌شده از گوگل شیت مرجع خود یا متن JSON خروجی افزونه را مستقیماً در کادر زیر پیست (Ctrl+V) کنید تا به صورت خودکار به صف اضافه شود.
              </p>
            </div>

            <textarea
              rows={5}
              placeholder="سطر کپی‌شده از گوگل شیت یا متن JSON افزونه را اینجا پیست کنید..."
              value={extensionRawText}
              onChange={(e) => handlePasteData(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-700 rounded-2xl p-3 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
              dir="ltr"
            />
          </div>
        )}

        {/* 3. MANUAL / EDIT FORM (فرم تفکیک‌شده و تمیز) */}
        {ingestMode === 'manual' && (
          <form onSubmit={handleStartAutomation} className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="font-bold text-slate-300">مشخصات کالا جهت تولید سئو و درج در کاتالوگ:</span>
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>فرم خالی (پاکسازی کامل)</span>
              </button>
            </div>

            {/* URL Input */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-amber-400" />
                <span>لینک کالا از علی‌بابا یا 1688:</span>
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.alibaba.com/product-detail/..."
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
              />
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                نام کامل محصول در علی‌بابا (انگلیسی یا فارسی):
              </label>
              <input
                type="text"
                value={productTitle}
                onChange={(e) => setProductTitle(e.target.value)}
                placeholder="مثال: 4K Pocket Action Camera with Rotating Screen"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
              />
            </div>

            {/* Images upload & preview */}
            <div className="space-y-2">
              <label className="block text-slate-300 font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>تصاویر محصول (آپلود مستقیم یا لینک):</span>
              </label>

              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-700">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setUploadedImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-rose-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="border-2 border-dashed border-slate-700 hover:border-amber-400/60 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer bg-slate-950/40 hover:bg-slate-950 transition group">
                  <Upload className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
                  <span className="text-xs font-semibold text-slate-200">انتخاب عکس از کامپیوتر</span>
                  <span className="text-[10px] text-slate-400">یا عکس را اینجا بکشید</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <textarea
                  rows={2}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="یا لینک مستقیم عکس‌ها را اینجا پیست کنید (https://...)"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 placeholder:text-slate-600 resize-none"
                />
              </div>
            </div>

            {/* Currency, Price, MOQ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">ارز خرید عمده:</label>
                <select
                  value={inputCurrency}
                  onChange={(e) => setInputCurrency(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="USD">دلار آمریکا (USD $)</option>
                  <option value="CNY">یوان چین (CNY ¥)</option>
                  <option value="AED">درهم امارات (AED)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">قیمت خرید عمده واحد:</label>
                <input
                  type="text"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="مثال: 32.50"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">حداقل سفارش (MOQ):</label>
                <input
                  type="number"
                  min={1}
                  value={moq}
                  onChange={(e) => setMoq(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Supplier Name */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">نام کارخانه / تأمین‌کننده در علی‌بابا:</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="مثال: Shenzhen Penglianwei Trading Co., Ltd."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isProcessing || (!productTitle && !sourceUrl)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{progressText}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                    <span>تولید محتوای سئو و ثبت نهایی در کاتالوگ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
