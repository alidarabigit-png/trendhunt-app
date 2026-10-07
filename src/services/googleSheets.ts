import { ProductItem } from '../types';
import { getAccessToken, getOrRefreshAccessToken } from './firebaseAuth';

export interface CreateSheetResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export async function listUserSpreadsheets(): Promise<DriveSpreadsheetFile[]> {
  try {
    const token = await getOrRefreshAccessToken();
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=15`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) {
      console.warn('Drive list files returned non-200:', res.status);
      return [];
    }
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn('Could not list drive spreadsheets:', err);
    return [];
  }
}

export const MASTER_SHEET_TITLE = 'پایگاه محصولات عمده - بازرگانی نفیس (Nafis Master Database)';

export async function trashDriveFile(fileId: string): Promise<boolean> {
  try {
    const token = await getOrRefreshAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trashed: true }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Failed to trash file:', e);
    return false;
  }
}

export async function renameDriveFile(fileId: string, newTitle: string): Promise<boolean> {
  try {
    const token = await getOrRefreshAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newTitle }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Failed to rename file:', e);
    return false;
  }
}

export interface ConsolidateResult {
  masterFileId: string;
  masterFileUrl: string;
  totalUniqueRows: number;
  trashedFilesCount: number;
  details: string[];
}

/**
 * Consolidates all disparate Google Sheets in Drive into ONE single authoritative master spreadsheet.
 * - Reads all unique items across every sheet
 * - Wipes duplicates using multi-attribute matcher
 * - Saves complete clean data into Master File
 * - Moves all duplicate/secondary sheets to Google Drive Trash
 * - Renames Master File to standard unified title
 */
export async function consolidateAllSheetsToOne(): Promise<ConsolidateResult> {
  const token = await getOrRefreshAccessToken();
  const files = await listUserSpreadsheets();

  if (!files || files.length === 0) {
    throw new Error('هیچ فایل شیت متعلق به این برنامه در گوگل درایو یافت نشد.');
  }

  const accumulatedUniqueRows: any[][] = [];
  const details: string[] = [];

  for (const file of files) {
    try {
      const targetSheetName = await getFirstSheetName(file.id, token);
      const readRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/'${encodeURIComponent(targetSheetName)}'!A2:U`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      let rows: any[][] = [];
      if (readRes.ok) {
        const d = await readRes.json();
        rows = d.values || [];
      } else {
        const fb = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/A2:U`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (fb.ok) {
          const d = await fb.json();
          rows = d.values || [];
        }
      }

      let fileAdded = 0;
      for (const row of rows) {
        if (!row || !row[2] || String(row[2]).trim().length === 0) continue;
        const dup = isDuplicateRow(row, accumulatedUniqueRows);
        if (!dup.isDup) {
          accumulatedUniqueRows.push(row);
          fileAdded++;
        }
      }
      details.push(`فایل «${file.name}»: ${rows.length} ردیف بررسی شد (${fileAdded} کالا افزوده شد)`);
    } catch (err) {
      console.warn(`Error reading file ${file.id}:`, err);
    }
  }

  // 1. Pick Master File (the one with the longest life or first in list)
  const masterFile = files[0];
  const secondaryFiles = files.slice(1);

  // 2. Clear Master File
  const masterSheetName = await getFirstSheetName(masterFile.id, token);
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${masterFile.id}/values:batchClear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ranges: [
            `'${masterSheetName}'!A2:Z2000`,
            `A2:Z2000`,
          ],
        }),
      }
    );
  } catch (e) {
    console.warn('Batch clear in master file failed', e);
  }

  // 3. Write all unified unique items to Master File
  if (accumulatedUniqueRows.length > 0) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${masterFile.id}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: `'${masterSheetName}'!A2:U${accumulatedUniqueRows.length + 1}`,
              values: accumulatedUniqueRows,
            },
          ],
        }),
      }
    );
  }

  // 4. Rename master file
  await renameDriveFile(masterFile.id, MASTER_SHEET_TITLE);

  // 5. Trash secondary duplicate files
  let trashedCount = 0;
  for (const sec of secondaryFiles) {
    const ok = await trashDriveFile(sec.id);
    if (ok) {
      trashedCount++;
      details.push(`فایل دوم «${sec.name}» با موفقیت به سطل بازیافت درایو منتقل شد.`);
    }
  }

  return {
    masterFileId: masterFile.id,
    masterFileUrl: `https://docs.google.com/spreadsheets/d/${masterFile.id}`,
    totalUniqueRows: accumulatedUniqueRows.length,
    trashedFilesCount: trashedCount,
    details,
  };
}

export const HEADERS = [
  'شناسه محصول',
  'تاریخ استخراج',
  'عنوان سئو فارسی',
  'عنوان اصلی انگلیسی',
  'دسته‌بندی',
  'پلتفرم منبع',
  'تامین‌کننده',
  'اعتبار تامین‌کننده',
  'سابقه (سال)',
  'ضمانت Trade Assurance',
  'تاییدیه Verified',
  'حداقل تیراژ سفارش (MOQ)',
  'قیمت مرجع واحد ($)',
  'جدول قیمت پلکانی عمده ($)',
  'قیمت پایه هر واحد (تومان)',
  'امتیاز ترند (از 100)',
  'توضیح کوتاه و نکات فروش',
  'مشخصات فنی و متریال',
  'لینک تصویر شاخص',
  'لینک منبع کالا',
  'وضعیت انتشار تلگرام',
];

export async function createWholesaleSpreadsheet(customTitle?: string): Promise<CreateSheetResponse> {
  const token = await getOrRefreshAccessToken();

  // Safety: If a spreadsheet already exists in Drive, reuse it instead of creating duplicates!
  const existingFiles = await listUserSpreadsheets();
  if (existingFiles && existingFiles.length > 0) {
    const existingMaster = existingFiles.find(
      (f) => f.name.includes('محصولات') || f.name.includes('Nafis')
    ) || existingFiles[0];

    if (existingMaster) {
      return {
        spreadsheetId: existingMaster.id,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${existingMaster.id}`,
        title: existingMaster.name,
      };
    }
  }

  const title = customTitle || MASTER_SHEET_TITLE;

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: 'محصولات ترند و تامین‌کنندگان',
            rightToLeft: true,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: HEADERS.map((h) => ({
                    userEnteredValue: { stringValue: h },
                    userEnteredFormat: {
                      backgroundColor: { red: 0.1, green: 0.2, blue: 0.35 },
                      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                      horizontalAlignment: 'CENTER',
                    },
                  })),
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `خطا در ایجاد شیت جدید (کد ${response.status})`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
    title: data.properties?.title || title,
  };
}

export function formatTieredPricingText(product: ProductItem): string {
  return product.tieredPricing
    .map((t) => {
      const qtyStr = t.maxQuantity ? `${t.minQuantity} تا ${t.maxQuantity} عدد` : `+${t.minQuantity} عدد`;
      return `${qtyStr}: $${t.priceUsd}`;
    })
    .join(' | ');
}

export function formatTechnicalSpecsText(product: ProductItem): string {
  return Object.entries(product.technicalSpecs)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' ؛ ');
}

export function productToSheetRow(product: ProductItem): (string | number)[] {
  return [
    product.id,
    product.createdAt,
    product.faTitle,
    product.originalTitle,
    product.category,
    product.supplier.platform,
    product.supplier.name,
    `${product.supplier.trustScore} از 100 (${product.supplier.rating} ستاره)`,
    product.supplier.yearsInBusiness,
    product.supplier.hasTradeAssurance ? 'دارد (تضمین مالی)' : 'ندارد',
    product.supplier.isVerified ? 'تایید رسمی دارد' : 'عادی',
    product.moq,
    product.costPerUnitUsd,
    formatTieredPricingText(product),
    product.tieredPricing[0]?.calculatedPriceToman || 0,
    product.trendScore,
    product.faShortDesc,
    formatTechnicalSpecsText(product),
    product.images && product.images.length > 0 ? product.images.join('\n') : product.mainImage,
    product.sourceUrl,
    product.isPostedToTelegram ? 'منتشر شده' : 'پیش‌نویس آماده',
  ];
}

export async function getFirstSheetName(spreadsheetId: string, token: string): Promise<string> {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta.sheets && meta.sheets.length > 0) {
        return meta.sheets[0].properties.title;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch spreadsheet metadata:', e);
  }
  return 'محصولات ترند و تامین‌کنندگان';
}

/**
 * Normalizes Persian, Arabic, and English text for duplicate detection:
 * - Removes invisible characters, soft hyphens, zero-width spaces
 * - Standardizes Arabic 'ي' and 'ك' to Persian 'ی' and 'ک'
 * - Converts Persian and Arabic numbers to English 0-9
 * - Removes ALL whitespace, punctuation, brackets, quotes, and symbols
 */
export function normalizeForDedup(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, '')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[آأإ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
    .replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728 + 48))
    .replace(/[\s\-_.,/#!$%^&*;:{}=`~()«»"'،؛؟\\[\]<>|\\?]+/g, '')
    .trim();
}

/**
 * Robust multi-attribute duplicate detector.
 * Identifies duplicates even if unique IDs are different:
 * 1. Matching Factory Source URL
 * 2. Matching Product Main Image URL
 * 3. Matching Original Factory Title (English/Chinese)
 * 4. Matching Persian Title (normalized exact or strong prefix/stem)
 * 5. Matching ID (if both are defined)
 */
export function isDuplicateRow(
  candidate: any[],
  existingRows: any[][]
): { isDup: boolean; matchedIndex?: number; reason?: string } {
  const cId = (candidate[0] || '').trim();
  const cFaTitle = normalizeForDedup(candidate[2] || '');
  const cOrigTitle = normalizeForDedup(candidate[3] || '');
  const cImage = (candidate[18] || '').trim().split('?')[0].replace(/^https?:\/\//, '');
  const cUrl = (candidate[19] || '').trim().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  for (let idx = 0; idx < existingRows.length; idx++) {
    const r = existingRows[idx];
    const rId = (r[0] || '').trim();
    const rFaTitle = normalizeForDedup(r[2] || '');
    const rOrigTitle = normalizeForDedup(r[3] || '');
    const rImage = (r[18] || '').trim().split('?')[0].replace(/^https?:\/\//, '');
    const rUrl = (r[19] || '').trim().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

    // Check 1: Explicit ID match
    if (cId && rId && cId === rId) {
      return { isDup: true, matchedIndex: idx, reason: `شناسه یکسان (${cId})` };
    }

    // Check 2: Direct Source Factory URL match
    if (cUrl && rUrl && cUrl.length > 8 && (cUrl === rUrl || cUrl.includes(rUrl) || rUrl.includes(cUrl))) {
      return { isDup: true, matchedIndex: idx, reason: `لینک منبع کارخانه یکسان` };
    }

    // Check 3: Main Image URL match
    if (cImage && rImage && cImage.length > 12 && (cImage === rImage || cImage.includes(rImage) || rImage.includes(cImage))) {
      return { isDup: true, matchedIndex: idx, reason: `تصویر محصول یکسان` };
    }

    // Check 4: Original Factory Title match
    if (cOrigTitle && rOrigTitle && cOrigTitle.length > 6 && (cOrigTitle === rOrigTitle || cOrigTitle.includes(rOrigTitle) || rOrigTitle.includes(cOrigTitle))) {
      return { isDup: true, matchedIndex: idx, reason: `عنوان انگلیسی منبع یکسان` };
    }

    // Check 5: Persian Title match (exact or prefix/stem)
    if (cFaTitle && rFaTitle && cFaTitle.length > 6) {
      if (cFaTitle === rFaTitle) {
        return { isDup: true, matchedIndex: idx, reason: `عنوان فارسی یکسان` };
      }
      const minLen = Math.min(cFaTitle.length, rFaTitle.length);
      const prefixCheckLen = Math.min(20, minLen);
      if (prefixCheckLen >= 10 && cFaTitle.substring(0, prefixCheckLen) === rFaTitle.substring(0, prefixCheckLen)) {
        return { isDup: true, matchedIndex: idx, reason: `شروع عنوان فارسی مشابه` };
      }
      if (cFaTitle.includes(rFaTitle) || rFaTitle.includes(cFaTitle)) {
        return { isDup: true, matchedIndex: idx, reason: `شامل عنوان فارسی مشابه` };
      }
    }
  }

  return { isDup: false };
}

export async function appendProductsToSheet(
  spreadsheetId: string,
  products: ProductItem[]
): Promise<{ updatedRows: number; skippedDuplicates: number; totalExisting: number }> {
  const token = await getOrRefreshAccessToken();
  const targetSheetName = await getFirstSheetName(spreadsheetId, token);

  // 1. Fetch full existing rows A2:U for comprehensive duplicate prevention
  const existingRange = encodeURIComponent(`'${targetSheetName}'!A2:U`);
  let existingRows: any[][] = [];
  try {
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${existingRange}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      existingRows = checkData.values || [];
    }
  } catch (e) {
    console.warn('Could not read existing rows for dedup check', e);
  }

  // Filter out any candidate product that matches any existing row in any dimension
  const uniqueProducts: ProductItem[] = [];
  const currentAccumulatedRows = [...existingRows];

  for (const p of products) {
    const candidateRow = productToSheetRow(p);
    const dupCheck = isDuplicateRow(candidateRow, currentAccumulatedRows);
    if (!dupCheck.isDup) {
      uniqueProducts.push(p);
      currentAccumulatedRows.push(candidateRow);
    }
  }

  const skippedDuplicates = products.length - uniqueProducts.length;

  if (uniqueProducts.length === 0) {
    return {
      updatedRows: 0,
      skippedDuplicates,
      totalExisting: existingRows.length,
    };
  }

  const rows = uniqueProducts.map((p) => productToSheetRow(p));

  const appendRange = encodeURIComponent(`'${targetSheetName}'!A1`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!response.ok) {
    const fallbackResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: rows,
        }),
      }
    );

    if (!fallbackResponse.ok) {
      const err = await fallbackResponse.json().catch(() => ({}));
      throw new Error(err.error?.message || `خطا در ذخیره در گوگل شیت (کد ${fallbackResponse.status})`);
    }

    const fallbackData = await fallbackResponse.json();
    return {
      updatedRows: fallbackData.updates?.updatedRows || uniqueProducts.length,
      skippedDuplicates,
      totalExisting: existingRows.length,
    };
  }

  const data = await response.json();
  return {
    updatedRows: data.updates?.updatedRows || uniqueProducts.length,
    skippedDuplicates,
    totalExisting: existingRows.length,
  };
}

export interface SheetAuditReport {
  initialCount: number;
  cleanedCount: number;
  removedDuplicatesCount: number;
  duplicateRows: {
    sheetRowNumber: number;
    title: string;
    id: string;
    originalTitle: string;
    reason: string;
    duplicateOfRowNumber: number;
  }[];
  uniqueRows: {
    sheetRowNumber: number;
    title: string;
    id: string;
    category: string;
    priceToman: number;
  }[];
}

export async function auditSheetDuplicates(spreadsheetId: string): Promise<SheetAuditReport> {
  const token = await getOrRefreshAccessToken();
  const targetSheetName = await getFirstSheetName(spreadsheetId, token);

  const readRange = encodeURIComponent(`'${targetSheetName}'!A2:U`);
  let res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${readRange}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  let dataRows: any[][] = [];
  if (res.ok) {
    const data = await res.json();
    dataRows = data.values || [];
  } else {
    const fallback = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:U`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (fallback.ok) {
      const data = await fallback.json();
      dataRows = data.values || [];
    }
  }

  const initialCount = dataRows.length;
  const uniqueRows: any[][] = [];
  const uniqueMetadata: SheetAuditReport['uniqueRows'] = [];
  const duplicateRows: SheetAuditReport['duplicateRows'] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || !row[2] || String(row[2]).trim().length === 0) continue;

    const dupCheck = isDuplicateRow(row, uniqueRows);
    if (dupCheck.isDup) {
      duplicateRows.push({
        sheetRowNumber: i + 2,
        title: String(row[2]),
        id: String(row[0] || 'بدون شناسه'),
        originalTitle: String(row[3] || ''),
        reason: dupCheck.reason || 'کالای تکراری',
        duplicateOfRowNumber: (dupCheck.matchedIndex ?? 0) + 2,
      });
    } else {
      uniqueRows.push(row);
      uniqueMetadata.push({
        sheetRowNumber: i + 2,
        title: String(row[2]),
        id: String(row[0] || ''),
        category: String(row[4] || ''),
        priceToman: parseInt(row[14], 10) || 0,
      });
    }
  }

  return {
    initialCount,
    cleanedCount: uniqueRows.length,
    removedDuplicatesCount: duplicateRows.length,
    duplicateRows,
    uniqueRows: uniqueMetadata,
  };
}

export async function cleanDuplicatesInSheet(
  spreadsheetId: string
): Promise<{ initialCount: number; cleanedCount: number; removedDuplicatesCount: number; details: string[] }> {
  const token = await getOrRefreshAccessToken();
  
  // 1. Fetch metadata to get both title and numeric sheetId
  let targetSheetName = 'محصولات ترند و تامین‌کنندگان';
  let sheetIdNumber = 0;
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta.sheets && meta.sheets.length > 0) {
        targetSheetName = meta.sheets[0].properties.title;
        sheetIdNumber = meta.sheets[0].properties.sheetId || 0;
      }
    }
  } catch (e) {
    console.warn('Metadata fetch error in cleaner:', e);
  }

  // 2. Fetch all data rows A2:U
  const readRange = encodeURIComponent(`'${targetSheetName}'!A2:U`);
  let res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${readRange}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  let dataRows: any[][] = [];
  if (res.ok) {
    const data = await res.json();
    dataRows = data.values || [];
  } else {
    const fallback = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:U`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!fallback.ok) {
      const err = await fallback.json().catch(() => ({}));
      throw new Error(err.error?.message || 'خطا در خواندن ردیف‌های شیت برای پاکسازی.');
    }
    const data = await fallback.json();
    dataRows = data.values || [];
  }

  const initialCount = dataRows.length;
  if (initialCount <= 1) {
    return { initialCount, cleanedCount: initialCount, removedDuplicatesCount: 0, details: [] };
  }

  // 3. Deduplicate rows using multi-attribute matcher
  const uniqueRows: any[][] = [];
  const removedDetails: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || !row[2] || String(row[2]).trim().length === 0) continue;

    const dupCheck = isDuplicateRow(row, uniqueRows);
    if (dupCheck.isDup) {
      const title = String(row[2]).substring(0, 35);
      removedDetails.push(`ردیف ${i + 2}: «${title}» (${dupCheck.reason})`);
      continue;
    }

    uniqueRows.push(row);
  }

  const removedDuplicatesCount = initialCount - uniqueRows.length;

  if (removedDuplicatesCount > 0) {
    // 4. BatchClear all data from row 2 to 2000
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ranges: [
              `'${targetSheetName}'!A2:Z2000`,
              `A2:Z2000`,
              `'${targetSheetName}'!2:2000`,
              `2:2000`,
            ],
          }),
        }
      );
    } catch (clearErr) {
      console.warn('BatchClear error:', clearErr);
    }

    // 5. Write back the unique rows using batchUpdate (POST with body, avoids URL range encoding)
    let writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: `'${targetSheetName}'!A2:U${uniqueRows.length + 1}`,
              values: uniqueRows,
            },
          ],
        }),
      }
    );

    if (!writeRes.ok) {
      // Fallback range A2
      writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: [
              {
                range: `A2:U${uniqueRows.length + 1}`,
                values: uniqueRows,
              },
            ],
          }),
        }
      );
      if (!writeRes.ok) {
        const err = await writeRes.json().catch(() => ({}));
        throw new Error(err.error?.message || 'خطا در ثبت ردیف‌های پاکسازی‌شده در شیت.');
      }
    }

    // 6. Physically delete leftover empty rows from the sheet using deleteDimension
    try {
      const startDeleteIndex = uniqueRows.length + 1; // 0-indexed: row after last unique product
      const endDeleteIndex = initialCount + 2;
      if (endDeleteIndex > startDeleteIndex) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetIdNumber,
                    dimension: 'ROWS',
                    startIndex: startDeleteIndex,
                    endIndex: endDeleteIndex,
                  },
                },
              },
            ],
          }),
        });
      }
    } catch (delErr) {
      console.warn('Physical deleteDimension optional error:', delErr);
    }
  }

  return {
    initialCount,
    cleanedCount: uniqueRows.length,
    removedDuplicatesCount,
    details: removedDetails,
  };
}

export function exportProductsToCSV(products: ProductItem[], filename = 'trending_wholesale_products.csv') {
  const csvRows = [
    HEADERS.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...products.map((p) =>
      productToSheetRow(p)
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ];

  const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function readProductsFromSheet(
  spreadsheetId: string,
  currentUsdRate: number = 85000
): Promise<ProductItem[]> {
  const token = await getOrRefreshAccessToken();

  let targetSheetName = 'محصولات ترند و تامین‌کنندگان';
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta.sheets && meta.sheets.length > 0) {
        targetSheetName = meta.sheets[0].properties.title;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch spreadsheet metadata, using default tab title', e);
  }

  const range = encodeURIComponent(`'${targetSheetName}'!A2:U`);
  let response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  let dataRows: any[][] = [];
  if (response.ok) {
    const data = await response.json();
    dataRows = data.values || [];
  } else {
    // Fallback to simple range A2:U without tab title
    const fallbackRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:U`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!fallbackRes.ok) {
      const err = await fallbackRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'خطا در خواندن اطلاعات از گوگل شیت.');
    }
    const data = await fallbackRes.json();
    dataRows = data.values || [];
  }

  // Deduplicate raw rows using multi-attribute matcher before mapping
  const uniqueDataRows: any[][] = [];
  for (const row of dataRows) {
    if (!row || !row[2] || String(row[2]).trim().length === 0) continue;
    if (!isDuplicateRow(row, uniqueDataRows).isDup) {
      uniqueDataRows.push(row);
    }
  }

  const items: ProductItem[] = uniqueDataRows.map((row, idx) => {
    const id = row[0] || `SHEET-${Date.now()}-${idx}`;
    const createdAt = row[1] || new Date().toISOString().split('T')[0];
    const faTitle = String(row[2]);
    const originalTitle = row[3] ? String(row[3]) : faTitle;
    const category = row[4] ? String(row[4]) : 'عمومی و کاربردی';
    const platform = (row[5] as any) || '1688';
    const supplierName = row[6] ? String(row[6]) : 'تامین‌کننده شیت';
    const moq = parseInt(row[11], 10) || 10;
    const costPerUnitUsd = parseFloat(row[12]) || 12;
    const tomanPrice = parseInt(row[14], 10) || Math.round(costPerUnitUsd * currentUsdRate * 1.5);
    const trendScore = parseInt(row[15], 10) || 90;
    const faShortDesc = row[16] ? String(row[16]) : '';
    const rawImagesCell = row[18] ? String(row[18]).trim() : '';
    const parsedImages = rawImagesCell
      .split(/[\n,;]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));

    const images = parsedImages.length > 0
      ? parsedImages
      : ['https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80'];
    const mainImage = images[0];

    const sourceUrl = row[19] ? String(row[19]) : 'https://1688.com';
    const isPosted = row[20] === 'منتشر شده';

    return {
      id,
      createdAt,
      faTitle,
      originalTitle,
      category,
      supplier: {
        name: supplierName,
        platform,
        yearsInBusiness: parseInt(row[8], 10) || 5,
        rating: 4.8,
        trustScore: 95,
        hasTradeAssurance: row[9]?.includes('دارد') ?? true,
        isVerified: row[10]?.includes('تایید') ?? true,
        city: 'گوانگجو',
        country: 'چین',
        responseRate: '98٪',
        onTimeDeliveryRate: '99٪',
        reviewCount: 120,
      },
      moq,
      leadTimeDays: 7,
      costPerUnitUsd,
      tieredPricing: [
        {
          minQuantity: moq,
          maxQuantity: moq * 5,
          priceUsd: costPerUnitUsd,
          calculatedPriceToman: tomanPrice,
          marginPercent: 50,
        },
        {
          minQuantity: moq * 5 + 1,
          maxQuantity: moq * 20,
          priceUsd: Number((costPerUnitUsd * 0.9).toFixed(2)),
          calculatedPriceToman: Math.round(tomanPrice * 0.9),
          marginPercent: 40,
        },
        {
          minQuantity: moq * 20 + 1,
          priceUsd: Number((costPerUnitUsd * 0.8).toFixed(2)),
          calculatedPriceToman: Math.round(tomanPrice * 0.8),
          marginPercent: 30,
        },
      ],
      trendScore,
      estimatedMarginPercent: 50,
      technicalSpecs: { 'منبع': 'گوگل شیت اختصاصی درایو' },
      faFeatures: [faShortDesc || 'محصول ترند با پتانسیل فروش بالا در تلگرام'],
      faShortDesc: faShortDesc || faTitle,
      faFullDesc: faShortDesc || faTitle,
      mainImage,
      images,
      sourceUrl,
      tags: [category, 'ترند', 'عمده'],
      isSyncedToSheets: true,
      isPostedToTelegram: isPosted,
    };
  });

  return items;
}
