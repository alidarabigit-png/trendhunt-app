import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  FolderOpen,
  Link,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  auditSheetDuplicates,
  cleanDuplicatesInSheet,
  SheetAuditReport,
  extractSpreadsheetId,
  listUserSpreadsheets,
  DriveSpreadsheetFile,
  consolidateAllSheetsToOne,
  MASTER_SHEET_TITLE,
} from '../services/googleSheets';

interface SheetCleanerModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId: string | null;
  spreadsheetUrl?: string | null;
  onSelectSpreadsheet?: (id: string) => void;
  onCleaningSuccess: (cleanedCount: number) => void;
}

export const SheetCleanerModal: React.FC<SheetCleanerModalProps> = ({
  isOpen,
  onClose,
  spreadsheetId,
  spreadsheetUrl,
  onSelectSpreadsheet,
  onCleaningSuccess,
}) => {
  const [currentId, setCurrentId] = useState<string>(spreadsheetId || '');
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isListingFiles, setIsListingFiles] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [report, setReport] = useState<SheetAuditReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleConsolidate = async () => {
    setIsConsolidating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await consolidateAllSheetsToOne();
      setSuccessMsg(
        `🎉 ادغام با موفقیت کامل انجام شد! تمام محصولات در یک فایل واحد قرار گرفتند (${res.totalUniqueRows} محصول یکتا). ${res.trashedFilesCount} فایل تکراری به سطل بازیافت منتقل شد.`
      );
      setCurrentId(res.masterFileId);
      if (onSelectSpreadsheet) {
        onSelectSpreadsheet(res.masterFileId);
      }
      onCleaningSuccess(res.totalUniqueRows);
      await loadDriveFiles();
      await loadAudit(res.masterFileId);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'خطا در یکی‌سازی فایل‌ها.');
    } finally {
      setIsConsolidating(false);
    }
  };

  // Sync currentId when prop changes
  useEffect(() => {
    if (spreadsheetId) {
      setCurrentId(spreadsheetId);
    }
  }, [spreadsheetId]);

  // Load Drive files and audit current sheet on open
  useEffect(() => {
    if (isOpen) {
      loadDriveFiles();
      if (currentId) {
        loadAudit(currentId);
      }
    }
  }, [isOpen, currentId]);

  const loadDriveFiles = async () => {
    setIsListingFiles(true);
    try {
      const files = await listUserSpreadsheets();
      setDriveFiles(files);
    } catch (e) {
      console.warn('Failed to list drive files:', e);
    } finally {
      setIsListingFiles(false);
    }
  };

  const loadAudit = async (targetId: string) => {
    if (!targetId) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await auditSheetDuplicates(targetId);
      setReport(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'خطا در اسکن ردیف‌های گوگل شیت.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchFile = (newId: string) => {
    const cleanId = extractSpreadsheetId(newId);
    if (!cleanId) return;
    setCurrentId(cleanId);
    if (onSelectSpreadsheet) {
      onSelectSpreadsheet(cleanId);
    }
    loadAudit(cleanId);
  };

  const handleExecuteClean = async () => {
    if (!currentId) return;
    setIsDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await cleanDuplicatesInSheet(currentId);
      if (res.removedDuplicatesCount > 0) {
        setSuccessMsg(
          `✅ عملیات با موفقیت انجام شد! تعداد ${res.removedDuplicatesCount} ردیف تکراری حذف گردید و فایل اکنون دارای ${res.cleanedCount} محصول یکتا است.`
        );
        onCleaningSuccess(res.cleanedCount);
        // Refresh audit report to show 0 duplicates
        await loadAudit(currentId);
      } else {
        setSuccessMsg(`تمام ${res.cleanedCount} کالا در این فایل کاملاً یکتا هستند و هیچ تکراری یافت نشد.`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'خطا در حذف ردیف‌های تکراری.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>مدیریت و پاکسازی ردیف‌های گوگل شیت</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  اتصال زنده درایو
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                بررسی ردیف‌ها، تشخیص فایل‌های چندگانه و حذف قطعی ردیف‌های مشابه
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* File Switcher & Discovery Banner */}
          <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>فایل فعال فعلی جهت بازرسی و پاکسازی:</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 truncate max-w-xs">
                {currentId ? currentId.substring(0, 20) + '...' : 'هیچ شیتی متصل نیست'}
              </span>
            </div>

            {/* Smart Consolidation Card when multiple files exist */}
            {driveFiles.length > 1 && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-emerald-500/15 border border-amber-500/40 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>پیشنهاد هوشمند: ادغام 2 فایل در یک فایل واحد و حذف فایل دوم</span>
                    </span>
                    <p className="text-[11px] text-slate-300">
                      سیستم تمام کالاهای یکتای هر دو فایل را در یک فایل اصلی (Master) جمع‌آوری و یکپارچه کرده و فایل اضافه را به سطل بازیافت درایو می‌فرستد.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleConsolidate}
                    disabled={isConsolidating}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition cursor-pointer shrink-0 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isConsolidating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>در حال ادغام فایل‌ها...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>⚡ یکی‌سازی تمام شیت‌ها در یک فایل واحد</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* If multiple files found in Drive */}
            {driveFiles.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-amber-300 font-semibold block">
                  📂 فایل‌های گوگل شیت موجود در درایو شما ({driveFiles.length} فایل یافت شد):
                </span>
                <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {driveFiles.map((f) => {
                    const isSelected = f.id === currentId;
                    return (
                      <div
                        key={f.id}
                        onClick={() => handleSwitchFile(f.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/50 text-white'
                            : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/50 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileSpreadsheet
                            className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`}
                          />
                          <span className="truncate font-medium text-[11px]">{f.name}</span>
                          {isSelected && (
                            <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-bold">
                              فایل فعال
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {f.webViewLink && (
                            <a
                              href={f.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-amber-300 transition"
                              title="باز کردن در درایو"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {!isSelected && (
                            <span className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded font-bold">
                              انتخاب این فایل
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Input for switching to the 13-row file by pasting URL or ID */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-1.5">
                یا لینک / شناسه فایلی که 13 ردیف دارد را مستقیماً وارد کنید:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="لینک کامل گوگل شیت یا شناسه ID..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  dir="ltr"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customInput.trim()) {
                      handleSwitchFile(customInput.trim());
                      setCustomInput('');
                    }
                  }}
                  disabled={!customInput.trim()}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
                >
                  اسکن این شیت
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-2xl text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Metrics Bar */}
          {report && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/80 border border-slate-700/60 p-3 rounded-2xl text-center">
                <span className="text-[11px] text-slate-400 block mb-1">کل ردیف‌های این شیت</span>
                <span className="text-lg font-bold text-white">{report.initialCount}</span>
                <span className="text-[10px] text-slate-500 block">ردیف ثبت‌شده</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-center">
                <span className="text-[11px] text-amber-300 block mb-1">تکراری‌های شناسایی‌شده</span>
                <span className="text-lg font-bold text-amber-400">{report.removedDuplicatesCount}</span>
                <span className="text-[10px] text-amber-400/80 block">ردیف اضافه</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl text-center">
                <span className="text-[11px] text-emerald-300 block mb-1">کالاهای یکتای نهایی</span>
                <span className="text-lg font-bold text-emerald-400">{report.cleanedCount}</span>
                <span className="text-[10px] text-emerald-400/80 block">محصول بدون تکرار</span>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-7 h-7 text-amber-400 animate-spin" />
              <span className="text-xs">در حال اسکن و بررسی دقیق ردیف‌های فایل انتخاب‌شده...</span>
            </div>
          ) : report ? (
            <div className="space-y-4">
              {/* Duplicate Rows List */}
              {report.duplicateRows.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>ردیف‌های تکراری شناسایی‌شده در این فایل ({report.duplicateRows.length} ردیف):</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">ردیف‌های اول دست‌نخورده حفظ می‌شوند</span>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {report.duplicateRows.map((dup, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-800/90 border border-amber-500/30 p-2.5 rounded-2xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <span className="bg-amber-500/20 text-amber-300 font-bold px-2 py-1 rounded-lg text-[10px] shrink-0 border border-amber-500/30">
                            ردیف {dup.sheetRowNumber}
                          </span>
                          <div className="truncate">
                            <p className="font-semibold text-slate-200 truncate">{dup.title}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>شناسه: {dup.id}</span>
                              <span>•</span>
                              <span className="text-amber-400 font-medium">
                                {dup.reason} (مشابه ردیف {dup.duplicateOfRowNumber})
                              </span>
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md shrink-0 border border-rose-500/20">
                          حذف خواهد شد
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold text-emerald-300">هیچ کالای تکراری در این فایل گوگل شیت وجود ندارد!</p>
                  <p className="text-[11px] text-slate-400">
                    تمام {report.cleanedCount} ردیف در این شیت کاملاً یکتا هستند. اگر فایل دیگری مد نظر شماست، از لیست بالا آن را انتخاب کنید.
                  </p>
                </div>
              )}

              {/* Unique rows preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>کالاهای یکتا که در شیت و برنامه باقی می‌مانند ({report.uniqueRows.length} کالا):</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {report.uniqueRows.map((u, i) => (
                    <div
                      key={i}
                      className="bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-xl text-xs flex items-center justify-between"
                    >
                      <span className="text-slate-300 truncate font-medium text-[11px]">{u.title}</span>
                      <span className="text-[10px] text-emerald-400 shrink-0 mr-2 font-mono">
                        {u.priceToman.toLocaleString('en-US')} ت
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {currentId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${currentId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                <span>مشاهده این فایل در گوگل درایو</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              بستن
            </button>

            {report && report.removedDuplicatesCount > 0 && (
              <button
                onClick={handleExecuteClean}
                disabled={isDeleting || isLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-900/30 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال حذف تکراری‌ها از شیت...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>حذف قطعی {report.removedDuplicatesCount} ردیف تکراری از این شیت</span>
                  </>
                )}
              </button>
            )}

            {report && report.removedDuplicatesCount === 0 && (
              <button
                onClick={() => loadAudit(currentId)}
                disabled={isLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>اسکن مجدد این شیت</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
