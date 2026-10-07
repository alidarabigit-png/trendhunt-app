import { CustomerUser, CustomerInquiry } from '../types';

export const DEFAULT_CUSTOMER: CustomerUser = {
  id: 'USR-DEFAULT',
  name: 'کاربر همکار',
  telegramUsername: '@nafis_partner',
  companyName: 'فروشگاه آنلاین',
  city: 'تهران',
  phone: '09120000000',
  role: 'customer',
  status: 'approved',
  requestedAt: '2026-10-01',
  tier: 'همکار نقره‌ای (تایید شده)',
  totalOrdersCount: 0,
};

export const INITIAL_CUSTOMERS: CustomerUser[] = [DEFAULT_CUSTOMER];

export const INITIAL_INQUIRIES: CustomerInquiry[] = [];
