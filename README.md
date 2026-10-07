# نفیس‌استور | عمده‌یاب هوشمند تلگرام (TrendHunt B2B)

پنل مدیریت عمده‌فروشی B2B با هوش مصنوعی: شکار خودکار کالای ترند از Alibaba / 1688 / Made-in-China،
اعتبارسنجی تامین‌کننده، تولید محتوای سئو فارسی، جدول قیمت پلکانی ارزی (دلار/درهم/یوان)،
همگام‌سازی گوگل شیت، پیش‌نمایش مینی‌آپ تلگرام، تولید پست کانال و CRM مشتریان.

---

## پیش‌نیازها

- **Node.js 20+** (تست‌شده روی Node 24) یا **Bun**
- یک پروژه Firebase برای ورود با گوگل (فایل `firebase-applet-config.json`)
- کلید Gemini فقط برای ماژول «تحلیل رقبا» (اختیاری)

## نصب و اجرا

```bash
# روش ۱: npm
npm install
npm run dev          # سرور توسعه روی http://localhost:3000

# روش ۲: bun
bun install
bun run dev
```

سایر دستورها:

| دستور | توضیح |
| --- | --- |
| `npm run build` | ساخت نسخه production در `dist/` |
| `npm run start` | اجرای سرور (dev-server توسعه روی پورت ۳۰۰۰) |
| `npm run lint` | بررسی تایپ‌ها با `tsc --noEmit` |
| `npm run clean` | حذف `dist/` |

> اگر `npm install` خطای peer dependency دید، از `npm install --legacy-peer-deps` استفاده کنید
> (فایل قفل رسمی پروژه `bun.lock` است).

## متغیرهای محیطی (`.env`)

فایل `.env.example` را به `.env` کپی کنید:

```bash
GEMINI_API_KEY=...   # اختیاری – بدون آن /api/competitor-analysis از دیتاست آفلاین استفاده می‌کند
APP_URL=http://localhost:3000
PORT=3000            # پیش‌فرض 3000
```

## ساختار پروژه

```
server.ts                 سرور Express + میدل‌ور Vite + API ها
src/App.tsx               وضعیت سراسری، تب‌ها، توابع CRM و همگام‌سازی
src/components/           تب‌ها و مودال‌های رابط کاربری
src/services/
  firebaseAuth.ts         ورود/خروج گوگل و نگهداری توکن دسترسی
  googleSheets.ts         ساخت و پرکردن گوگل شیت + خروجی CSV
  currencyService.ts      دریافت نرخ زنده و ذخیره نرخ دستی
  geminiSourcing.ts       موتور شکار و اعتبارسنجی محصولات
  competitorAnalysis.ts   فراخوانی API تحلیل بازار ایران
src/utils/                سئوژنراتور فارسی و ابزار بهینه‌سازی تصویر
src/data/                 داده‌های نمونه محصول/مشتری/تاریخچه نرخ ارز
src/types/index.ts        تایپ‌های مشترک
```

## API های سرور

| متد | مسیر | توضیح |
| --- | --- | --- |
| GET | `/api/currency-rates` | نرخ زنده دلار/درهم/یوان (نرخ دستی ذخیره‌شده مقدم است) |
| POST | `/api/currency-rates` | `{usd, aed, cny}` ذخیره نرخ دستی |
| POST | `/api/competitor-analysis` | تحلیل قیمت و حاشیه سود بازار ایران با Gemini (با fallback آفلاین) |
| POST | `/api/telegram/verify` | بررسی اعتبار توکن ربات تلگرام (`getMe`) از سمت سرور |
| POST | `/api/telegram/broadcast` | ارسال پست (عکس/متن + دکمه‌ها) به کانال از سمت سرور |
| POST | `/api/extension/ingest` | دریافت محصول استخراج‌شده توسط افزونه‌ی کروم (صف در حافظه، تا ۵۰ مورد) |
| GET/DELETE | `/api/extension/pending[/:id]` | خواندن/حذف موارد صفِ افزونه |
| POST | `/api/sheets/fetch-queue` | پروکسی خواندن صف از Google Apps Script (بدون CORS) |
| GET/POST | `/api/catalog` | خواندن/ذخیره‌ی کاتالوگ کش‌شده برای مینی‌آپ تلگرام |
| GET | `/api/download-dist`، `/api/dist-base64` | دانلود خروجی build (zip یا base64) |

## اتصال‌ها

- **ورود گوگل / Google Sheets:** دامنه‌های `localhost` و دامنه اصلی سایت را در
  Firebase Console → Authentication → Settings → Authorized domains اضافه کنید.
  اسکوپ‌های لازم (`spreadsheets` و `drive.file`) در `firebaseAuth.ts` تعریف شده‌اند.
- **تلگرام:** توکن ربات و آیدی کانال را در تب «تولیدکننده پست کانال» وارد کنید؛
  آدرس مینی‌آپ باید با `APP_URL` یکی باشد.
- **مینی‌آپ تلگرام:** اسکریپت `telegram-web-app.js` در `index.html` بارگذاری شده است.

## نکات امنیتی مهم

1. **کلیدهای WooCommerce** (`consumerKey` / `consumerSecret`) به‌صورت پیش‌فرض در
   `src/App.tsx` قرار دارند و در باندل عمومی منتشر می‌شوند. پیش از استفاده واقعی،
   آن‌ها را به متغیر محیطی سرور منتقل کنید و انتشار محصول را از سرور انجام دهید
   (کلاینت اکنون فقط خروجی JSON/CSV و «شبیه‌سازی انتشار» دارد).
2. `firebase-applet-config.json` عمداً عمومی است (قوانین امنیت را در کنسول Firebase تنظیم کنید).
3. نرخ ارز و قیمت‌های تومانی هر ۲۵ ثانیه از سرور تازه می‌شوند؛ نرخ دستی تا زمان دکمه
   «بازگشت به نرخ زنده» روی سرور می‌ماند.

## استقرار (Deploy)

پروژه دو حالت دارد:

### ۱) هاست استاتیک (Netlify / Cloudflare Pages / Apache)

```bash
npm run build   # خروجی در dist/ — کل محتوای آن را آپلود کنید
```

فایل‌های مورد نیاز به‌صورت خودکار در `public/` تعریف شده و به `dist/` کپی می‌شوند:

| فایل | میزبان | کارکرد |
| --- | --- | --- |
| `_redirects` | Netlify / Cloudflare Pages | fallback مسیرها به `index.html` (SPA) |
| `_headers` | Netlify / Cloudflare Pages | هدرهای CORS برای فایل‌های استاتیک |
| `.htaccess` | Apache | fallback مسیرها + کش فایل‌های Vite |

> **نکته‌ی مهم:** در این حالت مسیرهای `/api/*` توسط هاست به `index.html` پاسخ داده می‌شوند؛
> کلاینت این وضعیت را تشخیص می‌دهد و نرخ ارز به‌صورت محلی محاسبه می‌شود، اما
> «تحلیل رقبا» (که به سرور Gemini نیاز دارد) و انتشار مستقیم WooCommerce کار نمی‌کنند.

### ۲) سرور کامل (توصیه‌شده برای همه‌ی امکانات)

```bash
npm run build
npm run start        # Express + Vite + /api/* روی PORT (پیش‌فرض 3000)
```

## عیب‌یابی سریع

| علت | راه‌حل |
| --- | --- |
| **ورود با حساب گوگل انجام نمی‌شود** (`auth/network-request-failed`) | سرورهای `identitytoolkit.googleapis.com` از شبکه شما فیلتر هستند؛ با اینترنت بدون فیلتر دوباره تلاش کنید. پیام Toast دقیقاً علت را اعلام می‌کند. |
| **محصولات شکارشده ثبت نمی‌شدند** | داده‌ها در `localStorage` (کلید `nfs_products_catalog`) ذخیره می‌شوند و با رفرش از بین نمی‌روند؛ فقط در همان مرورگر/دستگاه می‌مانند. |
| **ارسال خودکار به گوگل شیت انجام نشد** | این قابلیت نیازمند ورود موفق به حساب گوگل و ساخت/انتخاب شیت است؛ در غیر این صورت پیام هشدار نمایش داده می‌شود. |
| **دکمه «ارسال تست به کانال» خطا می‌دهد** | `api.telegram.org` باید از سرور شما در دسترس باشد؛ در غیر این صورت متن پست را کپی و دستی پست کنید. |

## وضعیت فعلی / کارهای باقی‌مانده

- داده‌های محصول/تنظیمات در `localStorage` مرورگر ذخیره می‌شوند (کلیدهای `nfs_products_catalog`، `nfs_theme`، `nfs_sheets_config`، `nfs_telegram_config`) و کاتالوگ از طریق `/api/catalog` روی سرور هم کش می‌شود؛
  بین مرورگرها یا کاربران همگام نمی‌شوند. برای چندکاربره واقعی، Firestore یا دیتابیس سرور لازم است.
- «انتشار مستقیم در nafisstore.com» فعلاً شبیه‌سازی است؛ انتشار واقعی از طریق
  WooCommerce REST API باید روی سرور (با CORS و کلیدها در سمت backend) پیاده شود.
- اجرای روزانه خودکار (GitHub Actions) فقط به‌صورت راهنما در تب «اتوماسیون» است.
