import React, { useState } from 'react';
import { UserCheck, Clock, CheckCircle2, XCircle, Phone, Building, MapPin, MessageSquare, ArrowLeft } from 'lucide-react';
import { CustomerUser, CustomerInquiry } from '../types';

interface CustomerPortalTabProps {
  customers: CustomerUser[];
  inquiries: CustomerInquiry[];
  onRefresh?: () => void;
  onGoToInquiries?: () => void;
}

const ST: Record<string, { label: string; cls: string }> = {
  approved: { label: 'تایید شده', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  pending: { label: 'در انتظار', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  rejected: { label: 'رد شده', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
};
const INQ_LABEL: Record<string, string> = {
  pending_review: 'در انتظار بررسی',
  quoted: 'پیش‌فاکتور صادر شد',
  approved_by_client: 'تایید نهایی مشتری',
  procuring: 'در حال تامین و حمل',
  rejected: 'رد شده',
};

/** پرونده‌ی همکاران: مشخصات، وضعیت احراز هویت و تاریخچه‌ی استعلام‌ها (داده‌ی واقعی سرور، فقط‌خواندنی) */
export const CustomerPortalTab: React.FC<CustomerPortalTabProps> = ({ customers, inquiries, onRefresh, onGoToInquiries }) => {
  const [selId, setSelId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const list = customers.filter((c) => !q || `${c.name} ${c.companyName} ${c.phone} ${c.telegramUsername}`.toLowerCase().includes(q.toLowerCase()));
  const sel = customers.find((c) => c.id === selId) || null;
  const mine = sel ? inquiries.filter((i) => i.customerId === sel.id) : [];
  const countFor = (id: string) => inquiries.filter((i) => i.customerId === id).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><UserCheck className="w-4 h-4" />پرونده‌ی همکاران ({customers.length})</h4>
          <button onClick={() => onRefresh && onRefresh()} className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300 cursor-pointer">بروزرسانی</button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی نام، شرکت، تلفن…"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#A91D2E]"
        />
        <div className="space-y-2 max-h-[640px] overflow-y-auto no-scrollbar">
          {list.length === 0 && <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl p-6 text-center">همکاری پیدا نشد.</div>}
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelId(c.id)}
              className={`w-full text-right p-3 rounded-2xl border transition cursor-pointer ${selId === c.id ? 'bg-slate-800/90 border-[#A91D2E]' : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white truncate">{c.name}{c.companyName ? ` — ${c.companyName}` : ''}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${ST[c.status]?.cls}`}>{ST[c.status]?.label}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5" dir="ltr">{c.telegramUsername ? '@' + c.telegramUsername + ' · ' : ''}{c.phone || '—'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{countFor(c.id)} استعلام</div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
        {sel ? (
          <>
            <div className="pb-3 border-b border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">{sel.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold flex items-center gap-1 ${ST[sel.status]?.cls}`}>
                  {sel.status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> : sel.status === 'pending' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {ST[sel.status]?.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                {sel.companyName && <span className="flex items-center gap-1"><Building className="w-3 h-3" />{sel.companyName}</span>}
                {sel.phone && <span className="flex items-center gap-1 font-mono"><Phone className="w-3 h-3" />{sel.phone}</span>}
                {sel.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sel.city}</span>}
              </div>
              {sel.status !== 'approved' && (
                <div className="text-[11px] text-amber-300">تایید یا رد دسترسی از تب «پنل ادمین و CRM ← همکاران و احراز هویت» انجام می‌شود.</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><MessageSquare className="w-4 h-4" />تاریخچه‌ی استعلام‌ها ({mine.length})</h4>
                {onGoToInquiries && (
                  <button onClick={onGoToInquiries} className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer">
                    پاسخ‌دهی در پنل ادمین <ArrowLeft className="w-3 h-3" />
                  </button>
                )}
              </div>
              {mine.length === 0 && <div className="text-xs text-slate-500 text-center py-8">این همکار هنوز استعلامی ثبت نکرده است.</div>}
              {mine.map((i) => (
                <div key={i.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-slate-400">{i.id}</span>
                    <span className="font-bold text-[#E6B3BA]">{INQ_LABEL[i.status] || i.status}</span>
                  </div>
                  <div className="text-xs font-bold text-white">{i.productTitle}</div>
                  <div className="text-[11px] text-slate-400">
                    {i.requestedQuantity} عدد · {(i.unitPriceToman || 0).toLocaleString('en-US')} تومان/واحد · کل {(i.totalPriceToman || 0).toLocaleString('en-US')} تومان
                  </div>
                  {i.messages.map((m) => (
                    <div key={m.id} className={`text-[11px] rounded-xl px-2.5 py-1.5 ${m.sender === 'admin' ? 'bg-indigo-600/20 text-indigo-100' : 'bg-slate-800 text-slate-200'}`}>
                      <span className="opacity-60 text-[10px]">{m.senderName} · {m.timestamp}</span>
                      <div className="whitespace-pre-line">{m.text}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-slate-500 text-xs">یک همکار را انتخاب کنید تا مشخصات و تاریخچه‌ی استعلام‌هایش نمایش داده شود.</div>
        )}
      </div>
    </div>
  );
};
