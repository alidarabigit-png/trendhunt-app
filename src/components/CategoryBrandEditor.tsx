import React, { useState } from 'react';
import { Pencil, Check, X, Wand2, Loader2 } from 'lucide-react';
import { ProductItem, CATALOG_CATEGORIES } from '../types';

interface EditorProps {
  product: ProductItem;
  allCategories: string[];
  onSave: (updated: ProductItem) => void;
}

// نمایش دسته/برند محصول + ویرایش درجا
export const CategoryBrandEditor: React.FC<EditorProps> = ({ product, allCategories, onSave }) => {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(product.category || '');
  const [brand, setBrand] = useState(product.brand || '');
  const [sub, setSub] = useState(product.subCategory || '');

  const options = Array.from(new Set([...CATALOG_CATEGORIES, ...allCategories, cat].filter(Boolean)));

  const save = () => {
    const c = cat.trim() || 'متفرقه';
    onSave({
      ...product,
      category: c,
      brand: brand.trim() || undefined,
      subCategory: sub.trim() || undefined,
      categoryLocked: c !== product.category ? true : product.categoryLocked,
    });
    setOpen(false);
  };

  if (!open) {
    return (
      <>
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          {product.category}
          {product.subCategory ? ` › ${product.subCategory}` : ''}
        </span>
        {product.brand && (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
            {product.brand}
          </span>
        )}
        <button
          onClick={() => {
            setCat(product.category || '');
            setBrand(product.brand || '');
            setSub(product.subCategory || '');
            setOpen(true);
          }}
          title="ویرایش دسته‌بندی و برند"
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </>
    );
  }

  return (
    <div className="w-full flex flex-wrap items-end gap-2 bg-slate-800/60 border border-slate-700 rounded-xl p-2.5">
      <label className="text-[10px] text-slate-400">
        دسته
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="block mt-0.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[10px] text-slate-400">
        برند
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="مثلاً انکر"
          className="block mt-0.5 w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
        />
      </label>
      <label className="text-[10px] text-slate-400">
        زیردسته
        <input
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          className="block mt-0.5 w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
        />
      </label>
      <button onClick={save} className="px-2.5 py-1 rounded-lg bg-[#A91D2E] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer">
        <Check className="w-3 h-3" /> ذخیره
      </button>
      <button onClick={() => setOpen(false)} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer">
        <X className="w-3 h-3" /> انصراف
      </button>
    </div>
  );
};

interface Change {
  id: string;
  title: string;
  from: string;
  to: string;
}

// اصلاح خودکار دسته‌ها: اول پیش‌نمایش، بعد اعمال
export const NormalizeCategoriesButton: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [err, setErr] = useState('');

  const call = async (dry: boolean) => {
    const key = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nfs_admin_key') : null;
    if (!key) {
      setErr('ابتدا در تب «پردازش دستی» کلید ادمین را وارد کنید.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api.php?action=normalize_catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
        body: JSON.stringify({ dry_run: dry }),
      });
      const d = await r.json();
      if (!d.success) {
        setErr(d.error || 'خطا');
        return;
      }
      if (dry) {
        setChanges(d.changes as Change[]);
      } else {
        // کاتالوگ سرور عوض شد؛ صفحه را تازه می‌کنیم تا همین نسخه نمایش داده شود
        try {
          localStorage.removeItem('nfs_products_catalog');
        } catch {
          /* ignore */
        }
        window.location.reload();
      }
    } catch {
      setErr('اتصال به هاست برقرار نشد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => call(true)}
        disabled={busy}
        title="دسته‌بندی همه محصولات را با فهرست استاندارد یکدست می‌کند (اول پیش‌نمایش)"
        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-medium transition disabled:opacity-50 cursor-pointer"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-[#E0707F]" />}
        <span>اصلاح خودکار دسته‌ها</span>
      </button>
      {err && <span className="text-[11px] text-red-400">{err}</span>}
      {changes && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 text-sm font-bold text-white">
              {changes.length ? `${changes.length} محصول دسته‌شان تغییر می‌کند` : 'همه دسته‌ها از قبل استاندارد هستند'}
            </div>
            <ul className="flex-1 overflow-y-auto p-4 space-y-1.5 text-[11px] text-slate-300">
              {changes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 bg-slate-800/50 rounded-lg px-3 py-1.5">
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 text-slate-400">
                    {c.from || '—'} ← <b className="text-[#E0707F]">{c.to}</b>
                  </span>
                </li>
              ))}
            </ul>
            <div className="p-4 border-t border-slate-800 flex gap-2 justify-end">
              <button onClick={() => setChanges(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs cursor-pointer">
                انصراف
              </button>
              {changes.length > 0 && (
                <button
                  onClick={() => call(false)}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-[#A91D2E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  اعمال تغییرات
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};


/** دانلود پشتیبان کامل کاتالوگ به‌صورت فایل JSON */
export const BackupCatalogButton: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const key = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nfs_admin_key') : null;
    if (!key) { alert('ابتدا کلید ادمین را وارد کنید.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api.php?action=backup_catalog', { headers: { 'X-Admin-Key': key } });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || 'خطا');
      const blob = new Blob([JSON.stringify(d.products, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nfs-catalog-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      alert('دریافت پشتیبان ناموفق بود: ' + (e?.message || ''));
    }
    setBusy(false);
  };
  return (
    <button onClick={run} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer disabled:opacity-50">
      {busy ? 'در حال دریافت…' : 'دانلود پشتیبان کاتالوگ'}
    </button>
  );
};

interface DupGroup { keep: { id: string; title: string }; remove: { id: string; title: string }[] }

/** یافتن و حذف محصولات تکراری با پیش‌نمایش */
export const DedupeCatalogButton: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<DupGroup[] | null>(null);
  const call = async (dry: boolean) => {
    const key = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nfs_admin_key') : null;
    if (!key) { alert('ابتدا کلید ادمین را وارد کنید.'); return null; }
    const res = await fetch('/api.php?action=dedupe_catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
      body: JSON.stringify({ dry_run: dry }),
    });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || 'خطا');
    return d;
  };
  const preview = async () => {
    setBusy(true);
    try {
      const d = await call(true);
      if (d) {
        if (!d.groups.length) alert('محصول تکراری پیدا نشد.');
        else setGroups(d.groups);
      }
    } catch (e: any) { alert('خطا: ' + (e?.message || '')); }
    setBusy(false);
  };
  const apply = async () => {
    setBusy(true);
    try {
      const d = await call(false);
      if (d) { alert(`${d.removed} محصول تکراری حذف شد.`); window.location.reload(); }
    } catch (e: any) { alert('خطا: ' + (e?.message || '')); }
    setBusy(false);
  };
  return (
    <>
      <button onClick={preview} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer disabled:opacity-50">
        {busy ? 'در حال بررسی…' : 'حذف محصولات تکراری'}
      </button>
      {groups && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setGroups(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800 text-sm font-bold text-white">
              {groups.reduce((n, g) => n + g.remove.length, 0)} محصول تکراری پیدا شد
              <p className="text-[11px] font-normal text-slate-400 mt-1">از هر گروه، کالای کامل‌تر (دارای عکس / ثبت‌شده با کد) می‌ماند و عکس نسخه‌ی حذف‌شده به آن منتقل می‌شود. از کاتالوگ قبل از حذف نسخه‌ی پشتیبان خودکار ساخته می‌شود.</p>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-xs">
              {groups.map((g, i) => (
                <div key={i} className="rounded-xl border border-slate-800 p-2.5 space-y-1">
                  <div className="text-emerald-400">✓ می‌ماند: {g.keep.title}</div>
                  {g.remove.map((r) => <div key={r.id} className="text-red-400">✗ حذف می‌شود: {r.title}</div>)}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-800 flex gap-2">
              <button onClick={apply} disabled={busy} className="flex-1 py-2 rounded-xl bg-[#A91D2E] text-white text-xs font-bold cursor-pointer disabled:opacity-50">{busy ? 'در حال حذف…' : 'حذف تکراری‌ها'}</button>
              <button onClick={() => setGroups(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs cursor-pointer">انصراف</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
