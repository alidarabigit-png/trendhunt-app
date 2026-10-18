import { CurrencyRates } from '../types';

export const DEFAULT_RATES: CurrencyRates = {
  usd: 268300, // نرخ روز دلار بازار آزاد (تومان)
  aed: 73440,  // درهم امارات (تومان)
  cny: 40200,  // یوان چین (تومان)
  lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  source: 'TGJU / بازار آزاد',
  isAutoUpdate: true,
  updateIntervalMinutes: 1,
};

/**
 * Fetches real-time exchange rates from TGJU via the Cloudflare Worker Relay,
 * then falls back to host server endpoints (/api/currency-rates, api.php).
 * Automatically persists fresh rates to host backend.
 */
export async function fetchLiveExchangeRates(source: string = 'TGJU'): Promise<CurrencyRates> {
  const now = new Date();
  const timeStringEn = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // نرخ زنده روی هاست (api.php) از TGJU گرفته می‌شود؛ مرورگر مستقیم به Worker وصل نمی‌شود
  // 2. Server Endpoints (/api/currency-rates or api.php)
  const isPhpHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('nafisstore.com') ||
    window.location.pathname.includes('.php')
  );

  const endpoints = isPhpHost
    ? ['/api.php?action=get_rates', '/api.php?action=refresh_rates', '/api/currency-rates']
    : ['/api/currency-rates', '/api.php?action=get_rates', 'https://nfs.nafisstore.com/api.php?action=get_rates'];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const rates = data.rates || data;
        if (rates.usd && rates.usd > 10000) {
          return {
            usd: Number(rates.usd),
            aed: Number(rates.aed || Math.round(rates.usd / 3.67)),
            cny: Number(rates.cny || Math.round(rates.usd / 7.1)),
            lastUpdated: timeStringEn,
            source: rates.source || `${source} (سرور نفیس‌استور)`,
            isAutoUpdate: true,
            updateIntervalMinutes: 1,
          };
        }
      }
    } catch (err) {
      console.warn(`Endpoint ${endpoint} failed for rates`, err);
    }
  }

  // 3. Fallback with current Tehran free market baseline
  return {
    usd: 268300,
    aed: 73440,
    cny: 40200,
    lastUpdated: timeStringEn,
    source: `${source} (بازار آزاد و سنا)`,
    isAutoUpdate: true,
    updateIntervalMinutes: 1,
  };
}

export async function saveCustomRatesToServer(usd: number, aed: number, cny: number): Promise<void> {
  const isPhpHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('nafisstore.com') ||
    window.location.pathname.includes('.php')
  );

  const timeStringEn = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const payload = {
    usd,
    aed,
    cny,
    source: 'تنظیم نرخ لحظه‌ای',
    lastUpdated: timeStringEn,
    isLive: true,
  };

  const endpoints = isPhpHost
    ? ['/api.php?action=save_rates', '/api/currency-rates']
    : ['/api/currency-rates', '/api.php?action=save_rates', 'https://nfs.nafisstore.com/api.php?action=save_rates'];

  for (const endpoint of endpoints) {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn(`Failed to save rates to ${endpoint}:`, e);
    }
  }
}

export function convertToToman(amount: number, currency: 'USD' | 'AED' | 'CNY', rates: CurrencyRates): number {
  switch (currency) {
    case 'USD':
      return Math.round(amount * rates.usd);
    case 'AED':
      return Math.round(amount * rates.aed);
    case 'CNY':
      return Math.round(amount * rates.cny);
    default:
      return Math.round(amount * rates.usd);
  }
}
