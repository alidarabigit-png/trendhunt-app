#!/usr/bin/env python3
"""
شکارچی روزانه NFS
Alibaba (از طریق ScraperAPI) -> Gemini (استخراج + ترجمه و سئوی فارسی)
-> api.php?action=ingest_products -> پست کانال تلگرام

اجرا:
  python scraper/hunt.py --dry-run --limit 2     # فقط نمایش، بدون ذخیره و بدون پست
  python scraper/hunt.py                          # اجرای کامل
  python scraper/hunt.py --from-json file.json    # فقط ارسال محصولات آماده (برای تست)

همه کلیدها فقط از متغیرهای محیطی (GitHub Secrets) خوانده می‌شوند.
"""
import argparse
import datetime
import json
import math
import os
import random
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

SITE = os.environ.get("NFS_SITE_URL", "https://nfs.nafisstore.com").rstrip("/")
INGEST_KEY = os.environ.get("NFS_INGEST_KEY", "")
SCRAPER_KEY = os.environ.get("SCRAPERAPI_KEY", "")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "")
MINIAPP_LINK = os.environ.get("MINIAPP_LINK", "") or SITE
MARGIN = float(os.environ.get("MARGIN_PERCENT", "45"))
QUERIES_PER_RUN = int(os.environ.get("QUERIES_PER_RUN", "2"))
MAX_PRODUCTS = int(os.environ.get("MAX_PRODUCTS", "5"))
# سقف تقریبی اعتبار ScraperAPI در هر اجرا (صفحه با render=true حدود ۱۰ اعتبار می‌خورد)
MAX_CREDITS = int(os.environ.get("MAX_CREDITS", "150"))

# جستجوهای دسته «گجت‌های هوشمند»؛ هر روز چند تا از این‌ها به نوبت انتخاب می‌شن
QUERIES = [
    "smart watch", "tws wireless earbuds", "smart home wifi plug", "smart ring health tracker",
    "mini projector portable", "smart led desk lamp", "fitness tracker band", "magnetic wireless charger",
    "ai translator earbuds", "mini drone camera", "bluetooth tracker tag", "portable neck fan",
    "wifi security camera", "rgb bluetooth speaker", "smart body scale",
]
CATEGORIES = ["گجت و لوازم دیجیتال", "صوتی و هوشمند", "خانه، ورزش و سلامت"]

_credits_used = 0


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- ScraperAPI
def scraperapi_get(url, render=False, retries=2):
    global _credits_used
    cost = 10 if render else 1
    if _credits_used + cost > MAX_CREDITS:
        log(f"  [سقف اعتبار] {_credits_used}/{MAX_CREDITS} — درخواست انجام نشد")
        return None
    params = {"api_key": SCRAPER_KEY, "url": url, "country_code": "us"}
    if render:
        params["render"] = "true"
    for i in range(retries + 1):
        try:
            _credits_used += cost
            r = requests.get("https://api.scraperapi.com/", params=params, timeout=90)
            if r.status_code == 200 and r.text:
                return r.text
            log(f"  ScraperAPI HTTP {r.status_code} برای {url[:80]}")
        except requests.RequestException as e:
            log(f"  ScraperAPI خطا: {e}")
        if _credits_used + cost > MAX_CREDITS:
            break
        time.sleep(3 * (i + 1))
    return None


# ------------------------------------------------------------------- Parsing
def _unescape(html):
    return html.replace("\\u002F", "/").replace("\\/", "/").replace("&amp;", "&")


PD_RE = re.compile(r'(?:https?:)?//(?:www\.)?alibaba\.com/product-detail/[^"\'\s<>\\)]+?_(\d{8,})\.html')


def extract_candidates(html):
    """لینک صفحه‌ی محصول‌های Alibaba از صفحه‌ی نتایج جستجو"""
    html = _unescape(html)
    seen, out = set(), []
    for m in PD_RE.finditer(html):
        pid = m.group(1)
        if pid in seen:
            continue
        seen.add(pid)
        url = m.group(0)
        if url.startswith("//"):
            url = "https:" + url
        out.append({"id": pid, "url": url})
    return out


IMG_RE = re.compile(r'(?:https?:)?//[a-z0-9.\-]*alicdn\.com/[^"\'\s<>\\)]+?\.(?:jpg|jpeg|png|webp)(?:_[^"\'\s<>\\)/]*)?', re.I)


def _clean_img(u):
    if u.startswith("//"):
        u = "https:" + u
    # حذف پسوند اندازه، مثل  ...jpg_80x80.jpg  ->  ...jpg
    return re.sub(r"(\.(?:jpg|jpeg|png|webp))_[^/]*$", r"\1", u, flags=re.I)


def extract_images(html, max_n=6):
    html = _unescape(html)
    soup = BeautifulSoup(html, "html.parser")
    urls = []
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        urls.append(_clean_img(og["content"]))
    kf, other = [], []
    for m in IMG_RE.finditer(html):
        u = _clean_img(m.group(0))
        low = u.lower()
        if any(x in low for x in ("/tps/", "@img", "logo", "icon", "sprite", "avatar", "flag")):
            continue
        (kf if "/kf/" in low else other).append(u)
    seen, out = set(), []
    for u in urls + kf + (other if not kf else []):
        if u not in seen:
            seen.add(u)
            out.append(u)
        if len(out) >= max_n:
            break
    return out


def page_text(html, limit=14000):
    html = _unescape(html)
    soup = BeautifulSoup(html, "html.parser")
    extra = []
    title = soup.title.get_text(strip=True) if soup.title else ""
    if title:
        extra.append("TITLE: " + title)
    for prop in ("og:title", "og:description"):
        t = soup.find("meta", property=prop)
        if t and t.get("content"):
            extra.append(prop.upper() + ": " + t["content"])
    for s in soup.find_all("script", type="application/ld+json"):
        if s.string:
            extra.append("JSON-LD: " + s.string.strip()[:3000])
    for t in soup(["script", "style", "noscript", "svg", "iframe"]):
        t.decompose()
    body = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
    return ("\n".join(extra) + "\nPAGE TEXT: " + body)[:limit]


# -------------------------------------------------------------------- Gemini
PROMPT = """You are a product data extractor and Persian e-commerce copywriter for an Iranian B2B wholesale catalog.
Below is the text of ONE Alibaba.com product page (English). Extract facts ONLY from this text. Never invent
prices, specs, certifications, warranties or supplier details. If something is not in the text, use null / [] / {}.

Return ONLY a JSON object with exactly these keys:
{
 "usable": true|false,            // false if this is not a single physical consumer product, or no USD price is visible
 "brandRisk": true|false,         // true if the listing uses third-party brand names/logos (Apple, AirPods, Samsung, Xiaomi, Sony, Dyson, ...) or says clone/replica/1:1/copy
 "originalTitle": "string",
 "tiers": [{"minQuantity": int, "priceUsd": number}],   // real price tiers from the page, ascending by minQuantity
 "moq": int|null,
 "soldCount": int|null,           // units sold / orders, only if shown
 "rating": number|null, "reviewCount": int|null,
 "supplier": {"name": "string|null", "country": "string|null", "city": "string|null", "yearsInBusiness": int|null,
              "isVerified": bool, "hasTradeAssurance": bool},
 "faTitle": "Persian SEO title, max 70 chars, product type + main feature, natural Persian",
 "faShortDesc": "Persian, max 160 chars",
 "faFullDesc": "Persian, 120-220 words, 2-3 short paragraphs, factual, no hype, no unverifiable claims",
 "faFeatures": ["5-8 short Persian bullet points taken from the page"],
 "technicalSpecs": {"Persian label": "value with units"},    // max 12 items, only real specs from the page
 "category": "one of: __CATEGORIES__",
 "tags": ["up to 8 Persian keywords"]
}
Persian rules: modern, fluent Persian; keep model numbers/Latin technical terms as is; use Persian punctuation;
do not mention Alibaba or the supplier name inside faTitle/faShortDesc/faFullDesc.

SOURCE URL: __URL__
__TEXT__
"""


def gemini_extract(url, text):
    prompt = (PROMPT.replace("__CATEGORIES__", " | ".join(CATEGORIES))
              .replace("__URL__", url).replace("__TEXT__", text))
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"},
    }
    for attempt in range(3):
        try:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                headers={"x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json"},
                json=body, timeout=120)
            if r.status_code == 200:
                raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
                return json.loads(raw)
            log(f"  Gemini HTTP {r.status_code}: {r.text[:200]}")
            if r.status_code in (429, 500, 503):
                time.sleep(10 * (attempt + 1))
                continue
            return None
        except (requests.RequestException, KeyError, IndexError, ValueError) as e:
            log(f"  Gemini خطا: {e}")
            time.sleep(5)
    return None


# ------------------------------------------------------------------- Mapping
def trend_score(g):
    """امتیاز ترند فقط از داده‌ی واقعی: تعداد فروش (در صورت وجود) و در غیر این صورت ۰"""
    sold = g.get("soldCount")
    if isinstance(sold, (int, float)) and sold > 0:
        return int(min(99, round(60 + 12 * math.log10(sold + 1))))
    return 0


def build_tiers(tiers, usd_rate):
    clean = []
    for t in tiers or []:
        try:
            q, p = int(t["minQuantity"]), float(t["priceUsd"])
        except (KeyError, TypeError, ValueError):
            continue
        if q >= 1 and p > 0:
            clean.append((q, p))
    clean = sorted(set(clean))
    if not clean:
        return []
    if len(clean) > 3:
        clean = [clean[0], clean[len(clean) // 2], clean[-1]]
    out = []
    for i, (q, p) in enumerate(clean):
        row = {
            "minQuantity": q,
            "priceUsd": round(p, 2),
            "marginPercent": MARGIN,
            "calculatedPriceToman": int(round(p * usd_rate * (1 + MARGIN / 100))),
        }
        if i + 1 < len(clean):
            row["maxQuantity"] = clean[i + 1][0] - 1
        out.append(row)
    return out


def to_product(cand, g, images, usd_rate):
    """خروجی Gemini را به فرمت ingest_products تبدیل می‌کند؛ اگر نامعتبر بود None"""
    if not g or not g.get("usable") or g.get("brandRisk"):
        return None, "unusable/brandRisk"
    tiers = build_tiers(g.get("tiers"), usd_rate)
    if not tiers:
        return None, "no price tiers"
    if not (g.get("faTitle") and g.get("originalTitle")):
        return None, "missing title"
    if not images:
        return None, "no images"
    sup = g.get("supplier") or {}
    cat = g.get("category") if g.get("category") in CATEGORIES else CATEGORIES[0]
    return {
        "externalId": f"alibaba:{cand['id']}",
        "sourceUrl": cand["url"],
        "originalTitle": g["originalTitle"],
        "faTitle": g["faTitle"],
        "faShortDesc": g.get("faShortDesc") or "",
        "faFullDesc": g.get("faFullDesc") or "",
        "faFeatures": g.get("faFeatures") or [],
        "technicalSpecs": g.get("technicalSpecs") or {},
        "category": cat,
        "tags": g.get("tags") or [],
        "images": images,
        "mainImage": images[0],
        "costPerUnitUsd": tiers[0]["priceUsd"],
        "moq": int(g.get("moq") or tiers[0]["minQuantity"]),
        "targetMarginPercent": MARGIN,
        "tieredPricing": tiers,
        "trendScore": trend_score(g),
        "supplier": {
            "name": sup.get("name") or "",
            "platform": "Alibaba.com",
            "country": sup.get("country") or "",
            "city": sup.get("city") or "",
            "yearsInBusiness": int(sup.get("yearsInBusiness") or 0),
            "isVerified": bool(sup.get("isVerified")),
            "hasTradeAssurance": bool(sup.get("hasTradeAssurance")),
            "rating": float(g.get("rating") or 0),
            "reviewCount": int(g.get("reviewCount") or 0),
        },
    }, None


# ---------------------------------------------------------------- NFS server
def nfs(path, method="GET", json_body=None, timeout=120):
    r = requests.request(method, f"{SITE}/api.php?action={path}",
                         headers={"X-Ingest-Key": INGEST_KEY, "Content-Type": "application/json"},
                         json=json_body, timeout=timeout)
    try:
        data = r.json()
    except ValueError:
        raise RuntimeError(f"پاسخ نامعتبر از {path}: HTTP {r.status_code} {r.text[:150]}")
    if r.status_code >= 400 or data.get("success") is False:
        raise RuntimeError(f"{path}: HTTP {r.status_code} {data}")
    return data


def get_usd_rate():
    r = requests.get(f"{SITE}/api.php?action=get_rates", timeout=30).json()
    if not r.get("isLive"):
        log("  هشدار: نرخ دلار زنده نیست، از آخرین نرخ ذخیره‌شده استفاده می‌شود")
    return float(r["usd"])


# ------------------------------------------------------------------- Hunting
def pick_queries():
    rnd = random.Random(datetime.date.today().toordinal())
    qs = QUERIES[:]
    rnd.shuffle(qs)
    return qs[:QUERIES_PER_RUN]


def hunt(limit, known, usd_rate):
    cands = []
    for q in pick_queries():
        url = ("https://www.alibaba.com/trade/search?fsb=y&IndexArea=product_en&tab=all&viewtype=G&SearchText="
               + requests.utils.quote(q))
        log(f"جستجو: {q}")
        html = scraperapi_get(url, render=True)
        if not html:
            continue
        found = extract_candidates(html)
        log(f"  {len(found)} لینک محصول پیدا شد")
        cands.append(found)
    # ادغام نوبتی نتایج جستجوها
    merged, seen = [], set()
    for i in range(max((len(c) for c in cands), default=0)):
        for c in cands:
            if i < len(c) and c[i]["id"] not in seen:
                seen.add(c[i]["id"])
                merged.append(c[i])
    fresh = [c for c in merged
             if f"alibaba:{c['id']}" not in known["externalIds"] and c["url"].lower().split("//")[-1].replace("www.", "") not in known["sourceUrls"]]
    log(f"کاندیدا: {len(merged)} | جدید (غیرتکراری): {len(fresh)}")
    if not merged:
        raise SystemExit("هیچ کاندیدایی از صفحه‌ی جستجو استخراج نشد (احتمال تغییر ساختار صفحه یا بلاک شدن).")

    products = []
    for cand in fresh:
        if len(products) >= limit:
            break
        log(f"محصول {cand['id']}")
        html = scraperapi_get(cand["url"], render=False)
        text = page_text(html) if html else ""
        if len(text) < 2500:
            log("  متن کم است، تلاش با render=true")
            html = scraperapi_get(cand["url"], render=True)
            text = page_text(html) if html else ""
        if not text:
            continue
        images = extract_images(html)
        g = gemini_extract(cand["url"], text)
        prod, why = to_product(cand, g, images, usd_rate)
        if not prod:
            log(f"  رد شد: {why}")
            continue
        log(f"  OK: {prod['faTitle']}  ({len(images)} عکس، {len(prod['tieredPricing'])} پله قیمت)")
        products.append(prod)
        time.sleep(2)
    log(f"اعتبار ScraperAPI مصرف‌شده (تقریبی): {_credits_used}")
    return products


# ------------------------------------------------------------------ Telegram
def tg_post(public_product):
    caption = (
        f"🔥 {public_product['faTitle']}\n\n"
        f"{public_product.get('faShortDesc', '')}\n\n"
        f"💰 قیمت عمده از {public_product['tieredPricing'][0]['calculatedPriceToman']:,} تومان\n"
        f"📦 حداقل سفارش: {public_product.get('moq', '')} عدد\n\n"
        "برای مشاهده مشخصات کامل و ثبت استعلام روی دکمه‌ی زیر بزنید."
    )[:1000]
    markup = {"inline_keyboard": [[{"text": "مشاهده و استعلام", "url": MINIAPP_LINK}]]}
    base = f"https://api.telegram.org/bot{BOT_TOKEN}"
    photo = public_product.get("mainImage")
    if photo:
        r = requests.post(base + "/sendPhoto", json={"chat_id": CHANNEL_ID, "photo": photo,
                                                      "caption": caption, "reply_markup": markup}, timeout=60)
        if r.ok and r.json().get("ok"):
            return True
        log(f"  sendPhoto ناموفق: {r.text[:150]}")
    r = requests.post(base + "/sendMessage", json={"chat_id": CHANNEL_ID, "text": caption,
                                                   "reply_markup": markup}, timeout=60)
    ok = r.ok and r.json().get("ok")
    if not ok:
        log(f"  sendMessage ناموفق: {r.text[:150]}")
    return bool(ok)


# ---------------------------------------------------------------------- Main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=MAX_PRODUCTS)
    ap.add_argument("--from-json", help="فایل JSON آماده‌ی محصولات (آرایه) برای ارسال بدون اسکرپ")
    ap.add_argument("--no-telegram", action="store_true")
    args = ap.parse_args()

    need = ["NFS_INGEST_KEY"] if args.from_json else ["NFS_INGEST_KEY", "SCRAPERAPI_KEY", "GEMINI_API_KEY"]
    missing = [k for k in need if not os.environ.get(k)]
    if missing:
        raise SystemExit("متغیرهای محیطی ناقص: " + ", ".join(missing))

    usd_rate = get_usd_rate()
    log(f"نرخ دلار: {usd_rate:,.0f} تومان | حاشیه سود: {MARGIN}%")

    if args.from_json:
        with open(args.from_json, encoding="utf-8") as f:
            products = json.load(f)
    else:
        known = nfs("ingest_known")
        log(f"محصولات موجود در کاتالوگ: {known.get('count')}")
        products = hunt(args.limit, known, usd_rate)

    if args.dry_run:
        print(json.dumps(products, ensure_ascii=False, indent=2)[:6000])
        log(f"dry-run: {len(products)} محصول آماده (ارسال نشد)")
        return
    if not products:
        log("محصول جدیدی برای ارسال نبود")
        return

    res = nfs("ingest_products", "POST", {"products": products, "cacheImages": True})
    log(f"ارسال به هاست: {res['added_count']} اضافه شد | رد شده: {res['skipped']}")
    added_ids = res.get("added_ids", [])
    if not added_ids or args.no_telegram or not (BOT_TOKEN and CHANNEL_ID):
        if added_ids and not args.no_telegram:
            log("توکن/کانال تلگرام تنظیم نشده؛ پست ارسال نشد")
        return

    pub = requests.get(f"{SITE}/api.php?action=get_products", timeout=60).json().get("products", [])
    by_id = {p["id"]: p for p in pub}
    posted = []
    for pid in added_ids:
        p = by_id.get(pid)
        if not p:
            continue
        if tg_post(p):
            posted.append(pid)
            log(f"  پست شد: {p['faTitle']}")
        time.sleep(3)
    if posted:
        nfs("mark_posted", "POST", {"ids": posted})
    log(f"پست‌شده در کانال: {len(posted)}/{len(added_ids)}")


if __name__ == "__main__":
    main()
