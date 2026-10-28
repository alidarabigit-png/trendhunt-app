import React, { useCallback, useEffect, useState } from 'react';

interface TgCustomer {
  telegramUserId: number;
  name?: string;
  username?: string;
  phone?: string;
  status: 'approved' | 'pending' | 'rejected';
  createdAt?: string;
}

/** مشتریان واقعی تلگرام: تایید / رد دسترسی به قیمت‌ها (قفل سمت سرور) */
export const TelegramCustomersCard: React.FC = () => {
  const [list, setList] = useState<TgCustomer[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const key = () => (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nfs_admin_key') || '' : '');

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch('/api.php?action=list_customers', { headers: { 'X-Admin-Key': key() }, cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'خطا');
      setList(d.customers || []);
    } catch (e: any) {
      setErr(e?.message || 'خطا در دریافت فهرست');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: number, status: TgCustomer['status']) => {
    setBusyId(id);
    try {
      const r = await fetch('/api.php?action=set_customer_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key() },
        body: JSON.stringify({ telegramUserId: id, status }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'خطا');
      await load();
    } catch (e: any) {
      alert('خطا: ' + (e?.message || ''));
    }
    setBusyId(null);
  };

  const sorted = [...list].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0));
  const label = { approved: 'تایید شده', pending: 'در انتظار', rejected: 'رد شده' } as const;
  const color = { approved: 'text-emerald-400', pending: 'text-amber-300', rejected: 'text-rose-400' } as const;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">مشتریان تلگرام (قفل قیمت واقعی)</h4>
          <p className="text-[11px] text-slate-400">هر کسی مینی‌اپ را باز کند اینجا «در انتظار» ثبت می‌شود و تا تایید شما قیمتی نمی‌بیند.</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 cursor-pointer">بروزرسانی</button>
      </div>
      {err && <div className="text-xs text-rose-400">{err}</div>}
      {sorted.length === 0 && !err && <div className="text-xs text-slate-500">هنوز مشتری ثبت نشده.</div>}
      <div className="space-y-2">
        {sorted.map((c) => (
          <div key={c.telegramUserId} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 p-2.5">
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{c.name || 'بدون نام'}</div>
              <div className="text-[11px] text-slate-400" dir="ltr">
                {c.username ? '@' + c.username + ' · ' : ''}
                {c.telegramUserId}
                {c.phone ? ' · ' + c.phone : ''}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[11px] font-bold ${color[c.status]}`}>{label[c.status]}</span>
              {c.status !== 'approved' && (
                <button disabled={busyId === c.telegramUserId} onClick={() => setStatus(c.telegramUserId, 'approved')} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50">تایید</button>
              )}
              {c.status !== 'rejected' && (
                <button disabled={busyId === c.telegramUserId} onClick={() => setStatus(c.telegramUserId, 'rejected')} className="px-2.5 py-1 rounded-lg bg-slate-700 text-white text-[11px] cursor-pointer disabled:opacity-50">رد</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
