import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Bot,
  Palette,
  UploadCloud,
  Package,
  Smartphone,
  Send,
  FileSpreadsheet,
  Workflow,
  LogOut,
  RefreshCw,
  Coins,
  ShieldCheck,
  UserCheck,
  PlusCircle,
  TrendingUp,
  Menu,
  X,
  ChevronLeft,
  Sun,
  Moon,
  Download,
  FileArchive,
} from 'lucide-react';
import { CurrencyRates, CustomerUser } from '../types';
import { NfsLogo } from './NfsLogo';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  currencyRates: CurrencyRates;
  onRefreshRates: () => void;
  isRefreshingRates: boolean;
  productsCount: number;
  syncedSheetsCount: number;
  pendingInquiriesCount: number;
  pendingCustomersCount: number;
  onOpenManualIngest: () => void;
  currentCustomer: CustomerUser;
  onOpenCurrencyModal?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSwitchToMiniApp?: () => void;
  onOpenDeployModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogin,
  onLogout,
  isLoggingIn,
  currencyRates,
  onRefreshRates,
  isRefreshingRates,
  productsCount,
  syncedSheetsCount,
  pendingInquiriesCount,
  pendingCustomersCount,
  onOpenManualIngest,
  currentCustomer,
  onOpenCurrencyModal,
  theme,
  onToggleTheme,
  onSwitchToMiniApp,
  onOpenDeployModal,
}) => {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const tabs = [
    { id: 'manual', label: 'پردازش دستی (JSON)', icon: Workflow },
    { id: 'catalog', label: 'کاتالوگ و مشخصات سئو', icon: Package, badge: productsCount },
    { id: 'miniapp', label: 'مینی‌آپ تلگرام (پیش‌نمایش)', icon: Smartphone },
    { id: 'batch', label: 'ورود گروهی محصولات', icon: UploadCloud },
    { id: 'appearance', label: 'تنظیمات ظاهر مینی‌اپ', icon: Palette },
    { id: 'telegram', label: 'تولیدکننده پست کانال', icon: Send },
    {
      id: 'admin',
      label: 'پنل ادمین و CRM',
      icon: ShieldCheck,
      badge: pendingInquiriesCount + pendingCustomersCount > 0 ? `${pendingInquiriesCount + pendingCustomersCount} جدید` : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'portal',
      label: 'پورتال اختصاصی همکار',
      icon: UserCheck,
      badge: currentCustomer?.status === 'approved' ? 'تایید شده' : 'در انتظار',
      badgeColor: currentCustomer?.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-950',
    },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileDrawerOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Header Row */}
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile Drawer Trigger (Right-aligned in RTL) */}
              <button
                onClick={() => setIsMobileDrawerOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#E0707F] border border-slate-700 transition cursor-pointer"
                aria-label="باز کردن منوی کشویی"
              >
                <Menu className="w-5 h-5" />
              </button>

              <NfsLogo size="md" />
            </div>

            {/* Right Tools: Live Currency Board, Manual Ingest & Google Auth */}
            <div className="flex items-center gap-2">
              {/* Live Currency Rates Widget (Desktop) */}
              <div
                onClick={onOpenCurrencyModal}
                title="کلیک کنید برای مشاهده جزییات، استعلام یا ویرایش دستی نرخ ارز"
                className="hidden lg:flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs cursor-pointer transition hover:border-[#A91D2E]/50 shadow-sm"
              >
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="نرخ ارز زنده است"></span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshRates();
                    }}
                    disabled={isRefreshingRates}
                    title="بروزرسانی زنده نرخ ارز از سایت‌های TGJU / AlanChand"
                    className="flex items-center gap-1 text-slate-400 hover:text-[#E0707F] transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRates ? 'animate-spin text-[#A91D2E]' : ''}`} />
                  </button>
                  <span className="text-[10px] hidden xl:inline text-slate-400 font-bold">نرخ ارز:</span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span title="دلار آمریکا">
                    <strong className="text-amber-400">$</strong> {currencyRates.usd.toLocaleString('en-US')}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span title="درهم امارات (دبی)">
                    <strong className="text-sky-400">AED</strong> {currencyRates.aed.toLocaleString('en-US')}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span title="یوان چین (1688)">
                    <strong className="text-rose-400">¥</strong> {currencyRates.cny.toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              {/* Theme Toggle Button (Desktop & Mobile) */}
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
                className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/80 text-xs transition cursor-pointer shadow-sm"
                aria-label="تغییر تم"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="hidden xl:inline text-[11px] font-medium text-slate-300">روشن</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-500" />
                    <span className="hidden xl:inline text-[11px] font-medium text-slate-700">تاریک</span>
                  </>
                )}
              </button>

              {/* Switch to Fullscreen MiniApp Button */}
              {onSwitchToMiniApp && (
                <button
                  type="button"
                  onClick={onSwitchToMiniApp}
                  title="مشاهده مستقیم مینی‌آپ تمام‌صفحه خریداران در تلگرام"
                  className="hidden md:flex items-center gap-1.5 bg-[#A91D2E] hover:bg-[#871523] text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>مشاهده مینی‌آپ تلگرام</span>
                </button>
              )}

              {/* Deploy / Host Download Button */}
              {onOpenDeployModal && (
                <button
                  type="button"
                  onClick={onOpenDeployModal}
                  title="دانلود بسته بیلد نهایی (dist.zip) ویژه آپلود روی هاست nfs.nafisstore.com"
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 font-black px-3.5 py-1.5 rounded-xl text-xs shadow-md shadow-emerald-900/30 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-white stroke-[2.5]" />
                  <span className="hidden sm:inline">دانلود فایل استقرار (dist.zip)</span>
                  <span className="sm:hidden">دانلود استقرار</span>
                </button>
              )}

              {/* Quick Manual Ingest Button */}
              <button
                onClick={onOpenManualIngest}
                className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs shadow-md transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 fill-slate-950" />
                <span>ورود دستی کالا</span>
              </button>

              {/* Google Account Status Button */}
              {user ? (
                <div className="flex items-center gap-2 bg-slate-800/90 pl-2 pr-2 sm:pr-3 py-1.5 rounded-xl border border-slate-700">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'کاربر'} className="w-6 h-6 rounded-full border border-emerald-400" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                      G
                    </div>
                  )}
                  <div className="hidden xl:block text-right">
                    <div className="text-xs font-medium text-slate-200 truncate max-w-[100px]">
                      {user.displayName || user.email}
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    title="خروج از حساب گوگل"
                    className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl font-medium text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                  )}
                  <span className="hidden sm:inline">اتصال به Drive</span>
                </button>
              )}
            </div>
          </div>

          {/* Desktop Tab Navigation Bar */}
          <div className="hidden lg:flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-800/80 no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-[#871523] text-white dark:bg-[#A91D2E]/20 dark:text-[#E0707F] border border-[#871523] dark:border-[#A91D2E]/50 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-[#E0707F]' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        tab.badgeColor || (isActive ? 'bg-white/20 text-white font-bold' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300')
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer (منوی کشویی سرسره‌ای از سمت راست) */}
      {/* Backdrop */}
      <div
        onClick={() => setIsMobileDrawerOpen(false)}
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 lg:hidden ${
          isMobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer Container (Sliding from Right in RTL) */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-80 max-w-[85vw] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out transform lg:hidden ${
          isMobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <NfsLogo size="sm" />

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer text-xs"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] text-amber-300">تم روشن</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] text-indigo-300">تم تاریک</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsMobileDrawerOpen(false)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* Quick Switch to Fullscreen MiniApp in Mobile Drawer */}
          {onSwitchToMiniApp && (
            <button
              onClick={() => {
                setIsMobileDrawerOpen(false);
                onSwitchToMiniApp();
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-[#A91D2E] to-[#1d6fa5] text-white font-bold text-xs shadow-lg transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <span>مشاهده مینی‌آپ تمام‌صفحه تلگرام</span>
              </div>
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Live Currency Rates Widget inside Mobile Drawer */}
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>نرخ زنده ارزهای تجاری</span>
              </span>
              <button
                onClick={onRefreshRates}
                disabled={isRefreshingRates}
                className="text-[10px] text-slate-400 hover:text-amber-400 flex items-center gap-1 font-semibold"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingRates ? 'animate-spin text-amber-400' : ''}`} />
                <span>بروزرسانی</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 text-[9px]">دلار</div>
                <div className="font-bold text-amber-400 text-xs">{currencyRates.usd.toLocaleString('en-US')}</div>
              </div>
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 text-[9px]">درهم</div>
                <div className="font-bold text-sky-400 text-xs">{currencyRates.aed.toLocaleString('en-US')}</div>
              </div>
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 text-[9px]">یوان</div>
                <div className="font-bold text-rose-400 text-xs">{currencyRates.cny.toLocaleString('en-US')}</div>
              </div>
            </div>
          </div>

          {/* Deploy and Manual Ingest Buttons inside Drawer */}
          <div className="space-y-2">
            {onOpenDeployModal && (
              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  onOpenDeployModal();
                }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-4 rounded-xl text-xs shadow-md shadow-emerald-900/40 transition"
              >
                <Download className="w-4 h-4 text-white stroke-[2.5]" />
                <span>📦 دانلود فایل استقرار هاست (dist.zip)</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsMobileDrawerOpen(false);
                onOpenManualIngest();
              }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition"
            >
              <PlusCircle className="w-4 h-4 fill-slate-950" />
              <span>+ ورود دستی و اتوماسیون کالا</span>
            </button>
          </div>

          {/* Navigation Links list */}
          <div className="space-y-1 pt-1">
            <div className="text-[10px] font-bold text-slate-400 px-3 pb-1">بخش‌های برنامه:</div>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500/20 to-indigo-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isActive ? 'bg-amber-400/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{tab.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {tab.badge !== undefined && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                          tab.badgeColor || (isActive ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300')
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          {user ? (
            <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-emerald-400" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                    G
                  </div>
                )}
                <div className="truncate text-xs text-slate-300">
                  <div className="font-bold truncate">{user.displayName || user.email}</div>
                  <div className="text-[10px] text-emerald-400">اتصال به درایو فعال است</div>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                title="خروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-xs shadow-md transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>ورود با حساب گوگل</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
