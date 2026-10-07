import React, { useState } from 'react';
import { Download, X, Server, CheckCircle2, FileArchive, ArrowLeft, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({ isOpen, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      // Guaranteed iframe-safe base64 download
      const res = await fetch('/api/dist-base64');
      if (res.ok) {
        const data = await res.json();
        if (data.base64) {
          const byteCharacters = atob(data.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/zip' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = 'nafisstore-dist.zip';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          setDownloadSuccess(true);
          return;
        }
      }
      // Direct download fallback
      window.location.href = '/api/download-dist';
      setDownloadSuccess(true);
    } catch (e) {
      console.warn('Fallback to direct link', e);
      window.location.href = '/api/download-dist';
      setDownloadSuccess(true);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-right relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg font-black">
            <FileArchive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">
              دانلود بسته استقرار روی هاست (dist.zip)
            </h3>
            <p className="text-xs text-slate-400">
              ویژه هاست <strong className="text-amber-400 font-mono">nfs.nafisstore.com</strong> همراه با بک‌اند دائمی و اتصال ورکر
            </p>
          </div>
        </div>

        {/* Contents Checklist */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
          <div className="font-bold text-slate-200 pb-1 flex items-center gap-1.5 text-amber-400">
            <Sparkles className="w-4 h-4" />
            <span>محتویات آماده در این بسته بیلد:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>فایل <strong>api.php</strong> (ذخیره دائم دیتابیس روی هاست)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>پروکسی و کش خودکار تصاویر جهت رفع فیلترینگ در ایران</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>کالاهای ترند جدید 2026 و رفع باگ شکار</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>کدهای بهینه و فشرده کاتالوگ و مینی‌آپ</span>
            </div>
          </div>
        </div>

        {/* Download Action Button */}
        <div className="space-y-3">
          <button
            onClick={handleDownloadZip}
            disabled={isDownloading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>در حال ایجاد و بارگیری فایل زیپ...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>کلیک برای دانلود فایل dist.zip (حجم ~450 کیلوبایت)</span>
              </>
            )}
          </button>

          {downloadSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs text-center flex items-center justify-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>فایل با موفقیت بارگیری شد. اکنون آن را در پوشه ساب‌دامین هاست Extract کنید.</span>
            </div>
          )}
        </div>

        {/* 3 Step Deployment Guide */}
        <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
          <div className="font-bold text-white flex items-center gap-1.5">
            <Server className="w-4 h-4 text-sky-400" />
            <span>نحوه استقرار روی هاست در 3 گام ساده:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px] leading-relaxed pr-1">
            <li>
              وارد کنترل‌پنل هاست (cPanel / DirectAdmin) شده و به بخش <strong>File Manager</strong> بروید.
            </li>
            <li>
              پوشه مربوط به <span className="font-mono text-amber-300">nfs.nafisstore.com</span> (معمولاً <span className="font-mono text-slate-300">public_html/nfs</span>) را باز کنید.
            </li>
            <li>
              فایل <span className="font-mono text-amber-300">dist.zip</span> را آپلود کرده و روی آن راست‌کلیک و گزینه <strong>Extract</strong> را بزنید.
            </li>
          </ol>
        </div>

        {/* Footer Close */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
