import { CustomerInquiry, CustomerUser } from '../types';

/** لایه‌ی ارتباط با سرور برای استعلام‌ها و مشتریان (مینی‌اپ و پنل ادمین از همین‌جا کار می‌کنند) */

const host = () =>
  typeof window !== 'undefined' && (window.location.hostname.includes('nafisstore.com') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.pathname.includes('.php'))
    ? ''
    : 'https://nfs.nafisstore.com';

export const tgInitData = (): string =>
  (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) || '';

export const adminKey = (): string => {
  try {
    return sessionStorage.getItem('nfs_admin_key') || '';
  } catch (e) {
    return '';
  }
};

const fmt = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) {
    return d.toLocaleString();
  }
};

export interface ApiResult<T = any> {
  ok: boolean;
  error?: string;
  data?: T;
}

async function call(action: string, opts: { admin?: boolean; body?: any } = {}): Promise<ApiResult> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.admin) headers['X-Admin-Key'] = adminKey();
    const body = opts.body !== undefined ? { ...opts.body, ...(opts.admin ? {} : { initData: tgInitData() }) } : undefined;
    const r = await fetch(`${host()}/api.php?action=${action}&_t=${Date.now()}`, {
      method: body !== undefined ? 'POST' : 'GET',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.success === false) return { ok: false, error: d?.error || `خطا (${r.status})`, data: d };
    return { ok: true, data: d };
  } catch (e: any) {
    return { ok: false, error: 'ارتباط با سرور برقرار نشد' };
  }
}

const mapInquiry = (q: any): CustomerInquiry => ({
  id: q.id,
  customerId: String(q.customerId || q.telegramUserId || ''),
  customerName: q.customerName || 'بدون نام',
  customerTelegram: q.customerTelegram || '',
  customerPhone: q.customerPhone || '',
  productId: q.productId || '',
  productTitle: q.productTitle || '',
  productImage: q.productImage || '',
  requestedQuantity: Number(q.requestedQuantity) || 0,
  unitPriceToman: Number(q.unitPriceToman) || 0,
  totalPriceToman: Number(q.totalPriceToman) || 0,
  unitPriceUsd: Number(q.unitPriceUsd) || undefined,
  status: q.status,
  createdAt: fmt(q.createdAt),
  updatedAt: fmt(q.updatedAt),
  messages: (q.messages || []).map((m: any) => ({
    id: m.id,
    sender: m.sender === 'admin' ? 'admin' : 'customer',
    senderName: m.senderName || (m.sender === 'admin' ? 'مدیریت بازرگانی' : 'مشتری'),
    text: m.text,
    timestamp: fmt(m.at),
  })),
  adminNotes: q.companyName || undefined,
});

/* ---- مشتری (داخل تلگرام) ---- */
export const fetchMyInquiries = async (): Promise<CustomerInquiry[] | null> => {
  const r = await call('my_inquiries', { body: {} });
  return r.ok ? (r.data.inquiries || []).map(mapInquiry) : null;
};

export const submitInquiry = (productId: string, quantity: number, message: string) =>
  call('submit_inquiry', { body: { productId, quantity, message } });

export const customerSendMessage = (inquiryId: string, text: string) =>
  call('inquiry_message', { body: { inquiryId, text } });

export const customerConfirmProforma = (inquiryId: string) => call('inquiry_confirm', { body: { inquiryId } });

/* ---- ادمین ---- */
export const adminListInquiries = async (): Promise<CustomerInquiry[] | null> => {
  const r = await call('list_inquiries', { admin: true });
  return r.ok ? (r.data.inquiries || []).map(mapInquiry) : null;
};

export const adminReply = (inquiryId: string, p: { text?: string; status?: string; unitPriceToman?: number }) =>
  call('reply_inquiry', { admin: true, body: { inquiryId, ...p } });

export const adminListCustomers = async (): Promise<CustomerUser[] | null> => {
  const r = await call('list_customers', { admin: true });
  if (!r.ok) return null;
  return (r.data.customers || []).map(
    (c: any): CustomerUser => ({
      id: String(c.telegramUserId),
      telegramId: String(c.telegramUserId),
      name: c.name || 'بدون نام',
      telegramUsername: c.username || '',
      companyName: c.companyName || '',
      city: c.city || '',
      phone: c.phone || '',
      role: 'customer',
      status: c.status,
      requestedAt: c.createdAt || '',
      tier: 'همکار برنزی',
      totalOrdersCount: 0,
    })
  );
};
