import React, { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
  adminKey: string | null;
}

interface Prod {
  id: string;
  faTitle: string;
  modelOrSku?: string;
  originalTitle?: string;
  brand?: string;
  mainImage?: string;
  images?: string[];
}

interface Entry {
  file: File;
  key: string; // کد مدل استخراج‌شده از نام فایل
  product: Prod | null;
}

// A2149K12.jpg ، A2149K12_2.png ، A2149K12-3.webp ، A2149K12 (2).jpg → کد مدل
const keyFromName = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/[-_ ]\d{1,2}$/, '')
    .trim()
    .toLowerCase();

const downscale = (file: File, max = 1100): Promise<Blob> =>
  new Promise((resolve) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return resolve(file);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      const ctx = c.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return resolve(file);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.86);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

export const BulkImageAttach: React.FC<Props> = ({ adminKey }) => {
  const [products, setProducts] = useState<Prod[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    fetch('/api.php?action=get_products_admin', { headers: { 'X-Admin-Key': adminKey } })
      .then((r) => r.json())
      .then((d) => Array.isArray(d.products) && setProducts(d.products))
      .catch(() => {});
  }, [adminKey]);

  const entries: Entry[] = useMemo(
    () =>
      files.map((file) => {
        const key = keyFromName(file.name);
        const product =
          products.find((p) => (p.modelOrSku || '').toLowerCase() === key || p.id.toLowerCase() === key) ||
          (key.length >= 5
            ? products.find((p) => `${p.faTitle} ${p.originalTitle || ''}`.toLowerCase().includes(key))
            : undefined) ||
          null;
        return { file, key, product: product || null };
      }),
    [files, products]
  );

  const withoutImage = products.filter((p) => !p.mainImage).length;
  const matched = entries.filter((e) => e.product);

  const run = async () => {
    if (!adminKey) {
      setMsg({ ok: false, text: 'ابتدا در تب «پردازش دستی» کلید ادمین را وارد کنید.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    const byKey: Record<string, string[]> = {};
    let failed = 0;
    try {
      for (let i = 0; i < matched.length; i++) {
        setProgress(`آپلود ${i + 1} از ${matched.length}...`);
        const e = matched[i];
        try {
          const blob = await downscale(e.file);
          const fd = new FormData();
          fd.append('image', blob, e.file.name);
          const r = await fetch('/api.php?action=upload_image', {
            method: 'POST',
            headers: { 'X-Admin-Key': adminKey },
            body: fd,
          });
          const d = await r.json();
          if (d.success && d.url) {
            (byKey[e.key] = byKey[e.key] || []).push(d.url);
          } else failed++;
        } catch {
          failed++;
        }
      }
      const items = Object.entries(byKey).map(([key, urls]) => ({ key, urls }));
      if (!items.length) {
        setMsg({ ok: false, text: 'هیچ عکسی آپلود نشد.' });
        return;
      }
      setProgress('اتصال عکس‌ها به محصولات...');
      const r = await fetch('/api.php?action=attach_images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ items }),
      });
      const d = await r.json();
      if (!d.success) {
        setMsg({ ok: false, text: d.error || 'خطا در اتصال عکس‌ها' });
        return;
      }
      setMsg({
        ok: true,
        text: `عکس ${d.matched} محصول ثبت شد${failed ? `، ${failed} فایل آپلود نشد` : ''}. برای دیدن نتیجه صفحه را رفرش کنید.`,
      });
      setFiles([]);
      try {
        localStorage.removeItem('nfs_products_catalog');
      } catch {
        /* ignore */
      }
    } catch {
      setMsg({ ok: false, text: 'اتصال به هاست برقرار نشد.' });
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3" dir="rtl">
      <div>
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <ImagePlus className="w-4 h-4 text-[#8FABD4]" />
          افزودن عکس گروهی به محصولات
        </h3>
        <p className="text-[11px] text-slate-400 mt-1 leading-6">
          عکس‌ها را با نام «کد مدل» انتخاب کنید، مثلاً <span className="font-mono" dir="ltr">A2149K12.jpg</span>. برای چند عکس از یک محصول:{' '}
          <span className="font-mono" dir="ltr">A2149K12_2.jpg</span>. عکس‌ها خودکار کوچک و روی هاست ذخیره می‌شوند.
          {products.length > 0 && <> الان {withoutImage} محصول از {products.length} محصول بدون عکس است.</>}
        </p>
      </div>

      <label className="block border-2 border-dashed border-slate-700 hover:border-[#4A70A9] rounded-xl p-4 text-center cursor-pointer transition">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            setFiles((prev) => [...prev, ...picked]);
            e.target.value = '';
          }}
        />
        <span className="text-xs text-slate-300">انتخاب عکس‌ها (چند فایل همزمان)</span>
      </label>

      {entries.length > 0 && (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {entries.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-[11px] bg-slate-800/60 rounded-lg px-3 py-1.5">
              <span className="font-mono text-slate-300 truncate" dir="ltr">{e.file.name}</span>
              {e.product ? (
                <span className="text-[#8FABD4] truncate">{e.product.faTitle}</span>
              ) : (
                <span className="text-amber-400 shrink-0">محصولی با کد «{e.key}» پیدا نشد</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400">
          {entries.length ? `${matched.length} از ${entries.length} عکس تطبیق دارد` : ''} {progress}
        </span>
        <div className="flex-1" />
        {files.length > 0 && (
          <button onClick={() => setFiles([])} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer">
            پاک کردن
          </button>
        )}
        <button
          onClick={run}
          disabled={busy || !matched.length}
          className="px-4 py-2 rounded-xl bg-[#4A70A9] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          آپلود و اتصال به محصولات
        </button>
      </div>
      {msg && (
        <div className={`text-xs rounded-xl px-3 py-2 ${msg.ok ? 'bg-[#4A70A9]/20 text-[#8FABD4]' : 'bg-red-500/10 text-red-400'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
};
