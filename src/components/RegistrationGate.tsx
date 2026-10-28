import React, { useEffect, useState } from 'react';
import { Lock, CheckCircle2, Clock } from 'lucide-react';

const ACTIVITIES = ['فروشگاه اینترنتی', 'فروشگاه حضوری', 'عمده‌فروش / پخش', 'واردکننده', 'تولیدکننده', 'نمایندگی / سازمانی', 'سایر'];

interface Profile { name: string; companyName: string; phone: string; activityType: string; city: string; address: string }
const EMPTY: Profile = { name: '', companyName: '', phone: '', activityType: '', city: '', address: '' };

const initData = (): string => (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) || '';

/** فرم احراز هویت همکار؛ تا تایید ادمین قیمت‌ها قفل می‌ماند */
export const RegistrationGate: React.FC = () => {
  const [status, setStatus] = useState<string>('loading');
  const [registered, setRegistered] = useState(false);
  const [form, setForm] = useState<Profile>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const hdr = () => ({ 'X-Telegram-Init-Data': initData(), 'Content-Type': 'application/json' });

  const load = async () => {
    try {
      const r = await fetch('/api.php?action=my_status&_t=' + Date.now(), { headers: hdr(), cache: 'no-store' });
      const d = await r.json();
      setStatus(d.status || 'anonymous');
      setRegistered(!!d.registered);
      if (d.profile) setForm({ ...EMPTY, ...d.profile });
    } catch (e) {
      setStatus('anonymous');
    }
  };
  useEffect(() => { load(); }, []);

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await fetch('/api.php?action=submit_registration', { method: 'POST', headers: hdr(), body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'خطا در ثبت');
      setEditing(false);
      await load();
    } catch (e: any) {
      setErr(e?.message || 'خطا در ثبت');
    }
    setBusy(false);
  };

  if (status === 'loading' || status === 'approved') return null;

  const box = 'p-3 rounded-xl border border-[color:color-mix(in_srgb,var(--mx-price)_30%,transparent)] bg-[color-mix(in_srgb,var(--mx-price)_8%,transparent)] text-[11px] space-y-2';
  const inp = 'w-full px-2.5 py-2 rounded-lg bg-[var(--mx-card)] border border-[color:var(--mx-border)] text-[12px] text-[color:var(--mx-text)] outline-none focus:border-[color:var(--mx-accent)]';

  if (status === 'anonymous') {
    return (
      <div className={box}>
        <div className="font-bold flex items-center gap-1"><Lock className="w-3.5 h-3.5" />قیمت‌ها فقط برای همکاران تاییدشده است</div>
        <p className="opacity-80 leading-relaxed">برای ثبت درخواست، مینی‌اپ را از داخل ربات تلگرام باز کنید.</p>
      </div>
    );
  }

  if (registered && !editing) {
    return (
      <div className={box}>
        <div className="font-bold flex items-center gap-1">
          {status === 'rejected' ? <Lock className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          {status === 'rejected' ? 'درخواست شما تایید نشد' : 'مشخصات شما ثبت شد؛ در انتظار تایید مدیریت'}
        </div>
        <p className="opacity-80 leading-relaxed">
          {status === 'rejected' ? 'می‌توانید مشخصات را اصلاح و دوباره ارسال کنید.' : 'پس از بررسی، نتیجه از طریق ربات به شما اعلام می‌شود و قیمت‌ها فعال خواهند شد.'}
        </p>
        <button onClick={() => setEditing(true)} className="underline opacity-80 cursor-pointer">ویرایش مشخصات</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={box}>
      <div className="font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />احراز هویت همکار برای مشاهده قیمت‌ها</div>
      <p className="opacity-80 leading-relaxed">مشخصات زیر را کامل وارد کنید. پس از بررسی و تایید مدیریت، قیمت‌های عمده نمایش داده می‌شود.</p>
      <input className={inp} placeholder="نام و نام خانوادگی *" value={form.name} onChange={set('name')} required />
      <input className={inp} placeholder="نام فروشگاه / شرکت" value={form.companyName} onChange={set('companyName')} />
      <input className={inp} placeholder="شماره تماس * (مثلاً 09121234567)" value={form.phone} onChange={set('phone')} inputMode="tel" dir="ltr" required />
      <select className={inp} value={form.activityType} onChange={set('activityType')} required>
        <option value="">نوع فعالیت *</option>
        {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <input className={inp} placeholder="شهر *" value={form.city} onChange={set('city')} required />
      <textarea className={inp} placeholder="آدرس کامل *" rows={2} value={form.address} onChange={set('address')} required />
      {err && <div className="text-rose-500">{err}</div>}
      <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-[var(--mx-btn)] text-[color:var(--mx-btn-text)] font-bold cursor-pointer disabled:opacity-50">
        {busy ? 'در حال ثبت…' : 'ارسال برای بررسی'}
      </button>
    </form>
  );
};
