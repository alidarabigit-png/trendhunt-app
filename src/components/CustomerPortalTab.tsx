import React, { useState } from 'react';
import {
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  FileText,
  Printer,
  Package,
  Layers,
  Building,
  Phone,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { CustomerUser, CustomerInquiry } from '../types';
import { DEFAULT_CUSTOMER } from '../data/sampleCustomers';

interface CustomerPortalTabProps {
  currentCustomer?: CustomerUser;
  onSwitchCustomer: (customer: CustomerUser) => void;
  allCustomers: CustomerUser[];
  inquiries: CustomerInquiry[];
  onCustomerSendMessage: (inquiryId: string, text: string) => void;
  onApproveProforma: (inquiryId: string) => void;
  onRegisterCustomer: (newCustomer: Omit<CustomerUser, 'id' | 'requestedAt' | 'totalOrdersCount' | 'tier' | 'status'>) => void;
}

export const CustomerPortalTab: React.FC<CustomerPortalTabProps> = ({
  currentCustomer,
  onSwitchCustomer,
  allCustomers,
  inquiries,
  onCustomerSendMessage,
  onApproveProforma,
  onRegisterCustomer,
}) => {
  const customer = currentCustomer || DEFAULT_CUSTOMER;
  const [customerInquirySelection, setCustomerInquirySelection] = useState<string | null>(
    inquiries.find((i) => i.customerId === customer.id)?.id || null
  );
  const [customerReply, setCustomerReply] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // New registration form state
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regTelegram, setRegTelegram] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('');

  const myInquiries = inquiries.filter((i) => i.customerId === customer.id);
  const selectedInq = myInquiries.find((i) => i.id === customerInquirySelection) || myInquiries[0] || null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInq || !customerReply.trim()) return;
    onCustomerSendMessage(selectedInq.id, customerReply.trim());
    setCustomerReply('');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regPhone) return;
    onRegisterCustomer({
      name: regName,
      companyName: regCompany || 'فروشگاه آزاد',
      telegramUsername: regTelegram.replace('@', ''),
      phone: regPhone,
      city: regCity || 'تهران',
      role: 'customer',
    });
    setShowRegisterForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Customer Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shrink-0">
              {customer.name ? customer.name.substring(0, 1) : 'U'}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white">{customer.name}</h2>
                <span className="text-xs text-sky-400 font-mono" dir="ltr">@{customer.telegramUsername}</span>

                {customer.status === 'approved' ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    همکار تایید شده (قیمت‌ها فعال)
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    در انتظار احراز هویت مدیریت
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                <span>شرکت/فروشگاه: <strong className="text-slate-200">{customer.companyName || 'ثبت نشده'}</strong></span>
                <span>•</span>
                <span>شهر: <strong className="text-slate-200">{customer.city || 'تهران'}</strong></span>
                <span>•</span>
                <span>تلفن: <strong className="text-slate-200 font-mono">{customer.phone || '—'}</strong></span>
                <span>•</span>
                <span>سطح خرید: <strong className="text-amber-300">{customer.tier || 'همکار برنزی'}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Account Switcher (for testing verified vs unverified) */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <select
              value={customer.id}
              onChange={(e) => {
                const found = allCustomers.find((c) => c.id === e.target.value);
                if (found) onSwitchCustomer(found);
              }}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-400 font-semibold cursor-pointer"
            >
              {(allCustomers || []).map((c) => (
                <option key={c.id} value={c.id}>
                  تست حساب: {c.name} ({c.status === 'approved' ? 'تایید شده' : 'در انتظار'})
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowRegisterForm(true)}
              className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition"
            >
              + ثبت همکار جدید
            </button>
          </div>
        </div>
      </div>

      {/* If customer is pending verification, show prominent explanation */}
      {customer.status !== 'approved' && (
        <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-2 text-xs text-amber-200">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
            <Lock className="w-4 h-4" />
            <span>حساب کاربری شما هنوز توسط مدیریت بازرگانی تایید نشده است</span>
          </div>
          <p className="leading-relaxed text-amber-200/90">
            به منظور حفظ منافع و حاشیه سود همکاران و عمده‌فروشان، قیمت‌های عمده و امکان ثبت سفارش تنها برای اعضای تایید شده فعال است.
            مدیریت در حال بررسی مدارک و اطلاعات شماست. می‌توانید از طریق تب «پنل ادمین و CRM» در بالای صفحه، فوراً حساب خود را به وضعیت «تایید شده» تغییر دهید تا قیمت‌ها آنلاک شوند.
          </p>
        </div>
      )}

      {/* Customer Inquiries & Proforma Invoices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: My Inquiries List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-400" />
              <span>استعلام‌ها و پیش‌فاکتورهای من ({myInquiries.length})</span>
            </h3>
          </div>

          {myInquiries.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2 text-xs text-slate-400">
              <p>شما هنوز استعلامی ثبت نکرده‌اید.</p>
              <p className="text-[11px] text-slate-500">
                در تب «مینی‌آپ تلگرام» می‌توانید روی هر کالا کلیک کرده و استعلام تیراژ ارسال فرمایید.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {myInquiries.map((inq) => {
                const isSelected = selectedInq?.id === inq.id;
                return (
                  <div
                    key={inq.id}
                    onClick={() => setCustomerInquirySelection(inq.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-400 ring-1 ring-sky-400/40'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">{inq.id}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          inq.status === 'quoted'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : inq.status === 'approved_by_client'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : inq.status === 'procuring'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {inq.status === 'quoted'
                          ? 'پیش‌فاکتور آماده است'
                          : inq.status === 'approved_by_client'
                          ? 'تایید نهایی شده'
                          : inq.status === 'procuring'
                          ? 'در حال حمل هوایی'
                          : 'در حال بررسی'}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-white line-clamp-1">{inq.productTitle}</div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                      <span className="text-slate-400">تیراژ: <strong className="text-white font-mono">{inq.requestedQuantity}</strong> عدد</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {inq.totalPriceToman.toLocaleString('en-US')} ت
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Detailed Proforma Invoice & Messaging */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-5">
          {selectedInq ? (
            <>
              {/* Proforma Invoice Document View */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">پیش‌فاکتور رسمی استعلام تیراژ</h4>
                      <span className="text-[10px] text-slate-400 font-mono">شماره سفارش: {selectedInq.id}</span>
                    </div>
                  </div>

                  <span className="text-xs font-mono text-slate-400">{selectedInq.updatedAt}</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <img
                    src={selectedInq.productImage}
                    alt=""
                    className="w-20 h-20 rounded-xl object-cover bg-slate-800 shrink-0"
                  />
                  <div className="space-y-1 text-xs flex-1">
                    <div className="font-bold text-white leading-snug">{selectedInq.productTitle}</div>
                    <div className="text-slate-400 flex items-center gap-3 pt-1">
                      <span>تیراژ درخواستی: <strong className="text-amber-300 font-mono">{selectedInq.requestedQuantity}</strong> عدد</span>
                      <span>•</span>
                      <span>فی هر واحد: <strong className="text-emerald-400 font-mono">{selectedInq.unitPriceToman.toLocaleString('en-US')}</strong> تومان</span>
                    </div>
                  </div>

                  <div className="text-left sm:border-r border-slate-800 sm:pr-4">
                    <div className="text-[10px] text-slate-400">مبلغ کل فاکتور:</div>
                    <div className="text-base font-extrabold text-amber-300 font-mono">
                      {selectedInq.totalPriceToman.toLocaleString('en-US')} تومان
                    </div>
                  </div>
                </div>

                {selectedInq.adminNotes && (
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
                    <strong className="text-amber-300">یادداشت مدیریت بازرگانی: </strong>
                    {selectedInq.adminNotes}
                  </div>
                )}

                {selectedInq.status === 'quoted' && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => onApproveProforma(selectedInq.id)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تایید نهایی پیش‌فاکتور و آغاز فرآیند واردات</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Live Chat with Admin about this Inquiry */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                  <span>مکاتبه مستقیم با کارشناس تامین در خصوص این سفارش:</span>
                </h4>

                <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar p-3 bg-slate-950/70 rounded-2xl border border-slate-800">
                  {selectedInq.messages.map((m) => {
                    const isMe = m.sender === 'customer';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-1 ${
                            isMe
                              ? 'bg-sky-600 text-white shadow-sm'
                              : 'bg-slate-800 text-white border border-slate-700 shadow-sm'
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

                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="پیام یا سوال خود را درباره زمان تحویل، نحوه پرداخت و بارگیری بنویسید..."
                    value={customerReply}
                    onChange={(e) => setCustomerReply(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="submit"
                    disabled={!customerReply.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>ارسال</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-xs text-slate-500">
              هیچ استعلامی برای نمایش انتخاب نشده است.
            </div>
          )}
        </div>
      </div>

      {/* Register New Customer Modal */}
      {showRegisterForm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">ثبت نام همکار جدید جهت احراز هویت</h3>
            <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">نام و نام خانوادگی:</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  placeholder="مثال: علیرضا محمدی"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">نام شرکت یا فروشگاه:</label>
                <input
                  type="text"
                  value={regCompany}
                  onChange={(e) => setRegCompany(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  placeholder="مثال: بازرگانی پارس گستر"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">آیدی تلگرام (بدون @):</label>
                <input
                  type="text"
                  value={regTelegram}
                  onChange={(e) => setRegTelegram(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  placeholder="ali_b2b"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">شماره تماس همراه:</label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  placeholder="09121234567"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">شهر فعالیت:</label>
                <input
                  type="text"
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  placeholder="تهران"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                >
                  ارسال درخواست عضویت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
