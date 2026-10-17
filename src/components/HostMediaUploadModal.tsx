import React, { useState } from 'react';
import {
  Upload,
  Copy,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Trash2,
  X,
  Plus,
  RefreshCw,
  FolderOpen,
  CheckCircle2,
} from 'lucide-react';
import { ProductItem } from '../types';
import { withAdminKey } from '../services/hostApi';

interface UploadedMediaItem {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
  sizeKb?: number;
}

interface HostMediaUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  onAddImageToProduct?: (productId: string, imageUrl: string) => void;
}

export const HostMediaUploadModal: React.FC<HostMediaUploadModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddImageToProduct,
}) => {
  const [mediaList, setMediaList] = useState<UploadedMediaItem[]>(() => {
    try {
      const saved = localStorage.getItem('nfs_host_media_uploads');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');

  const saveMediaList = (items: UploadedMediaItem[]) => {
    setMediaList(items);
    try {
      localStorage.setItem('nfs_host_media_uploads', JSON.stringify(items.slice(0, 50)));
    } catch (e) {}
  };

  const showFeedback = (msg: string) => {
    setUploadNotice(msg);
    setTimeout(() => setUploadNotice(null), 3500);
  };

  const uploadFileToHost = async (file: File): Promise<UploadedMediaItem | null> => {
    try {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      const isPhpHost =
        window.location.hostname.includes('nafisstore.com') ||
        window.location.pathname.includes('.php');
      const endpoints = isPhpHost
        ? ['/api.php?action=upload_image', '/api/upload']
        : ['/api/upload', '/api.php?action=upload_image'];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: withAdminKey({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ image: dataUrl }),
          });
          if (res.ok) {
            const data = await res.json();
            const finalUrl = data.full_url || data.url;
            if (finalUrl) {
              return {
                id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                url: finalUrl,
                filename: data.filename || file.name,
                uploadedAt: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
                sizeKb: Math.round(file.size / 1024),
              };
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error('File upload error', err);
    }
    return null;
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    showFeedback('در حال آپلود مستقیم تصویر روی هاست nfs.nafisstore.com...');

    const newUploaded: UploadedMediaItem[] = [];
    for (const file of Array.from(files)) {
      const item = await uploadFileToHost(file);
      if (item) newUploaded.push(item);
    }

    if (newUploaded.length > 0) {
      const updated = [...newUploaded, ...mediaList];
      saveMediaList(updated);
      showFeedback(`✅ ${newUploaded.length} تصویر با موفقیت در پوشه uploads هاست ذخیره شد.`);
    } else {
      showFeedback('❌ خطا در آپلود تصویر روی هاست. لطفاً اتصال اینترنت را بررسی فرمایید.');
    }
    setIsUploading(false);
  };

  const handleCopyLink = (item: UploadedMediaItem) => {
    const fullUrl = item.url.startsWith('http')
      ? item.url
      : `https://nfs.nafisstore.com${item.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
    showFeedback('لینک مستقیم عکس با موفقیت کپی شد!');
  };

  const handleAttachToProduct = (item: UploadedMediaItem) => {
    if (!selectedProductId || !onAddImageToProduct) return;
    const fullUrl = item.url.startsWith('http')
      ? item.url
      : `https://nfs.nafisstore.com${item.url}`;
    onAddImageToProduct(selectedProductId, fullUrl);
    showFeedback('✅ تصویر با موفقیت به گالری محصول انتخابی اضافه شد.');
  };

  const handleDeleteItem = (id: string) => {
    const updated = mediaList.filter((m) => m.id !== id);
    saveMediaList(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>مرکز آپلود تصاویر در هاست</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  nfs.nafisstore.com/uploads
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                تصاویر را اینجا آپلود کنید؛ مستقیماً روی هاست ذخیره می‌شوند و لینک مستقیم دائمی دریافت می‌کنید.
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

        {/* Feedback Alert */}
        {uploadNotice && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
            <span>{uploadNotice}</span>
            {isUploading && <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />}
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Upload Dropzone */}
          <label className="border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-950/40 hover:bg-slate-950/70 transition group text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-200">
                کلیک کنید یا عکس‌های خود را اینجا رها کنید
              </span>
              <p className="text-xs text-slate-400 mt-1">
                پشتیبانی از فرمت‌های JPG, PNG, WEBP — عکس‌ها مستقیماً در پوشه <code className="text-sky-300 font-mono">/uploads/</code> هاست ذخیره می‌شوند.
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={isUploading}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
          </label>

          {/* Quick Target Product Selector */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              <span>محصول هدف برای الصاق مستقیم عکس:</span>
            </div>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full sm:w-72 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.faTitle.substring(0, 45)}...
                </option>
              ))}
            </select>
          </div>

          {/* Uploaded Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>تصاویر آپلودشده روی هاست ({mediaList.length}):</span>
              </span>
              {mediaList.length > 0 && (
                <button
                  onClick={() => saveMediaList([])}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition cursor-pointer"
                >
                  پاکسازی تاریخچه
                </button>
              )}
            </div>

            {mediaList.length === 0 ? (
              <div className="text-center py-8 border border-slate-800/80 rounded-2xl bg-slate-950/30 text-slate-500 text-xs">
                هنوز عکسی آپلود نشده است. با انتخاب عکس از کادر بالا، تصویر فوراً روی هاست ذخیره خواهد شد.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mediaList.map((item) => {
                  const fullUrl = item.url.startsWith('http')
                    ? item.url
                    : `https://nfs.nafisstore.com${item.url}`;
                  const isCopied = copiedId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-3 flex gap-3 items-center group transition"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/60 border border-slate-800 shrink-0">
                        <img src={fullUrl} alt="" className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="font-mono text-[11px] text-slate-300 truncate" title={item.filename}>
                          {item.filename}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                          <span>{item.uploadedAt}</span>
                          {item.sizeKb && <span>{item.sizeKb} KB</span>}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item)}
                            className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                            title="کپی لینک مستقیم عکس روی هاست"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{isCopied ? 'کپی شد' : 'کپی لینک'}</span>
                          </button>

                          {onAddImageToProduct && (
                            <button
                              type="button"
                              onClick={() => handleAttachToProduct(item)}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                              title="افزودن این عکس به گالری محصول انتخابی"
                            >
                              <Plus className="w-3 h-3" />
                              <span>افزودن به کالا</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="حذف از تاریخچه"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>اتصال مستقیم به سرور و پوشه uploads فعال است</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
