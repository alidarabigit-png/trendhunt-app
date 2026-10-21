import React, { useEffect, useMemo, useState } from 'react';
import { Palette, Save, RotateCcw, Download, Type, Loader2 } from 'lucide-react';
import {
  MiniAppUi,
  MiniAppRoleKey,
  DEFAULT_MINIAPP_UI,
  MINIAPP_FONTS,
  MINIAPP_ROLE_LABELS,
  MINIAPP_ROLE_RANGES,
} from '../types';

interface AppearanceSettingsTabProps {
  adminKey: string | null;
  onSaved?: (ui: MiniAppUi) => void;
}

const COLOR_FIELDS: { key: keyof MiniAppUi; label: string }[] = [
  { key: 'accent', label: 'رنگ اصلی (تاکید)' },
  { key: 'pageBg', label: 'پس‌زمینه صفحه' },
  { key: 'cardBg', label: 'پس‌زمینه کارت‌ها' },
  { key: 'cardBorder', label: 'رنگ حاشیه کارت‌ها' },
  { key: 'textColor', label: 'رنگ متن اصلی' },
  { key: 'mutedColor', label: 'رنگ متن کم‌رنگ' },
  { key: 'buttonBg', label: 'پس‌زمینه دکمه‌ها' },
  { key: 'buttonText', label: 'رنگ متن دکمه‌ها' },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const normalize = (raw: any): MiniAppUi => {
  const d = DEFAULT_MINIAPP_UI;
  const src = raw && typeof raw === 'object' ? raw : {};
  const roles = { ...d.roles };
  (Object.keys(d.roles) as MiniAppRoleKey[]).forEach((k) => {
    roles[k] = { ...d.roles[k], ...(src.roles?.[k] || {}) };
  });
  return { ...d, ...src, roles };
};

export const AppearanceSettingsTab: React.FC<AppearanceSettingsTabProps> = ({ adminKey, onSaved }) => {
  const [draft, setDraft] = useState<MiniAppUi>(DEFAULT_MINIAPP_UI);
  const [saved, setSaved] = useState<MiniAppUi>(DEFAULT_MINIAPP_UI);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api.php?action=get_ui');
        const data = await res.json();
        if (!alive) return;
        const ui = normalize(data?.ui);
        setDraft(ui);
        setSaved(ui);
      } catch {
        if (alive) setMsg({ type: 'err', text: 'دریافت تنظیمات ظاهر از سرور ممکن نشد.' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const setColor = (key: keyof MiniAppUi, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const setRole = (role: MiniAppRoleKey, field: 'size' | 'weight' | 'color' | 'lineHeight', value: string | number) =>
    setDraft((d) => ({ ...d, roles: { ...d.roles, [role]: { ...d.roles[role], [field]: value } } }));

  const invalidColors = COLOR_FIELDS.filter((f) => !HEX_RE.test(String(draft[f.key])));

  const save = async (ui: MiniAppUi) => {
    if (!adminKey) {
      setMsg({ type: 'err', text: 'ابتدا با کلید ادمین وارد شوید.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api.php?action=save_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ ui }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
      const confirmed = normalize(data?.settings?.ui ?? ui);
      setDraft(confirmed);
      setSaved(confirmed);
      onSaved?.(confirmed);
      setMsg({ type: 'ok', text: 'تنظیمات ظاهر ذخیره شد و در مینی‌اپ اعمال می‌شود.' });
    } catch (e: any) {
      setMsg({ type: 'err', text: `ذخیره نشد: ${e?.message || 'خطای نامشخص'}` });
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!window.confirm('همه تنظیمات ظاهر به پیش‌فرض برگردد؟ (هنوز ذخیره نمی‌شود تا خودتان ذخیره کنید)')) return;
    setDraft(DEFAULT_MINIAPP_UI);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'miniapp-appearance.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /> در حال بارگذاری تنظیمات ظاهر…
      </div>
    );
  }

  const roleKeys = Object.keys(MINIAPP_ROLE_LABELS) as MiniAppRoleKey[];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">تنظیمات ظاهر مینی‌اپ</h2>
            <p className="text-[11px] text-slate-400">رنگ‌ها، فونت و اندازه‌ی هر بخش را تنظیم کنید. پیش‌نمایش زنده در پایین صفحه است.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportJson} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer">
            <Download className="w-3.5 h-3.5" /> خروجی JSON
          </button>
          <button onClick={resetDefaults} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" /> بازگشت به پیش‌فرض
          </button>
          <button
            onClick={() => save(draft)}
            disabled={saving || !dirty || invalidColors.length > 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-700/30 disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            ذخیره تغییرات
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-xs border ${msg.type === 'ok' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' : 'bg-rose-500/15 border-rose-500/40 text-rose-200'}`}>
          {msg.text}
        </div>
      )}
      {dirty && !saving && (
        <div className="p-2.5 rounded-xl text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-200">تغییرات ذخیره‌نشده دارید.</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          {/* Colors */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-white mb-4">رنگ‌ها</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COLOR_FIELDS.map((f) => {
                const v = String(draft[f.key]);
                const ok = HEX_RE.test(v);
                return (
                  <div key={f.key} className="flex items-center gap-3 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <input
                      type="color"
                      value={ok ? v : '#000000'}
                      onChange={(e) => setColor(f.key, e.target.value.toUpperCase())}
                      className="w-10 h-10 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-[11px] text-slate-300 mb-1">{f.label}</div>
                      <input
                        value={v}
                        onChange={(e) => setColor(f.key, e.target.value)}
                        dir="ltr"
                        className={`w-full bg-slate-900 border rounded-lg px-2 py-1 text-xs font-mono text-white ${ok ? 'border-slate-700' : 'border-rose-500'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {invalidColors.length > 0 && (
              <p className="text-[11px] text-rose-300 mt-3">کد رنگ باید به شکل #RRGGBB باشد: {invalidColors.map((f) => f.label).join('، ')}</p>
            )}
          </section>

          {/* Shape & font */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-white mb-4">فونت و شکل</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[11px] text-slate-300">فونت</span>
                <select
                  value={draft.fontFamily}
                  onChange={(e) => setDraft((d) => ({ ...d, fontFamily: e.target.value }))}
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"
                >
                  {MINIAPP_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-300">گردی گوشه کارت‌ها و دکمه‌ها: {draft.radius}px</span>
                <input
                  type="range" min={0} max={32} step={1} value={draft.radius}
                  onChange={(e) => setDraft((d) => ({ ...d, radius: Number(e.target.value) }))}
                  className="mt-3 w-full"
                />
              </label>
            </div>
          </section>

          {/* Per-role typography */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-white mb-4 flex items-center gap-2"><Type className="w-4 h-4" /> متن‌ها به تفکیک بخش</h3>
            <div className="space-y-3">
              {roleKeys.map((role) => {
                const r = draft.roles[role];
                const [min, max] = MINIAPP_ROLE_RANGES[role].size;
                return (
                  <div key={role} className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-3 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <div className="text-xs font-bold text-slate-200 pt-1">{MINIAPP_ROLE_LABELS[role]}</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <label className="block">
                        <span className="text-[10px] text-slate-400">اندازه: {r.size}px</span>
                        <input type="range" min={min} max={max} step={0.5} value={r.size}
                          onChange={(e) => setRole(role, 'size', Number(e.target.value))} className="w-full" />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-slate-400">ضخامت: {r.weight}</span>
                        <input type="range" min={300} max={900} step={100} value={r.weight}
                          onChange={(e) => setRole(role, 'weight', Number(e.target.value))} className="w-full" />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-slate-400">فاصله خطوط: {r.lineHeight}</span>
                        <input type="range" min={1} max={2.5} step={0.1} value={r.lineHeight}
                          onChange={(e) => setRole(role, 'lineHeight', Number(e.target.value))} className="w-full" />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-slate-400">رنگ متن</span>
                        <div className="flex items-center gap-2 mt-1">
                          <input type="color" value={HEX_RE.test(r.color) ? r.color : '#000000'}
                            onChange={(e) => setRole(role, 'color', e.target.value.toUpperCase())}
                            className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer" />
                          <input value={r.color} dir="ltr" onChange={(e) => setRole(role, 'color', e.target.value)}
                            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-white" />
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Live preview */}
        <aside className="xl:sticky xl:top-6 self-start">
          <div className="text-[11px] text-slate-400 mb-2">پیش‌نمایش زنده</div>
          <div
            className="p-4 border"
            style={{ background: draft.pageBg, color: draft.textColor, fontFamily: draft.fontFamily, borderColor: draft.cardBorder, borderRadius: draft.radius + 8 }}
          >
            <div
              className="p-4 border space-y-2"
              style={{ background: draft.cardBg, borderColor: draft.cardBorder, borderRadius: draft.radius }}
            >
              <div style={{ fontSize: draft.roles.heading.size, fontWeight: draft.roles.heading.weight, color: draft.roles.heading.color, lineHeight: draft.roles.heading.lineHeight }}>
                ست ۱۲ عددی بلبرینگ صنعتی
              </div>
              <div style={{ fontSize: draft.roles.body.size, fontWeight: draft.roles.body.weight, color: draft.roles.body.color, lineHeight: draft.roles.body.lineHeight }}>
                متن توضیحات محصول برای بررسی اندازه و فاصله‌ی خطوط در مینی‌اپ.
              </div>
              <div style={{ fontSize: draft.roles.small.size, fontWeight: draft.roles.small.weight, color: draft.roles.small.color, lineHeight: draft.roles.small.lineHeight }}>
                ظرفیت: ۲۰ کیلوگرم · جنس: فولاد کروم
              </div>
              <div style={{ fontSize: draft.roles.price.size, fontWeight: draft.roles.price.weight, color: draft.roles.price.color, lineHeight: draft.roles.price.lineHeight }}>
                ۱٬۲۵۰٬۰۰۰ تومان
              </div>
              <div style={{ color: draft.mutedColor, fontSize: 11 }}>نمونه‌ی متن کم‌رنگ</div>
              <div className="flex gap-2 pt-1">
                <span style={{ background: draft.accent, color: draft.buttonText, borderRadius: draft.radius, fontSize: draft.roles.button.size, fontWeight: draft.roles.button.weight, padding: '6px 12px' }}>
                  استعلام قیمت
                </span>
                <span style={{ background: draft.buttonBg, color: draft.buttonText, borderRadius: draft.radius, fontSize: draft.roles.button.size, fontWeight: draft.roles.button.weight, padding: '6px 12px' }}>
                  افزودن
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
