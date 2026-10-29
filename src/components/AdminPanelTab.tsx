import React, { useState } from 'react';
import {
  Users,
  MessageSquare,
  ShieldCheck,
  Check,
  X,
  Send,
  Building,
  Phone,
  Clock,
  DollarSign,
  AlertCircle,
  TrendingUp,
  FileCheck2,
  Package,
  Trash2,
} from 'lucide-react';
import { CustomerUser, CustomerInquiry } from '../types';
import { CurrencyFluctuationChart } from './CurrencyFluctuationChart';
import { TelegramCustomersCard } from './TelegramCustomersCard';

type ReplyResult = { ok: boolean; error?: string; notified?: boolean };

interface AdminPanelTabProps {
  customers: CustomerUser[];
  inquiries: CustomerInquiry[];
  onReplyToInquiry: (inquiryId: string, replyText: string, newStatus?: CustomerInquiry['status'], newUnitPriceToman?: number) => Promise<ReplyResult>;
  onRefresh?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'در انتظار بررسی',
  quoted: 'پیش‌فاکتور صادر شد',
  approved_by_client: 'تایید نهایی مشتری',
  procuring: 'در حال تامین و حمل',
  rejected: 'رد شده',
};
const STATUS_STYLE: Record<string, string> = {
  pending_review: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  quoted: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  approved_by_client: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  procuring: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  rejected: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
};

export const AdminPanelTab: React.FC<AdminPanelTabProps> = ({ customers, inquiries, onReplyToInquiry, onRefresh }) => {
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'inquiries' | 'customers' | 'currency'>('inquiries');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'open'>('all');
  const [replyMessage, setReplyMessage] = useState('');
  const [customQuoteToman, setCustomQuoteToman] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<CustomerInquiry['status']>('quoted');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const pendingCustomers = (customers || []).filter((c) => c?.status === 'pending');
  const approvedCustomers = (customers || []).filter((c) => c?.status === 'approved');
  const pendingInquiries = (inquiries || []).filter((i) => i?.status === 'pending_review');
  const visible = (inquiries || []).filter((i) =>
    filter === 'pending' ? i.status === 'pending_review' : filter === 'open' ? !['rejected', 'approved_by_client'].includes(i.status) : true
  );
  const selectedInquiry = (inquiries || []).find((i) => i.id === selectedId) || null;
  const totalValue = (inquiries || []).filter((i) => i.status !== 'rejected').reduce((acc, i) => acc + (i.totalPriceToman || 0), 0);

  const pick = (inq: CustomerInquiry) => {
    setSelectedId(inq.id);
    setCustomQuoteToman(inq.unitPriceToman || '');
    setSelectedStatus(inq.status === 'pending_review' ? 'quoted' : inq.status);
    setReplyMessage('');
    setFeedback(null);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || busy) return;
    const priceChanged = customQuoteToman !== '' && Number(customQuoteToman) !== selectedInquiry.unitPriceToman;
    if (!replyMessage.trim() && !priceChanged && selectedStatus === selectedInquiry.status) return;
    setBusy(true);
    setFeedback(null);
    const r = await onReplyToInquiry(
      selectedInquiry.id,
      replyMessage.trim(),
      selectedStatus,
      customQuoteToman !== '' ? Number(customQuoteToman) : undefined
    );
    setBusy(false);
    if (r.ok) {
      setReplyMessage('');
      setFeedback({ ok: true, text: r.notified ? 'ذخیره شد و پیام در تلگرام مشتری ارسال شد.' : 'ذخیره شد، اما ارسال پیام تلگرام ناموفق بود (مشتری در مینی‌اپ پاسخ را می‌بیند).' });
    } else {
      setFeedback({ ok: false, text: r.error || 'خطا در ثبت پاسخ' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Admin Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">استعلام‌های در انتظار پاسخ:</div>
            <div className="text-lg font-bold text-white font-mono">{pendingInquiries.length} درخواست</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">همکاران در انتظار تایید دسترسی:</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">{pendingCustomers.length} کاربر</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">خریداران عمده تایید شده:</div>
            <div className="text-lg font-bold text-indigo-300 font-mono">{approvedCustomers.length} همکار</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">کل ارزش پیش‌فاکتورها:</div>
            <div className="text-sm font-bold text-amber-300 font-mono">
              {(totalValue / 1000000).toLocaleString('en-US', { maximumFractionDigits: 1 })} M تومان
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs: Inquiries vs Customers */}
      <div className="flex flex-wrap border-b border-slate-800 gap-3 pb-2">
        <button
          onClick={() => setActiveAdminSubTab('inquiries')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeAdminSubTab === 'inquiries'
              ? 'bg-[#A91D2E] text-white shadow-md shadow-[#A91D2E]/30'
              : 'text-slate-400 hover:text-white bg-[#0B0C0E]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>استعلام‌ها و درخواست‌های قیمت ({inquiries.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('customers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeAdminSubTab === 'customers'
              ? 'bg-[#A91D2E] text-white shadow-md shadow-[#A91D2E]/30'
              : 'text-slate-400 hover:text-white bg-[#0B0C0E]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>همکاران و احراز هویت ({customers.length})</span>
          {pendingCustomers.length > 0 && (
            <span className="bg-[#A91D2E] text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {pendingCustomers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminSubTab('currency')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeAdminSubTab === 'currency'
              ? 'bg-[#A91D2E] text-white shadow-md shadow-[#A91D2E]/30'
              : 'text-slate-400 hover:text-white bg-[#0B0C0E]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>تحلیل نوسانات درهم و یوان (Recharts)</span>
        </button>


        <button onClick={() => onRefresh && onRefresh()} className="mr-auto px-3 py-2 rounded-xl text-xs text-slate-300 bg-[#0B0C0E] hover:text-white cursor-pointer">بروزرسانی</button>
      </div>

      {/* View 3: Recharts Currency Fluctuation Chart */}
      {activeAdminSubTab === 'currency' && <CurrencyFluctuationChart />}


      {/* View 1: استعلام‌های واقعی مشتریان */}
      {activeAdminSubTab === 'inquiries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-300">استعلام‌های دریافتی از مینی‌اپ تلگرام</h4>
              <div className="flex gap-1 text-[10px]">
                {([['all', 'همه'], ['pending', 'در انتظار'], ['open', 'باز']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setFilter(k)} className={`px-2 py-1 rounded-lg cursor-pointer ${filter === k ? 'bg-[#A91D2E] text-white' : 'bg-[#0B0C0E] text-slate-400'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto no-scrollbar">
              {visible.length === 0 && (
                <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl p-6 text-center">
                  هنوز استعلامی ثبت نشده. وقتی همکار تاییدشده از مینی‌اپ استعلام بزند، همین‌جا و در تلگرام شما اعلام می‌شود.
                </div>
              )}
              {visible.map((inq) => {
                const isSelected = selectedId === inq.id;
                const last = inq.messages[inq.messages.length - 1];
                const needsReply = inq.status === 'pending_review';
                return (
                  <div
                    key={inq.id}
                    onClick={() => pick(inq)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                      isSelected ? 'bg-slate-800/90 border-[#A91D2E] ring-1 ring-[#A91D2E]/40' : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400">{inq.id}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[inq.status] || 'bg-slate-800 text-slate-400'}`}>
                        {STATUS_LABEL[inq.status] || inq.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {inq.productImage ? (
                        <img src={inq.productImage} alt="" className="w-11 h-11 rounded-lg object-cover bg-slate-800 shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-slate-800 shrink-0" />
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{inq.productTitle}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                          <span><strong className="text-slate-200">{inq.customerName}</strong></span>
                          <span>•</span>
                          <span><strong className="text-amber-300 font-mono">{inq.requestedQuantity}</strong> عدد</span>
                        </div>
                      </div>
                    </div>
                    {last && (
                      <div className={`text-[11px] truncate ${last.sender === 'customer' && needsReply ? 'text-amber-200' : 'text-slate-500'}`}>
                        {last.sender === 'admin' ? 'شما: ' : 'مشتری: '}{last.text}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-500">{inq.updatedAt}</span>
                      <span className="font-bold text-emerald-400 font-mono">{(inq.totalPriceToman || 0).toLocaleString('en-US')} تومان</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
            {selectedInquiry ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                      <span>مکاتبه با {selectedInquiry.customerName}</span>
                      {selectedInquiry.customerTelegram && <span className="text-xs text-sky-400 font-mono" dir="ltr">@{selectedInquiry.customerTelegram}</span>}
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                      <Phone className="w-3 h-3" />
                      <span>{selectedInquiry.customerPhone || 'تلفن ثبت نشده'}</span>
                      {selectedInquiry.adminNotes && (<><span>•</span><span>{selectedInquiry.adminNotes}</span></>)}
                      <span>•</span>
                      <span className="truncate">{selectedInquiry.productTitle}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      تیراژ: <strong className="text-white font-mono">{selectedInquiry.requestedQuantity}</strong> عدد · قیمت واحد فعلی:{' '}
                      <strong className="text-emerald-400 font-mono">{(selectedInquiry.unitPriceToman || 0).toLocaleString('en-US')}</strong> تومان
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">{selectedInquiry.createdAt}</span>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto no-scrollbar p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  {selectedInquiry.messages.length === 0 && <div className="text-[11px] text-slate-500 text-center py-4">مشتری پیام متنی نگذاشته است؛ فقط درخواست قیمت ثبت شده.</div>}
                  {selectedInquiry.messages.map((m) => {
                    const isAdmin = m.sender === 'admin';
                    return (
                      <div key={m.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-1 ${isAdmin ? 'bg-indigo-600/30 text-indigo-100 border border-indigo-500/40' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                          <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 font-semibold">
                            <span>{m.senderName}</span>
                            <span className="font-mono">{m.timestamp}</span>
                          </div>
                          <p className="whitespace-pre-line">{m.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSendReply} className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">قیمت واحد پیشنهادی هر عدد (تومان):</label>
                      <input
                        type="number"
                        value={customQuoteToman}
                        onChange={(e) => setCustomQuoteToman(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-[#A91D2E]"
                        placeholder="قیمت هر واحد..."
                      />
                      {customQuoteToman !== '' && (
                        <div className="text-[10px] text-slate-500 mt-1">مبلغ کل: {(Number(customQuoteToman) * selectedInquiry.requestedQuantity).toLocaleString('en-US')} تومان</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">وضعیت استعلام:</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value as any)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-[#A91D2E] font-semibold"
                      >
                        <option value="pending_review">در انتظار بررسی</option>
                        <option value="quoted">صدور پیش‌فاکتور (مشتری می‌تواند تایید کند)</option>
                        <option value="approved_by_client">تایید مشتری و ثبت قطعی</option>
                        <option value="procuring">در حال تامین و حمل</option>
                        <option value="rejected">رد درخواست</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 text-xs">پیام برای مشتری (در مینی‌اپ و تلگرام او ارسال می‌شود):</label>
                    <textarea
                      rows={3}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="مثلاً: قیمت نهایی با احتساب حمل… اعتبار پیش‌فاکتور ۲۴ ساعت"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#A91D2E] placeholder:text-slate-500"
                    />
                  </div>

                  {feedback && <div className={`text-[11px] ${feedback.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{feedback.text}</div>}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={busy}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A91D2E] hover:bg-[#871523] text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{busy ? 'در حال ارسال…' : 'ثبت و ارسال به مشتری'}</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">یک استعلام را از لیست انتخاب کنید تا پرونده و پیام‌ها نمایش داده شوند.</div>
            )}
          </div>
        </div>
      )}

      {/* View 2: همکاران و احراز هویت (داده‌ی واقعی تلگرام) */}
      {activeAdminSubTab === 'customers' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4">
          <p className="text-xs text-slate-400">تنها همکارانی که اینجا تایید شوند قیمت‌های پلکانی را می‌بینند و می‌توانند استعلام ثبت کنند. با تایید، پیام تلگرامی برای مشتری ارسال می‌شود.</p>
          <TelegramCustomersCard onChanged={onRefresh} />
        </div>
      )}
    </div>
  );
};
