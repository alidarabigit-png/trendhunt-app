import { ProductItem } from '../types/index';

/**
 * Normalizes Persian, Arabic, and English text for bulletproof duplicate detection.
 * Unifies characters, numbers, removes punctuation, ZWNJ, and extra spaces.
 */
export function normalizeProductTitle(title: string): string {
  if (!title) return '';

  let text = title.toLowerCase();

  // 1. Unify Persian and Arabic digits to standard English digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    text = text.replaceAll(persianDigits[i], String(i));
    text = text.replaceAll(arabicDigits[i], String(i));
  }

  // 2. Unify Persian / Arabic letter variations
  text = text
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replaceAll('ة', 'ه')
    .replaceAll('آ', 'ا')
    .replaceAll('أ', 'ا')
    .replaceAll('إ', 'ا')
    .replaceAll('ئ', 'ی')
    .replaceAll('ؤ', 'و');

  // 3. Remove Zero-Width Non-Joiner (نیم‌فاصله), soft hyphens, control chars
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');

  // 4. Remove all punctuation, brackets, symbols, emojis, keep only Persian/Arabic & alphanumeric
  text = text.replace(/[^\u0600-\u06FFa-z0-9]/g, '');

  return text.trim();
}

/**
 * Extracts a distinctive fingerprint set of significant keywords from a title.
 * Ignores generic filler words like "طرح", "مدل", "جدید", "های", etc.
 */
function extractTitleKeywords(title: string): Set<string> {
  const normalized = normalizeProductTitle(title);
  if (!normalized) return new Set();

  const stopWords = new Set([
    'مدل', 'طرح', 'سری', 'جدید', 'اصل', 'اورجینال', 'با', 'در', 'برای', 'از',
    'های', 'این', 'آن', 'کالا', 'محصول', 'فروش', 'عمده', 'قیمت', 'تومان', 'تخفیف'
  ]);

  // Tokenize by word breaks in the original text first
  const rawWords = (title || '')
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => normalizeProductTitle(w))
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  return new Set(rawWords);
}

/**
 * Extracts offer/product ID from 1688, Alibaba, Made-in-China URLs if present
 */
function extractSourceId(url: string): string | null {
  if (!url) return null;
  const match1688 = url.match(/offer\/(\d+)\.html/);
  if (match1688) return match1688[1];

  const matchAli = url.match(/_(\d{8,})\.html/);
  if (matchAli) return matchAli[1];

  return null;
}

/**
 * Evaluates whether two products are identical or duplicates.
 * Checks ID, exact normalized titles, source URLs, and semantic keyword overlap.
 */
export function areProductsDuplicate(a: ProductItem, b: ProductItem): boolean {
  if (!a || !b) return false;

  // 1. Exact ID match
  const idA = (a.id || '').trim();
  const idB = (b.id || '').trim();
  if (idA && idB && idA.toLowerCase() === idB.toLowerCase()) return true;

  // 2. Normalized Persian title match
  const faA = normalizeProductTitle(a.faTitle || '');
  const faB = normalizeProductTitle(b.faTitle || '');
  if (faA && faB && faA === faB) return true;

  // 3. Normalized English title match
  const enA = normalizeProductTitle(a.originalTitle || '');
  const enB = normalizeProductTitle(b.originalTitle || '');
  if (enA && enB && enA === enB) return true;

  // 4. Source URL offer ID match
  const srcA = extractSourceId(a.sourceUrl || '');
  const srcB = extractSourceId(b.sourceUrl || '');
  if (srcA && srcB && srcA === srcB) return true;

  // 5. High keyword overlap match (fuzzy detection for title variations)
  const kwA = extractTitleKeywords(a.faTitle || '');
  const kwB = extractTitleKeywords(b.faTitle || '');
  if (kwA.size >= 3 && kwB.size >= 3) {
    let intersection = 0;
    for (const k of kwA) {
      if (kwB.has(k)) intersection++;
    }
    const smaller = Math.min(kwA.size, kwB.size);
    // If over 70% of distinctive keywords overlap, consider duplicate
    if (intersection / smaller >= 0.7) {
      return true;
    }
  }

  return false;
}

/**
 * Filters out any incoming products that already exist in the catalog.
 * Guarantees that only genuinely new products are added.
 */
export function filterNewProducts(incoming: ProductItem[], existing: ProductItem[]): ProductItem[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return [];
  if (!Array.isArray(existing) || existing.length === 0) return incoming;

  const result: ProductItem[] = [];

  for (const item of incoming) {
    if (!item) continue;
    // Check against existing products
    const alreadyExists = existing.some((ex) => areProductsDuplicate(item, ex));
    if (alreadyExists) continue;

    // Check against items already accepted in this batch
    const alreadyInBatch = result.some((res) => areProductsDuplicate(item, res));
    if (alreadyInBatch) continue;

    result.push(item);
  }

  return result;
}

/**
 * Cleans an existing product list by removing any duplicate items.
 * Keeps the earlier (or original) version of each product.
 */
export function deduplicateProducts(items: ProductItem[]): ProductItem[] {
  if (!Array.isArray(items)) return [];

  const unique: ProductItem[] = [];

  for (const item of items) {
    if (!item) continue;
    const isDup = unique.some((u) => areProductsDuplicate(item, u));
    if (!isDup) {
      unique.push(item);
    }
  }

  return unique;
}
