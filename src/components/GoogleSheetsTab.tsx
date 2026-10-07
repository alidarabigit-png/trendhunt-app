import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  ExternalLink,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  ArrowUpRight,
  Database,
  Lock,
  Layers,
  Sparkles,
  Send,
  Trash2,
} from 'lucide-react';
import { ProductItem, GoogleSheetsConfig } from '../types';
import {
  HEADERS,
  extractSpreadsheetId,
  listUserSpreadsheets,
  DriveSpreadsheetFile,
  consolidateAllSheetsToOne,
} from '../services/googleSheets';

interface GoogleSheetsTabProps {
  user: User | null;
  onLogin: () => void;
  sheetsConfig: GoogleSheetsConfig;
  onCreateNewSheet: () => void;
  onSyncAll: () => void;
  isCreating: boolean;
  isSyncing: boolean;
  products: ProductItem[];
  setSpreadsheetIdManual: (id: string) => void;
  onImportFromSheet?: () => void;
  onNavigateToTelegramPost?: () => void;
  onCleanDuplicates?: () => void;
}

export const GoogleSheetsTab: React.FC<GoogleSheetsTabProps> = ({
  user,
  onLogin,
  sheetsConfig,
  onCreateNewSheet,
  onSyncAll,
  isCreating,
  isSyncing,
  products,
  setSpreadsheetIdManual,
  onImportFromSheet,
  onNavigateToTelegramPost,
  onCleanDuplicates,
}) => {
  const [manualIdInput, setManualIdInput] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isConsolidating, setIsConsolidating] = useState(false);

  useEffect(() => {
    if (user) {
      listUserSpreadsheets().then(setDriveFiles).catch(() => {});
    }
  }, [user, sheetsConfig.spreadsheetId]);

  const handleConsolidate = async () => {
    setIsConsolidating(true);
    try {
      const res = await consolidateAllSheetsToOne();
      setSpreadsheetIdManual(res.masterFileId);
      const updatedFiles = await listUserSpreadsheets();
      setDriveFiles(updatedFiles);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsConsolidating(false);
    }
  };

  const syncedCount = products.filter((p) => p.isSyncedToSheets).length;

  const handleConfirmSync = () => {
    setShowConfirmModal(false);
    onSyncAll();
  };

  return (
    <div className="space-y-6">
      {/* Multi-Files Detected: One-Click Consolidation to Single Master Sheet */}
      {driveFiles.length > 1 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-emerald-500/20 border border-amber-500/40 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>پیشنهاد معماری: ادغام تمام فایل‌ها در 1 فایل واحد و مرجع (Single Master Sheet)</span>
            </span>
            <p className="text-xs text-slate-300">
              در حال حاضر {driveFiles.length} فایل همنام در گوگل درایو شما وجود دارد. با زدن این دکمه، تمام کالاهای یکتا در یک فایل رسمی تجمیع شده و فایل‌های اضافه حذف خواهند شد تا سیستم فقط با یک فایل واحد کار کند.
            </p>
          </div>
          <button
            onClick={handleConsolidate}
            disabled={isConsolidating}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-2"
          >
            {isConsolidating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>در حال ادغام...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>⚡ یکی‌سازی در یک فایل واحد و حذف فایل دوم</span>
              </>
            )}
          </button>
        </div>
      )}
      {/* Top Google Account & Sheets Connection Status */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <FileSpreadsheet className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">
                  اتصال اختصاصی به گوگل شیت و گوگل درایو
                </h3>
                {user ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      متصل به حساب {user.email}
                    </span>
                    <button
                      onClick={onLogin}
                      title="تجدید اتصال دسترسی به درایو"
                      className="text-[11px] text-slate-400 hover:text-indigo-400 underline cursor-pointer transition"
                    >
                      (تجدید اتصال یا تغییر اکانت)
                    </button>
                  </div>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    نیاز به احراز هویت
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                تمام کالاهای واکشی‌شده با کلیه مشخصات سئو فارسی، مشخصات فنی، اطلاعات کارخانه و قیمت‌های پلکانی مستقیماً در یک فایل اختصاصی در حساب گوگل درایو شما ذخیره و به‌روزرسانی می‌شوند.
              </p>
            </div>
          </div>

          {!user ? (
            <button
              onClick={onLogin}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-800 px-5 py-3 rounded-xl font-bold text-xs shadow-lg transition cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>اتصال و ورود با اکانت گوگل</span>
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
              <button
                onClick={onCreateNewSheet}
                disabled={isCreating}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isCreating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>ایجاد فایل جدید در درایو</span>
              </button>

              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={isSyncing || products.length === 0}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>همگام‌سازی ردیف‌ها ({products.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Current Active Sheet Info */}
        {sheetsConfig.spreadsheetId && (
          <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-900/40 text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{sheetsConfig.sheetTitle}</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                    فعال و متصل
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                  ID: {sheetsConfig.spreadsheetId}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onImportFromSheet && (
                <button
                  onClick={onImportFromSheet}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold transition border border-slate-700 shadow-sm cursor-pointer disabled:opacity-50"
                  title="خواندن مجدد ردیف‌ها و کالاهای موجود در گوگل شیت و بارگذاری در مینی‌آپ و پست تلگرام"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>دریافت کالاها از شیت</span>
                </button>
              )}

              {onNavigateToTelegramPost && (
                <button
                  onClick={onNavigateToTelegramPost}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 text-xs font-bold transition border border-sky-500/40 shadow-sm cursor-pointer"
                  title="رفتن به بخش آماده‌سازی و ارسال فوری پست به کانال تلگرام"
                >
                  <Send className="w-3.5 h-3.5 text-sky-400" />
                  <span>ارسال کالاها به کانال تلگرام</span>
                </button>
              )}

              {onCleanDuplicates && (
                <button
                  onClick={onCleanDuplicates}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition border border-amber-500/40 shadow-sm cursor-pointer disabled:opacity-50"
                  title="بررسی تمام ردیف‌ها و حذف قطعی ردیف‌های تکراری از گوگل شیت"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>🧹 پاکسازی ردیف‌های تکراری شیت</span>
                </button>
              )}

              {sheetsConfig.spreadsheetUrl && (
                <a
                  href={sheetsConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold transition border border-slate-700 shadow-sm"
                >
                  <span>مشاهده در درایو</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grid: Columns Schema & Manual Link */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Stored Columns Schema */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              <h4 className="font-bold text-white text-sm">
                ساختار ستون‌های ذخیره‌شونده در گوگل شیت
              </h4>
            </div>
            <span className="text-xs text-slate-400 font-mono">{HEADERS.length} فیلد استاندارد</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {HEADERS.map((header, index) => (
              <div
                key={index}
                className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/40 flex items-center gap-2 text-slate-300"
              >
                <span className="text-[10px] text-amber-400 font-mono font-bold bg-slate-900 px-1.5 py-0.5 rounded">
                  {index + 1}
                </span>
                <span className="truncate">{header}</span>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/30 text-xs text-indigo-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              سربرگ‌ها به صورت خودکار با پس‌زمینه رنگی سرمه‌ای و متن پررنگ فریز می‌شوند تا در موبایل و دسکتاپ به آسانی قابل فیلتر و مرتب‌سازی باشند.
            </p>
          </div>
        </div>

        {/* Right Col: Link existing sheet */}
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <FolderOpen className="w-5 h-5 text-amber-400" />
              <h4 className="font-bold text-white text-sm">
                اتصال به شیت موجود در گوگل درایو
              </h4>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400">
                اگر قبلاً یک فایل شیت در گوگل درایو دارید، لینک کامل یا شناسه (Spreadsheet ID) آن را در زیر وارد کنید:
              </p>

              <div>
                <input
                  type="text"
                  placeholder="لینک کامل گوگل شیت یا شناسه ID..."
                  value={manualIdInput}
                  onChange={(e) => setManualIdInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-left font-mono text-[11px] focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
                  dir="ltr"
                />
              </div>

              <button
                onClick={() => {
                  if (manualIdInput.trim()) {
                    setSpreadsheetIdManual(extractSpreadsheetId(manualIdInput.trim()));
                    setManualIdInput('');
                  }
                }}
                disabled={!manualIdInput.trim()}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition disabled:opacity-50 cursor-pointer"
              >
                تایید و اتصال شیت
              </button>

              {/* Detected Drive Spreadsheets List */}
              {driveFiles.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <span className="text-[11px] text-amber-300 font-bold block">
                    📂 فایل‌های گوگل شیت درایو شما ({driveFiles.length} فایل):
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {driveFiles.map((f) => {
                      const isSelected = f.id === sheetsConfig.spreadsheetId;
                      return (
                        <div
                          key={f.id}
                          onClick={() => setSpreadsheetIdManual(f.id)}
                          className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/50 text-white'
                              : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/50 text-slate-300'
                          }`}
                        >
                          <div className="truncate flex items-center gap-1.5 overflow-hidden">
                            <FileSpreadsheet
                              className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`}
                            />
                            <span className="truncate text-[11px]">{f.name}</span>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold shrink-0 mr-1 ${
                              isSelected
                                ? 'bg-amber-400/20 text-amber-300'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                            }`}
                          >
                            {isSelected ? 'متصل' : 'اتصال'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory User Confirmation Modal for Mutating/Writing Operations */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="font-bold text-base text-white">تایید همگام‌سازی با گوگل شیت</h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              آیا از ارسال و اضافه شدن <strong>{products.length}</strong> ردیف محصول شامل عنوان‌های سئو فارسی، قیمت‌های پلکانی و مشخصات فنی به فایل گوگل شیت در گوگل درایو خود اطمینان دارید؟
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                انصراف
              </button>

              <button
                onClick={handleConfirmSync}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition"
              >
                بله، اطلاعات را در شیت ذخیره کن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
