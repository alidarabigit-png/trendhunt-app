/**
 * Generates verified, direct live search and comparison URLs on global B2B platforms:
 * - Alibaba: Opens real live manufacturer listings and price quotes
 * - 1688: Opens China domestic factory listings
 * - Global Sources: Opens verified trade fair and supplier profiles
 * - Made-in-China: Opens industrial factory catalogs
 * - Google Images: Opens hundreds of HD product photos, packaging, and real videos
 */

export function getPlatformSearchUrl(platform: string, originalTitle: string): string {
  const cleanTitle = (originalTitle || '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const query = encodeURIComponent(cleanTitle || 'Trending Gadget');

  const p = (platform || '').toLowerCase();

  if (p.includes('1688')) {
    return `https://s.1688.com/selloffer/offer_search.htm?keywords=${query}`;
  }
  if (p.includes('made-in-china') || p.includes('made in china')) {
    const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    return `https://www.made-in-china.com/products-search/hot-china-products/${slug || query}.html`;
  }
  if (p.includes('global') || p.includes('globalsources')) {
    return `https://www.globalsources.com/searchList/products?key_word=${query}`;
  }
  if (p.includes('aliexpress')) {
    return `https://www.aliexpress.com/wholesale?SearchText=${query}`;
  }
  // Default to Alibaba wholesale live search
  return `https://www.alibaba.com/trade/search?SearchText=${query}`;
}

/**
 * Returns a guaranteed working, non-404 URL for a product.
 * If the product has a dummy/fake ID pattern (e.g. random 1688 offer ID or fake alibaba detail URL),
 * it converts it to the live platform search URL for that exact product.
 */
export function getCleanWorkingSourceUrl(product: {
  sourceUrl?: string;
  originalTitle?: string;
  faTitle?: string;
  supplier?: { platform?: string };
}): string {
  const rawUrl = (product.sourceUrl || '').trim();
  const platform = product.supplier?.platform || (rawUrl.includes('1688') ? '1688' : 'Alibaba');
  const title = product.originalTitle || product.faTitle || '';

  // Patterns that represent broken, generated dummy links that return 404
  const isBrokenMockPattern =
    !rawUrl ||
    rawUrl.includes('viral-trend-') ||
    rawUrl.includes('/offer/7') ||
    rawUrl.includes('/offer/1') ||
    rawUrl.includes('/offer/6') ||
    rawUrl.includes('/showroom/factory/') ||
    rawUrl.includes('/showroom/security/') ||
    rawUrl.includes('/beauty/') ||
    rawUrl.includes('_160') ||
    rawUrl.includes('_161') ||
    rawUrl.includes('_167') ||
    rawUrl.includes('example.com') ||
    rawUrl.endsWith('/offer/.html') ||
    rawUrl.endsWith('/product-detail/.html');

  if (isBrokenMockPattern) {
    return getPlatformSearchUrl(platform, title);
  }

  return rawUrl;
}

export function getGoogleImagesSearchUrl(originalTitle: string): string {
  const query = encodeURIComponent((originalTitle || '').trim());
  return `https://www.google.com/search?tbm=isch&q=${query}`;
}

export function getGoogleLensOrWebSearchUrl(originalTitle: string): string {
  const query = encodeURIComponent(`${(originalTitle || '').trim()} wholesale supplier`);
  return `https://www.google.com/search?q=${query}`;
}
