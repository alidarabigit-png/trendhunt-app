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
GEMINI_KEYS = [k.strip() for k in os.environ.get("GEMINI_API_KEY", "").replace("\n", ",").split(",") if k.strip()]
GEMINI_KEY = GEMINI_KEYS[0] if GEMINI_KEYS else ""
GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or "gemini-3.8-flash"
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "")
MINIAPP_LINK = os.environ.get("MINIAPP_LINK", "") or SITE
MARGIN = float(os.environ.get("MARGIN_PERCENT", "50"))
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
    # حذف پسوند اندازه، مثل ...jpg_80x80.jpg -> ...jpg
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
Below is the text of ONE wholesale product page from __SITE__ (the text may be English or Chinese; translate to Persian). Extract facts ONLY from this text. Never invent
prices, specs, certifications, warranties or supplier details. If something is not in the text, use null / [] / {}.

Return ONLY a JSON object with exactly these keys:
{
 "usable": true|false,            // false if this is not a single physical consumer product, or no price at all is visible on the page
 "brandRisk": true|false,         // true ONLY if the product itself is sold under a third-party brand name/logo (Apple, AirPods, Samsung, Xiaomi, Sony, Dyson, ...) or is described as clone/replica/1:1/copy.
                                  // Compatibility mentions ("for iPhone", "MagSafe compatible", "Find My", "Qi2", "Android/iOS") are NOT brand risk.
 "rejectReason": "short English reason if usable=false or brandRisk=true, otherwise null",
 "originalTitle": "string",
 "currency": "ISO code of the currency the page shows prices in (USD, EUR, GBP, CNY, ...). Do NOT convert; copy prices exactly as shown. On 1688.com the symbol ¥/￥/元 always means CNY.",
 "tiers": [{"minQuantity": int, "price": number}],   // real price tiers from the page IN THAT CURRENCY, ascending by minQuantity. A single price or range "X-Y" => one tier with minQuantity = MOQ and price = lower value
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
do not mention Alibaba, 1688, Made-in-China or the supplier name inside faTitle/faShortDesc/faFullDesc.

Chinese-page hints: 起批量/起订量 = MOQ; "≥N件 ¥X" = tier from N pieces at price X; 成交/已售 = sold count; 诚信通/实力商家 = verified supplier. Supplier country for 1688 is China.

SOURCE URL: __URL__
__TEXT__
"""

QUOTA_HITS = 0   # تعداد دفعاتی که سهمیه قطعی تمام شده است
_EXH = set()     # ترکیب‌های (شماره کلید، مدل) که سهمیه‌ی روزانه‌شان تمام شده؛ سهمیه برای هر مدل جداست


def _models():
    fb = os.environ.get("GEMINI_FALLBACK_MODELS", "gemini-flash-latest")
    return [GEMINI_MODEL] + [m.strip() for m in fb.split(",") if m.strip() and m.strip() != GEMINI_MODEL]


def _combos(skip):
    """ترکیب‌های (کلید، مدل) قابل استفاده؛ اول مدل اصلی روی همه‌ی کلیدها، بعد مدل‌های جایگزین"""
    return [(ki, m) for m in _models() for ki in range(len(GEMINI_KEYS))
            if (ki, m) not in _EXH and (ki, m) not in skip]


def gemini_extract(url, text, site_name="Alibaba.com"):
    global QUOTA_HITS
    prompt = (PROMPT.replace("__CATEGORIES__", " | ".join(CATEGORIES))
              .replace("__SITE__", site_name).replace("__URL__", url).replace("__TEXT__", text))
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"},
    }
    skip = set()      # ترکیب‌هایی که در همین محصول خطای موقت دادند
    for attempt in range(10):
        avail = _combos(skip)
        if not avail:
            if all((ki, m) in _EXH for m in _models() for ki in range(len(GEMINI_KEYS))):
                QUOTA_HITS = 2
            return None
        ki, model = avail[0]
        try:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": GEMINI_KEYS[ki], "Content-Type": "application/json"},
                json=body, timeout=75)

            if r.status_code == 200:
                raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
                QUOTA_HITS = 0
                return json.loads(raw)

            log(f"  Gemini[{model}#{ki + 1}] HTTP {r.status_code}: {r.text[:160]}")

            if r.status_code in (400, 404):          # مدل نامعتبر برای این کلید
                _EXH.add((ki, model))
                continue
            if r.status_code in (500, 503):           # شلوغی گوگل: ترکیب بعدی، با کمی مکث
                skip.add((ki, model))
                time.sleep(3)
                continue
            if r.status_code == 429:
                t = r.text.lower()
                daily = any(x in t for x in ("perday", "per day", "daily"))
                m = re.search(r"retry in ([\d.]+)s", t)
                if m and float(m.group(1)) > 90:
                    daily = True
                if daily:
                    _EXH.add((ki, model))
                    log(f"  سهمیه‌ی روزانه‌ی «{model}» برای کلید {ki + 1} تمام شد")
                else:
                    skip.add((ki, model))             # سقف دقیقه: ترکیب بعدی
                    if len(avail) <= 1:
                        log("  محدودیت نرخ دقیقه (RPM)؛ ۲۰ ثانیه توقف...")
                        time.sleep(20)
                        skip.clear()
                continue
            return None
        except (requests.RequestException, KeyError, IndexError, ValueError) as e:
            log(f"  Gemini[{model}#{ki + 1}] خطا: {e}")
            skip.add((ki, model))
            time.sleep(3)
    return None


# ------------------------------------------------------------------- Mapping
def trend_score(g):
    """امتیاز ترند فقط از داده‌ی واقعی: تعداد فروش (در صورت وجود) و در غیر این صورت ۰"""
    sold = g.get("soldCount")
    if isinstance(sold, (int, float)) and sold > 0:
        return int(min(99, round(60 + 12 * math.log10(sold + 1))))
    return 0


_FX = {}


def to_usd_factor(cur):
    """نرخ تبدیل ارز نمایش‌داده‌شده به دلار (از open.er-api.com)؛ None اگر در دسترس نبود"""
    cur = (cur or "USD").upper().strip()
    if cur in ("USD", "US$", "$"):
        return 1.0
    if not _FX:
        try:
            r = requests.get("https://open.er-api.com/v6/latest/USD", timeout=20)
            _FX.update(r.json().get("rates") or {})
        except Exception as e:
            log(f"  FX خطا: {e}")
    rate = _FX.get(cur)
    return (1.0 / rate) if rate else None


def build_tiers(tiers, usd_rate, factor=1.0):
    clean = []
    for t in tiers or []:
        try:
            q = int(t["minQuantity"])
            p = float(t.get("price", t.get("priceUsd"))) * factor
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
    if not g:
        return None, "gemini-error"
    if g.get("brandRisk"):
        return None, "brandRisk: " + str(g.get("rejectReason") or "—")[:120]
    if not g.get("usable"):
        return None, "unusable: " + str(g.get("rejectReason") or "—")[:120]
    factor = to_usd_factor(g.get("currency"))
    if factor is None:
        return None, f"unknown currency {g.get('currency')}"
    tiers = build_tiers(g.get("tiers"), usd_rate, factor)
    if not tiers:
        return None, "no price tiers"
    if g.get("currency") and str(g["currency"]).upper() != "USD":
        log(f"  قیمت از {g['currency']} به USD تبدیل شد (ضریب {factor:.4f})")
    if not (g.get("faTitle") and g.get("originalTitle")):
        return None, "missing title"
    if not images:
        return None, "no images"
    sup = g.get("supplier") or {}
    cat = g.get("category") if g.get("category") in CATEGORIES else CATEGORIES[0]
    return {
        "externalId": cand.get("externalId") or f"alibaba:{cand['id']}",
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
            "platform": cand.get("platform") or "Alibaba.com",
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
    if str(r.get("source", "")).startswith("default"):
        raise SystemExit("نرخ دلار روی هاست تنظیم نشده (مقدار پیش‌فرض)؛ برای جلوگیری از قیمت‌گذاری غلط اجرا متوقف شد")
    log(f"  منبع نرخ دلار: {r.get('source')} | آخرین به‌روزرسانی: {r.get('lastUpdated')}")
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
        time.sleep(5)
    log(f"اعتبار ScraperAPI مصرف‌شده (تقریبی): {_credits_used}")
    return products


# ------------------------------------------------------------- Queue mode
# پیشوند externalId ← نام پلتفرم (باید با افزونه و api.php هماهنگ باشد)
SITES = {"alibaba": "Alibaba.com", "1688": "1688.com", "mic": "Made-in-China.com"}

IDEAS_PROMPT = """You are a sourcing analyst for an Iranian B2B wholesale importer of consumer gadgets
(smart watches/rings, earbuds, chargers, power banks, mini projectors, smart home, trackers, car and travel gadgets).
Suggest __N__ NEW product ideas that are trending right now for wholesale from China, as short English
search keywords for the Alibaba.com search box (2-5 words, generic product type + key feature).
Rules: no brand names (Apple, Samsung, Xiaomi, AirPods ...), no prices, no supplier names, no URLs.
Do not repeat any of these already used keywords: __USED__
For each idea also give "keywordZh": the same product as a natural Simplified-Chinese search phrase for 1688.com (2-8 characters).
Return ONLY JSON: {"ideas":[{"keyword":"...","keywordZh":"...","note":"one short Persian line on why it is trending"}]}"""


def gen_ideas(n=6):
    """ایده (کلیدواژه) از Gemini؛ فقط ایده، نه قیمت و نه تأمین‌کننده"""
    status = nfs("queue_status")
    if status.get("ideas_pending", 0) >= 10:
        log(f"صف ایده‌ها پر است ({status['ideas_pending']})؛ ایده‌ی جدید لازم نیست")
        return 0
    used = ", ".join(random.sample(QUERIES, min(8, len(QUERIES))))
    prompt = IDEAS_PROMPT.replace("__N__", str(n)).replace("__USED__", used)
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.9, "responseMimeType": "application/json"}}
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": (GEMINI_KEYS[(_combos(set()) or [(0, "")])[0][0]] if GEMINI_KEYS else ""), "Content-Type": "application/json"}, json=body, timeout=75)
    if r.status_code != 200:
        raise SystemExit(f"Gemini HTTP {r.status_code}: {r.text[:200]}")
    raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
    ideas = json.loads(raw).get("ideas", [])
    ideas = [i for i in ideas if isinstance(i, dict) and i.get("keyword")]
    res = nfs("queue_add_ideas", "POST", {"ideas": ideas})
    log(f"ایده‌ی جدید در صف: {res.get('added')} از {len(ideas)}")
    return res.get("added", 0)


def raw_to_text(raw):
    """متن خام استخراج‌شده توسط افزونه را برای Gemini آماده می‌کند"""
    parts = [f"TITLE: {raw.get('title', '')}"]
    if raw.get("priceRange"):
        parts.append(f"PRICE RANGE (as shown): {raw['priceRange']}")
    if raw.get("moq"):
        parts.append(f"MOQ (as shown): {raw['moq']}")
    if raw.get("description"):
        parts.append("DESCRIPTION: " + raw["description"])
    attrs = raw.get("attributes") or []
    if attrs:
        parts.append("ATTRIBUTES: " + " | ".join(f"{a['key']}: {a['value']}" for a in attrs))
    if raw.get("fullText"):
        parts.append("PAGE TEXT: " + raw["fullText"])
    return "\n".join(parts)[:14000]


def process_queue(limit, usd_rate):
    data = nfs(f"queue_get_raw&limit={max(limit, 1)}")
    items = data.get("items", [])
    log(f"در صف پردازش: {data.get('pending_total', 0)} | این اجرا: {len(items)}")
    products, ok_ids, bad = [], [], []
    for raw in items:
        log(f"محصول {raw['externalId']}")
        prefix = raw["externalId"].split(":", 1)[0]
        if prefix not in SITES:
            bad.append((raw["id"], f"منبع پشتیبانی‌نشده ({prefix})"))
            continue
        cand = {"id": raw["externalId"].split(":", 1)[1], "url": raw["sourceUrl"],
                "externalId": raw["externalId"], "platform": SITES[prefix]}
        txt = raw_to_text(raw)
        log(f"  عنوان: {raw.get('title', '')[:70]} | طول متن: {len(txt)} | قیمت نمایش‌داده‌شده: {raw.get('priceRange') or '—'}")
        g = gemini_extract(raw["sourceUrl"], txt, SITES[prefix])
        if g is None and QUOTA_HITS >= 2:
            log("  سهمیه‌ی Gemini تمام شده؛ اجرا متوقف شد (محصولات در صف می‌مانند). چند ساعت بعد یا فردا دوباره اجرا کنید.")
            break
        prod, why = to_product(cand, g, raw.get("images") or [], usd_rate)
        if not prod:
            log(f"  رد شد: {why}")
            if why != "gemini-error":   # خطای موقت Gemini: در صف می‌ماند تا اجرای بعد
                bad.append((raw["id"], why))
            continue
        log(f"  OK: {prod['faTitle']}  ({len(prod['images'])} عکس، {len(prod['tieredPricing'])} پله قیمت)")
        products.append(prod)
        ok_ids.append(raw["id"])
        time.sleep(5)
    return products, ok_ids, bad


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
    ap.add_argument("--queue", action="store_true", help="پردازش محصولات خام ارسال‌شده توسط افزونه (بدون ScraperAPI)")
    ap.add_argument("--gen-ideas", action="store_true", help="ساخت ایده‌ی جدید با Gemini و ذخیره در صف")
    args = ap.parse_args()

    if args.queue or args.gen_ideas:
        need = ["NFS_INGEST_KEY", "GEMINI_API_KEY"]
    elif args.from_json:
        need = ["NFS_INGEST_KEY"]
    else:
        need = ["NFS_INGEST_KEY", "SCRAPERAPI_KEY", "GEMINI_API_KEY"]
    missing = [k for k in need if not os.environ.get(k)]
    if missing:
        raise SystemExit("متغیرهای محیطی ناقص: " + ", ".join(missing))

    if args.gen_ideas and not args.queue:
        gen_ideas()
        return

    usd_rate = get_usd_rate()
    global MARGIN
    try:
        cfg = requests.get(f"{SITE}/api.php?action=get_pricing_config",
                           headers={"X-Ingest-Key": INGEST_KEY}, timeout=30).json()
        if cfg.get("success") and cfg.get("marginPercent") is not None:
            MARGIN = float(cfg["marginPercent"])
            log("حاشیه سود از تنظیمات پنل خوانده شد")
    except Exception as e:
        log(f"  خواندن حاشیه سود از هاست ممکن نشد، از مقدار پیش‌فرض استفاده می‌شود: {e}")
    log(f"نرخ دلار: {usd_rate:,.0f} تومان | حاشیه سود: {MARGIN}%")

    queue_ok, queue_bad = [], []
    if args.gen_ideas:
        gen_ideas()
    if args.queue:
        products, queue_ok, queue_bad = process_queue(args.limit, usd_rate)
    elif args.from_json:
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
    if args.queue:
        for rid, why in queue_bad:
            nfs("queue_resolve_raw", "POST", {"ids": [rid], "status": "failed", "reason": str(why)[:150]})
    if not products:
        log("محصول جدیدی برای ارسال نبود")
        return

    res = nfs("ingest_products", "POST", {"products": products, "cacheImages": True})
    log(f"ارسال به هاست: {res['added_count']} اضافه شد | رد شده: {res['skipped']}")
    if args.queue and queue_ok:
        nfs("queue_resolve_raw", "POST", {"ids": queue_ok, "status": "done"})
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
