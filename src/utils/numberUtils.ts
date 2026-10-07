/**
 * English Digits & Numbers Formatter
 * Ensures all numbers, dates, prices, quantities, and Persian strings
 * render using standard English digits (0-9).
 */

export function toEnDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(persianDigits[i], String(i)).replaceAll(arabicDigits[i], String(i));
  }
  return result;
}

export function formatPriceEn(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '0';
  return toEnDigits(amount.toLocaleString('en-US'));
}

export function formatEnNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return toEnDigits(num.toLocaleString('en-US'));
}
