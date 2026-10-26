import React, { useMemo, useState } from 'react';
import { UploadCloud, Eye, CheckCircle2, AlertTriangle, Loader2, X, Copy } from 'lucide-react';
import { BATCH_AGENT_INSTRUCTION } from './agentInstruction';
import { BulkImageAttach } from './BulkImageAttach';

interface BatchImportTabProps {
  adminKey: string | null;
  onImported?: () => void;
}

interface PreviewRow {
  index: number;
  status: 'ok' | 'skip' | 'added' | 'updated';
  reason: string;
  title: string;
  sku: string;
  priceToman: number;
  category: string;
}

interface Loaded {
  name: string;
  items: any[];
  error?: string;
}

const MAX_ITEMS = 100;

// خروجی ایجنت: یک آبجکت، آرایه، یا چند آبجکت پشت‌سرهم؛ با یا بدون ```json
const parseItems = (text: string): any[] => {
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (!t) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(t);
  } catch {
    parsed = JSON.parse('[' + t.replace(/}\s*,?\s*{/g, '},{') + ']');
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
};

const fmt = (n: number) => n.toLocaleString('en-US');

export const BatchImportTab: React.FC<BatchImportTabProps> = ({ adminKey, onImported }) => {
  const [files, setFiles] = useState<Loaded[]>([]);
  const [pasted, setPasted] = useState('');
  const [brand, setBrand] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [margin, setMargin] = useState('25');
  const [categoryAsBrand, setCategoryAsBrand] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [done, setDone] = useState<{ added: number; updated: number; posted: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { items, pasteError } = useMemo(() => {
    let fromPaste: any[] = [];
    let pe = '';
    if (pasted.trim()) {
      try {
        fromPaste = parseItems(pasted);
      } catch (e: any) {
        pe = 'JSON چسبانده‌شده معتبر نیست';
      }
    }
    return { items: [...files.flatMap((f) => f.items), ...fromPaste], pasteError: pe };
  }, [files, pasted]);

  const onFiles = async (list: FileList | null) => {
    if (!list) return;
    const loaded: Loaded[] = [];
    for (const f of Array.from(list)) {
      try {
        loaded.push({ name: f.name, items: parseItems(await f.text()) });
      } catch {
        loaded.push({ name: f.name, items: [], error: 'JSON معتبر نیست' });
      }
    }
    setFiles((prev) => [...prev, ...loaded]);
    setRows(null);
    setDone(null);
  };

  const call = async (dry: boolean) => {
    if (!adminKey) {
      setMsg({ ok: false, text: 'ابتدا در تب «پردازش دستی» کلید ادمین را وارد کنید.' });
      return;
    }
    if (!items.length) {
      setMsg({ ok: false, text: 'هیچ محصولی برای ثبت وجود ندارد.' });
      return;
    }
    if (items.length > MAX_ITEMS) {
      setMsg({ ok: false, text: `حداکثر ${MAX_ITEMS} محصول در هر بار؛ فعلاً ${items.length} تا دارید.` });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api.php?action=ingest_batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({
          dry_run: dry,
          brand: brand.trim(),
          currency,
          margin_percent: Number(margin) || 25,
          category_as_brand: categoryAsBrand,
          announce: !dry && announce,
          items,
        }),
      });
      const d = await res.json();
      if (!d.success) {
        setMsg({ ok: false, text: d.error || 'خطا در ارتباط با هاست' });
        return;
      }
      setRows(d.rows as PreviewRow[]);
      if (!dry) {
        setDone({ added: d.added, updated: d.updated, posted: d.channel_posted });
        setMsg({ ok: true, text: `ثبت شد: ${d.added} محصول جدید، ${d.updated} به‌روزرسانی.` });
        onImported?.();
      }
    } catch {
      setMsg({ ok: false, text: 'اتصال به هاست برقرار نشد.' });
    } finally {
      setBusy(false);
    }
  };

  const copyInstruction = async () => {
    try {
      await navigator.clipboard.writeText(BATCH_AGENT_INSTRUCTION);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = BATCH_AGENT_INSTRUCTION;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const okCount = rows ? rows.filter((r) => r.status !== 'skip').length : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-[#E0707F]" />
            ورود گروهی محصولات (کاتالوگ برند)
          </h2>
          <p className="text-[11px] text-slate-400 mt-1 leading-6">
            چند فایل JSON خروجی ایجنت را یک‌جا بدهید، برند را بنویسید، پیش‌نمایش را ببینید و همه را با یک دکمه در همان دسته ثبت کنید.
            محصول تکراری (برند + کد مدل) دوباره ساخته نمی‌شود و فقط به‌روز می‌شود.
          </p>
        </div>

        <button
          onClick={copyInstruction}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1.5 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          {copied ? 'کپی شد' : 'کپی دستورالعمل ایجنت (فرمت JSON سازگار با برنامه)'}
        </button>

        <label className="block border-2 border-dashed border-slate-700 hover:border-[#A91D2E] rounded-xl p-5 text-center cursor-pointer transition">
          <input
            type="file"
            accept=".json,application/json,.txt"
            multiple
            className="hidden"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <span className="text-xs text-slate-300">فایل‌های JSON را انتخاب کنید (چند فایل همزمان)</span>
        </label>

        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between text-[11px] bg-slate-800/60 rounded-lg px-3 py-1.5">
                <span className="font-mono text-slate-300 truncate" dir="ltr">{f.name}</span>
                <span className="flex items-center gap-2">
                  {f.error ? (
                    <span className="text-red-400">{f.error}</span>
                  ) : (
                    <span className="text-[#E0707F]">{f.items.length} محصول</span>
                  )}
                  <button
                    onClick={() => {
                      setFiles((p) => p.filter((_, j) => j !== i));
                      setRows(null);
                    }}
                    className="text-slate-500 hover:text-white cursor-pointer"
                    title="حذف فایل"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div>
          <label className="text-[11px] text-slate-400">یا JSON را اینجا بچسبانید (یک آبجکت، آرایه، یا چند آبجکت)</label>
          <textarea
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              setRows(null);
            }}
            rows={5}
            dir="ltr"
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-[11px] text-white font-mono"
            placeholder='[{ "modelOrSku": "A2149K12", "faTitle": "...", "tiers": [...] }]'
          />
          {pasteError && <p className="text-[11px] text-red-400 mt-1">{pasteError}</p>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="text-[11px] text-slate-400">برند / نام دسته</label>
            <input
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setRows(null);
              }}
              placeholder="مثلاً انکر"
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">ارز قیمت‌ها</label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setRows(null);
              }}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="CNY">یوان (CNY)</option>
              <option value="USD">دلار (USD)</option>
              <option value="AED">درهم (AED)</option>
              <option value="EUR">یورو (EUR)</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">حاشیه سود (٪)</label>
            <input
              type="number"
              value={margin}
              onChange={(e) => {
                setMargin(e.target.value);
                setRows(null);
              }}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5 text-[11px] text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={categoryAsBrand} onChange={(e) => { setCategoryAsBrand(e.target.checked); setRows(null); }} />
            همه محصولات در یک دسته به نام برند قرار بگیرند (برای کاتالوگ‌های بزرگ توصیه نمی‌شود؛ بهتر است دسته بر اساس نوع کالا باشد و برند جدا ذخیره و فیلتر شود)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
            برای محصولات جدید پست کانال هم ارسال شود (حداکثر ۵ تا)
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400">{items.length} محصول آماده</span>
          <div className="flex-1" />
          <button
            onClick={() => call(true)}
            disabled={busy || !items.length}
            className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            پیش‌نمایش
          </button>
          <button
            onClick={() => call(false)}
            disabled={busy || !items.length || (rows !== null && okCount === 0)}
            className="px-4 py-2 rounded-xl bg-[#A91D2E] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            ثبت همه در کاتالوگ
          </button>
        </div>

        {msg && (
          <div className={`text-xs rounded-xl px-3 py-2 ${msg.ok ? 'bg-[#A91D2E]/20 text-[#E0707F]' : 'bg-red-500/10 text-red-400'}`}>
            {msg.text}
          </div>
        )}
      </div>

      {rows && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
          <table className="w-full text-[11px] text-slate-200">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-right py-2 px-2">#</th>
                <th className="text-right py-2 px-2">عنوان</th>
                <th className="text-right py-2 px-2">کد مدل</th>
                <th className="text-right py-2 px-2">دسته</th>
                <th className="text-right py-2 px-2">قیمت (تومان)</th>
                <th className="text-right py-2 px-2">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.index} className="border-b border-slate-800/60">
                  <td className="py-2 px-2 font-mono">{r.index + 1}</td>
                  <td className="py-2 px-2">{r.title || '—'}</td>
                  <td className="py-2 px-2 font-mono" dir="ltr">{r.sku || '—'}</td>
                  <td className="py-2 px-2">{r.category || '—'}</td>
                  <td className="py-2 px-2 font-mono">{r.priceToman ? fmt(r.priceToman) : '—'}</td>
                  <td className="py-2 px-2">
                    {r.status === 'skip' ? (
                      <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r.reason}</span>
                    ) : r.status === 'added' ? (
                      <span className="text-[#E0707F]">اضافه شد</span>
                    ) : r.status === 'updated' ? (
                      <span className="text-[#E0707F]">به‌روز شد</span>
                    ) : (
                      <span className="text-slate-300">آماده ثبت</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {done && (
            <p className="text-[11px] text-slate-400 mt-3">
              {done.added} جدید، {done.updated} به‌روزرسانی{done.posted ? `، ${done.posted} پست کانال` : ''}. محصولات بدون عکس‌اند؛ برای دیدن آن‌ها در تب کاتالوگ صفحه را یک‌بار رفرش کنید و عکس را از همان‌جا اضافه کنید.
            </p>
          )}
        </div>
      )}

      <BulkImageAttach adminKey={adminKey} />
    </div>
  );
};
