import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Check, RefreshCw, Send, AlertCircle } from 'lucide-react';
import { EXTRACT_PROMPT } from './extractPrompt';

// حالت دستی: کپی دیتای خام محصول → پرامپت → پیست JSON از ایجنت بیرونی → انتشار
const API = '/api.php?action=';
const CATEGORIES = ['گجت و لوازم دیجیتال', 'صوتی و هوشمند', 'خانه، ورزش و سلامت'];
const SITE_BY_PREFIX: Record<string, string> = {
  alibaba: 'Alibaba.com',
  '1688': '1688.com',
  mic: 'Made-in-China.com',
};

interface RawItem {
  id: string;
  externalId: string;
  title: string;
  priceRange: string;
  moq: string;
  description: string;
  attributes: { key: string; value: string }[];
  fullText: string;
  sourceUrl: string;
  status: string;
  reason: string;
}

interface IdeaItem {
  id: string;
  keyword: string;
  keywordZh: string;
  status: string;
}

// همان منطق raw_to_text در hunt.py
const rawToText = (raw: RawItem): string => {
  const parts: string[] = [`TITLE: ${raw.title || ''}`];
  if (raw.priceRange) parts.push(`PRICE RANGE (as shown): ${raw.priceRange}`);
  if (raw.moq) parts.push(`MOQ (as shown): ${raw.moq}`);
  if (raw.description) parts.push(`DESCRIPTION: ${raw.description}`);
  if (raw.attributes?.length) {
    parts.push('ATTRIBUTES: ' + raw.attributes.map((a) => `${a.key}: ${a.value}`).join(' | '));
  }
  if (raw.fullText) parts.push(`PAGE TEXT: ${raw.fullText}`);
  return parts.join('\n').slice(0, 14000);
};

const buildPrompt = (raw: RawItem): string => {
  const prefix = (raw.externalId || '').split(':', 1)[0];
  const site = SITE_BY_PREFIX[prefix] || 'wholesale marketplace';
  return EXTRACT_PROMPT.replace('__CATEGORIES__', CATEGORIES.join(' | '))
    .replace('__SITE__', site)
    .replace('__URL__', raw.sourceUrl || '')
    .replace('__TEXT__', rawToText(raw));
};

// JSON خروجی ایجنت؛ اگر با ```json یا آرایه آمده باشد، تمیز می‌شود
const parseAgentJson = (text: string): { obj: any; note: string } => {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(t);
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) throw new Error('آرایه خالی است');
    return {
      obj: parsed[0],
      note: parsed.length > 1 ? ' (فقط اولین محصول آرایه ثبت شد؛ هر محصول را جدا ثبت کنید)' : '',
    };
  }
  return { obj: parsed, note: '' };
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
};

export const ManualProcessTab: React.FC = () => {
  const [adminKey, setAdminKey] = useState<string>(() => {
    try {
      return sessionStorage.getItem('nfs_admin_key') || '';
    } catch {
      return '';
    }
  });
  const [keyInput, setKeyInput] = useState('');
  const [raw, setRaw] = useState<RawItem[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [agentJson, setAgentJson] = useState('');
  const [margin, setMargin] = useState('25');
  const [mainImage, setMainImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }),
    [adminKey]
  );

  const forgetKey = () => {
    try {
      sessionStorage.removeItem('nfs_admin_key');
    } catch {
      /* ignore */
    }
    setAdminKey('');
    setRaw([]);
    setIdeas([]);
  };

  const loadQueue = async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch(API + 'queue_list', { headers });
      if (res.status === 401) {
        forgetKey();
        setMessage({ ok: false, text: 'کلید ادمین نادرست است. دوباره وارد کنید.' });
        return;
      }
      const data = await res.json();
      if (!data.success) {
        setMessage({ ok: false, text: data.error || 'خطا در خواندن صف' });
        return;
      }
      setRaw(data.raw || []);
      setIdeas(data.ideas || []);
    } catch {
      setMessage({ ok: false, text: 'اتصال به هاست برقرار نشد.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  const queue = useMemo(
    () =>
      raw
        .filter((r) => r.status !== 'done')
        .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1)),
    [raw]
  );
  const selected = queue.find((r) => r.id === selectedId) || queue[0] || null;
  const prompt = useMemo(() => (selected ? buildPrompt(selected) : ''), [selected]);

  const handleCopy = async () => {
    if (!selected) return;
    const ok = await copyText(prompt);
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = async () => {
    if (!selected) return;
    setMessage(null);
    let parsed: { obj: any; note: string };
    try {
      parsed = parseAgentJson(agentJson);
    } catch (e: any) {
      setMessage({ ok: false, text: 'JSON معتبر نیست: ' + (e.message || '') });
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch(API + 'ingest_manual_product', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          raw_id: selected.id,
          gemini_json: parsed.obj,
          margin_percent: Number(margin) || 25,
          main_image: mainImage.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ ok: true, text: (data.message || 'منتشر شد') + parsed.note });
        setAgentJson('');
        setSelectedId('');
        await loadQueue();
      } else {
        setMessage({ ok: false, text: data.error || 'خطا در ثبت محصول' });
      }
    } catch {
      setMessage({ ok: false, text: 'اتصال به هاست برقرار نشد.' });
    } finally {
      setPublishing(false);
    }
  };

  if (!adminKey) {
    return (
      <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <h2 className="text-sm font-bold text-white">ورود کلید ادمین</h2>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="admin_key"
          dir="ltr"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
        />
        <button
          onClick={() => {
            const k = keyInput.trim();
            if (!k) return;
            try {
              sessionStorage.setItem('nfs_admin_key', k);
            } catch {
              /* ignore */
            }
            setAdminKey(k);
          }}
          className="w-full py-2.5 rounded-xl bg-[#E63946] text-white text-xs font-bold cursor-pointer"
        >
          ورود
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white">صف کالاهای استخراجی</h2>
          <p className="text-xs text-slate-400 mt-1">
            محصول را انتخاب کنید، پرامپت را کپی کنید، در ایجنت خودتان اجرا کنید و JSON خروجی را اینجا پیست کنید.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={forgetKey}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
          >
            تغییر کلید
          </button>
          <button
          onClick={loadQueue}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>به‌روزرسانی صف</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            message.ok
              ? 'bg-emerald-900/40 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-900/40 text-rose-200 border-rose-500/40'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* لیست صف */}
        <div className="lg:col-span-5 space-y-2">
          <h4 className="text-xs font-bold text-slate-300">
            محصولات در انتظار ({queue.length})
          </h4>
          {queue.length === 0 && (
            <p className="text-xs text-slate-500 p-4 border border-dashed border-slate-800 rounded-xl">
              موردی در صف پردازش دستی نیست.
            </p>
          )}
          <div className="space-y-2 max-h-[560px] overflow-y-auto">
            {queue.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedId(r.id);
                  setMessage(null);
                }}
                className={`w-full text-right p-3 rounded-xl border text-xs transition cursor-pointer ${
                  selected?.id === r.id
                    ? 'bg-slate-800 border-[#E63946]'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-100 line-clamp-2">{r.title || '(بدون عنوان)'}</span>
                  <span
                    className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${
                      r.status === 'pending' ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {r.status === 'pending' ? 'در انتظار' : 'ناموفق'}
                  </span>
                </div>
                {r.reason && <div className="text-[10px] text-slate-500 mt-1">{r.reason}</div>}
              </button>
            ))}
          </div>

          {ideas.length > 0 && (
            <div className="pt-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-300">ایده‌های ترند ({ideas.length})</h4>
              <ul className="text-[11px] text-slate-400 space-y-1">
                {ideas.slice(0, 15).map((i) => (
                  <li key={i.id}>
                    {i.keyword}
                    {i.keywordZh ? ` · ${i.keywordZh}` : ''} — {i.status === 'pending' ? 'در صف' : 'انجام شده'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* کار روی محصول انتخابی */}
        <div className="lg:col-span-7 space-y-4">
          {!selected && (
            <p className="text-xs text-slate-500 p-4 border border-dashed border-slate-800 rounded-xl">
              برای کپی پرامپت، یک محصول از لیست سمت راست انتخاب کنید. پیست JSON همیشه فعال است.
            </p>
          )}
          {selected && (
            <>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-amber-400">۱) پرامپت و دیتای محصول</h3>
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'کپی شد' : 'کپی دیتای محصول'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  dir="ltr"
                  rows={8}
                  value={prompt}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 font-mono"
                />
                {selected.sourceUrl && (
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-sky-400 underline break-all"
                  >
                    {selected.sourceUrl}
                  </a>
                )}
              </div>
            </>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-emerald-400">۲) JSON خروجی ایجنت را پیست کنید</h3>
                <textarea
                  dir="ltr"
                  rows={12}
                  value={agentJson}
                  onChange={(e) => setAgentJson(e.target.value)}
                  placeholder={'{\n  "usable": true,\n  "currency": "EUR",\n  "tiers": [...]\n}'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-[11px] text-slate-100 font-mono"
                />
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    لینک تصویر اصلی کالا (در صورت نبودن تصویر در صف الزامی است)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={mainImage}
                    onChange={(e) => setMainImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">حاشیه سود (%)</label>
                    <input
                      type="number"
                      value={margin}
                      onChange={(e) => setMargin(e.target.value)}
                      className="w-24 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <button
                    onClick={handlePublish}
                    disabled={publishing || !agentJson.trim() || !selected}
                    className="flex-1 min-w-[180px] py-2.5 rounded-xl bg-[#E63946] hover:bg-[#d62f3c] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {publishing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>ثبت و انتشار محصول</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    {selected
                      ? 'قیمت‌ها بر اساس واحد ارز JSON و نرخ لحظه‌ای هاست به تومان تبدیل می‌شوند. پس از انتشار، محصول در کاتالوگ و مینی‌اپ دیده می‌شود.'
                      : 'ابتدا یک محصول از لیست انتخاب کنید، سپس ثبت انجام می‌شود.'}
                  </span>
                </p>
              </div>
        </div>
      </div>
    </div>
  );
};
