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

interface AdminPanelTabProps {
  customers: CustomerUser[];
  onApproveCustomer: (id: string) => void;
  onRejectCustomer: (id: string) => void;
  inquiries: CustomerInquiry[];
  onReplyToInquiry: (inquiryId: string, replyText: string, newStatus?: CustomerInquiry['status'], newUnitPriceToman?: number) => void;
  onClearDemoData?: () => void;
}

export const AdminPanelTab: React.FC<AdminPanelTabProps> = ({
  customers,
  onApproveCustomer,
  onRejectCustomer,
  inquiries,
  onReplyToInquiry,
  onClearDemoData,
}) => {
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'inquiries' | 'customers' | 'currency'>('inquiries');
  const [selectedInquiry, setSelectedInquiry] = useState<CustomerInquiry | null>(inquiries[0] || null);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [customQuoteToman, setCustomQuoteToman] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<CustomerInquiry['status']>('quoted');

  const pendingCustomers = (customers || []).filter((c) => c?.status === 'pending');
  const approvedCustomers = (customers || []).filter((c) => c?.status === 'approved');
  const pendingInquiries = (inquiries || []).filter((i) => i?.status === 'pending_review');

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || !replyMessage.trim()) return;

    onReplyToInquiry(
      selectedInquiry.id,
      replyMessage.trim(),
      selectedStatus,
      customQuoteToman ? Number(customQuoteToman) : undefined
    );

    setReplyMessage('');
    setCustomQuoteToman('');
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
              {(inquiries.reduce((acc, i) => acc + i.totalPriceToman, 0) / 1000000).toLocaleString('en-US')} M تومان
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs: Inquiries vs Customers */}
      <div className="flex border-b border-slate-800 gap-3 pb-2">
        <button
          onClick={() => setActiveAdminSubTab('inquiries')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeAdminSubTab === 'inquiries'
              ? 'bg-[#E63946] text-white shadow-md shadow-[#E63946]/30'
              : 'text-slate-400 hover:text-white bg-[#0F172A]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>استعلام‌ها و درخواست‌های قیمت ({inquiries.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('customers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeAdminSubTab === 'customers'
              ? 'bg-[#E63946] text-white shadow-md shadow-[#E63946]/30'
              : 'text-slate-400 hover:text-white bg-[#0F172A]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>تایید و مدیریت همکاران و مشتریان ({customers.length})</span>
          {pendingCustomers.length > 0 && (
            <span className="bg-[#E63946] text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {pendingCustomers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminSubTab('currency')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeAdminSubTab === 'currency'
              ? 'bg-[#E63946] text-white shadow-md shadow-[#E63946]/30'
              : 'text-slate-400 hover:text-white bg-[#0F172A]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>تحلیل نوسانات درهم و یوان (Recharts)</span>
        </button>

        {onClearDemoData && (
          isConfirmingClear ? (
            <div className="mr-auto flex items-center gap-1.5 bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg animate-pulse">
              <button
                onClick={() => {
                  onClearDemoData();
                  setIsConfirmingClear(false);
                }}
                className="cursor-pointer hover:underline flex items-center gap-1 text-white"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مطمئنید؟ کلیک مجدد برای حذف قطعی</span>
              </button>
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="p-1 hover:bg-rose-700 rounded-lg text-white/90 hover:text-white cursor-pointer"
                title="انصراف"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsConfirmingClear(true);
                setTimeout(() => setIsConfirmingClear(false), 5000);
              }}
              className="mr-auto px-3 py-1.5 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 transition cursor-pointer flex items-center gap-1.5"
              title="حذف داده‌های آزمایشی و تست"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>پاکسازی داده‌های نمونه</span>
            </button>
          )
        )}
      </div>

      {/* View 3: Recharts Currency Fluctuation Chart */}
      {activeAdminSubTab === 'currency' && <CurrencyFluctuationChart />}

      {/* View 1: Inquiries Management & Quick CRM Chat */}
      {activeAdminSubTab === 'inquiries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Inquiries List (Left 5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300">لیست استعلام‌های دریافتی از مینی‌آپ تلگرام:</h4>
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto no-scrollbar">
              {inquiries.map((inq) => {
                const isSelected = selectedInquiry?.id === inq.id;
                return (
                  <div
                    key={inq.id}
                    onClick={() => {
                      setSelectedInquiry(inq);
                      setCustomQuoteToman(inq.unitPriceToman);
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-slate-800/90 border-amber-400/80 ring-1 ring-amber-400/40'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400">{inq.id}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          inq.status === 'pending_review'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : inq.status === 'quoted'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : inq.status === 'approved_by_client'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {inq.status === 'pending_review'
                          ? 'در انتظار بررسی'
                          : inq.status === 'quoted'
                          ? 'پیش‌فاکتور صادر شد'
                          : inq.status === 'approved_by_client'
                          ? 'تایید نهایی مشتری'
                          : 'بایگانی'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <img
                        src={inq.productImage}
                        alt=""
                        className="w-11 h-11 rounded-lg object-cover bg-slate-800 shrink-0"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{inq.productTitle}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>مشتری: <strong className="text-slate-200">{inq.customerName}</strong></span>
                          <span>•</span>
                          <span>تیراژ: <strong className="text-amber-300 font-mono">{inq.requestedQuantity}</strong> عدد</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400">مبلغ کل پیشنهادی:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {inq.totalPriceToman.toLocaleString('en-US')} تومان
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Chat & Quote Form (Right 7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
            {selectedInquiry ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>مکاتبه با {selectedInquiry.customerName}</span>
                      <span className="text-xs text-sky-400 font-mono" dir="ltr">@{selectedInquiry.customerTelegram}</span>
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{selectedInquiry.customerPhone}</span>
                      <span>•</span>
                      <span>تیراژ درخواستی: <strong className="text-white font-mono">{selectedInquiry.requestedQuantity}</strong> عدد</span>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">{selectedInquiry.createdAt}</span>
                </div>

                {/* Conversation History */}
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto no-scrollbar p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  {selectedInquiry.messages.map((m) => {
                    const isAdmin = m.sender === 'admin';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-1 ${
                            isAdmin
                              ? 'bg-indigo-600/30 text-indigo-100 border border-indigo-500/40'
                              : 'bg-slate-800 text-slate-200 border border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-75 font-semibold">
                            <span>{m.senderName}</span>
                            <span className="font-mono">{m.timestamp}</span>
                          </div>
                          <p>{m.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Admin Reply & Pricing Controls */}
                <form onSubmit={handleSendReply} className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">قیمت واحد پیشنهادی هر عدد (تومان):</label>
                      <input
                        type="number"
                        value={customQuoteToman}
                        onChange={(e) => setCustomQuoteToman(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-400"
                        placeholder="قیمت هر واحد..."
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">تغییر وضعیت استعلام:</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value as any)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400 font-semibold"
                      >
                        <option value="pending_review">در انتظار بررسی</option>
                        <option value="quoted">صدور پیش‌فاکتور (قیمت تایید شد)</option>
                        <option value="approved_by_client">تایید مشتری و ثبت قطعی</option>
                        <option value="procuring">در حال بارگیری از گمرک چین / دبی</option>
                        <option value="rejected">رد درخواست</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 text-xs">متن پیام یا توضیحات پیش‌فاکتور برای مشتری:</label>
                    <textarea
                      rows={3}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="متن پیام شما مستقیماً در پنل شخصی مشتری در مینی‌آپ و تلگرام ارسال می‌شود..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!replyMessage.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>ارسال پاسخ و پیش‌فاکتور به مشتری</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">
                یک استعلام را از لیست انتخاب کنید تا پرونده و پیام‌ها نمایش داده شوند.
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 2: Customer Approval & Verification List */}
      {activeAdminSubTab === 'customers' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-white text-sm">احراز هویت همکاران و اعطای دسترسی به قیمت‌های عمده</h3>
              <p className="text-xs text-slate-400">
                تنها کاربرانی که در این بخش تایید شوند می‌توانند قیمت‌های پلکانی را در مینی‌آپ و کانال مشاهده کنند.
              </p>
            </div>
            <span className="text-xs text-amber-300 font-mono font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
              {customers.length} کاربر ثبت شده
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <th className="p-3">نام و شرکت همکار</th>
                  <th className="p-3">آیدی تلگرام و تلفن</th>
                  <th className="p-3">شهر / منطقه بازرگانی</th>
                  <th className="p-3">سطح دسترسی (Tier)</th>
                  <th className="p-3">وضعیت تایید</th>
                  <th className="p-3 text-center">عملیات احراز هویت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3">
                      <div className="font-bold text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.companyName}</div>
                    </td>
                    <td className="p-3 font-mono">
                      <div className="text-sky-400" dir="ltr">@{c.telegramUsername}</div>
                      <div className="text-slate-400 text-[11px]">{c.phone}</div>
                    </td>
                    <td className="p-3 text-slate-300">{c.city}</td>
                    <td className="p-3">
                      <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-indigo-500/30">
                        {c.tier}
                      </span>
                    </td>
                    <td className="p-3">
                      {c.status === 'approved' ? (
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit">
                          <Check className="w-3 h-3" />
                          تایید شده
                        </span>
                      ) : c.status === 'pending' ? (
                        <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" />
                          در انتظار بررسی
                        </span>
                      ) : (
                        <span className="bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit">
                          رد شده
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {c.status !== 'approved' ? (
                          <button
                            onClick={() => onApproveCustomer(c.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition text-xs shadow-sm cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>تایید و فعال‌سازی قیمت‌ها</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onRejectCustomer(c.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 transition text-[11px] cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>تعلیق دسترسی</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
