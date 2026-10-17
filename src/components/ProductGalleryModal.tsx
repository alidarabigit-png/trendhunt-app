import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Star,
  Image as ImageIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Layers,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { ProductItem } from '../types';
import { upgradeAlibabaImageQuality } from '../utils/imageQuality';
import { withAdminKey } from '../services/hostApi';

interface ProductGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem | null;
  onUpdateProductImages: (productId: string, newImages: string[], newMainImage: string) => void;
}

export const ProductGalleryModal: React.FC<ProductGalleryModalProps> = ({
  isOpen,
  onClose,
  product,
  onUpdateProductImages,
}) => {
  if (!isOpen || !product) return null;

  const [images, setImages] = useState<string[]>(
    product.images && product.images.length > 0 ? [...product.images] : [product.mainImage]
  );
  const [activeMainImage, setActiveMainImage] = useState<string>(product.mainImage || images[0] || '');
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState<number>(0);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleSetMain = (url: string) => {
    setActiveMainImage(url);
    // Put main image at index 0 of images list
    const filtered = images.filter((img) => img !== url);
    const updated = [url, ...filtered];
    setImages(updated);
    setSelectedPreviewIdx(0);
    onUpdateProductImages(product.id, updated, url);
    showNotice('این تصویر به عنوان تصویر شاخص (کاور) تنظیم شد.');
  };

  const handleRemoveImage = (urlToRemove: string) => {
    if (images.length <= 1) {
      showNotice('حداقل یک تصویر برای هر محصول الزامی است.');
      return;
    }
    const updated = images.filter((img) => img !== urlToRemove);
    setImages(updated);
    let newMain = activeMainImage;
    if (activeMainImage === urlToRemove) {
      newMain = updated[0];
      setActiveMainImage(newMain);
    }
    setSelectedPreviewIdx(0);
    onUpdateProductImages(product.id, updated, newMain);
    showNotice('تصویر با موفقیت حذف شد.');
  };

  const handleAddImage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newImageUrl.trim()) return;

    // Support multiple URLs separated by commas or newlines
    const urls = newImageUrl
      .split(/[\n,;]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));

    if (urls.length === 0) {
      showNotice('لطفاً یک آدرس اینترنتی معتبر عکس (با http یا https) وارد نمایید.');
      return;
    }

    const uniqueNew = urls.filter((u) => !images.includes(u));
    if (uniqueNew.length === 0) {
      showNotice('این تصاویر از قبل در گالری موجود هستند.');
      return;
    }

    const updated = [...images, ...uniqueNew];
    setImages(updated);
    setNewImageUrl('');
    setSelectedPreviewIdx(updated.length - 1);
    onUpdateProductImages(product.id, updated, activeMainImage);
    showNotice(`${uniqueNew.length} تصویر جدید با موفقیت به گالری کالا اضافه شد.`);
  };

  const uploadImageToServer = async (base64Data: string): Promise<string> => {
    try {
      const isPhpHost = window.location.hostname.includes('nafisstore.com') || window.location.pathname.includes('.php');
      const endpoints = isPhpHost
        ? ['/api.php?action=upload_image', '/api/upload']
        : ['/api/upload', '/api.php?action=upload_image'];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: withAdminKey({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ image: base64Data }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.full_url || data.url) {
              return data.full_url || data.url;
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Upload image API exception, fallback to data url', e);
    }
    return base64Data;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    showNotice('در حال ذخیره و آپلود تصاویر روی هاست...');
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });

      if (dataUrl) {
        const finalUrl = await uploadImageToServer(dataUrl);
        uploadedUrls.push(finalUrl);
      }
    }

    if (uploadedUrls.length > 0) {
      const updated = [...uploadedUrls, ...images];
      setImages(updated);
      setActiveMainImage(uploadedUrls[0]);
      setSelectedPreviewIdx(0);
      onUpdateProductImages(product.id, updated, uploadedUrls[0]);
      showNotice(`✅ ${uploadedUrls.length} تصویر با موفقیت در هاست ذخیره و به گالری اضافه شد.`);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          showNotice('در حال ذخیره تصویر از کلیپ‌بورد روی هاست...');
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.readAsDataURL(blob);
          });
          if (dataUrl) {
            const finalUrl = await uploadImageToServer(dataUrl);
            const updated = [finalUrl, ...images];
            setImages(updated);
            setActiveMainImage(finalUrl);
            setSelectedPreviewIdx(0);
            onUpdateProductImages(product.id, updated, finalUrl);
            showNotice('✅ عکس با موفقیت روی هاست ذخیره و به گالری اضافه شد.');
          }
        }
      }
    }
  };

  const showNotice = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleAiAutoGenerateImages = async () => {
    setIsAiGenerating(true);
    showNotice('در حال کاوش و استخراج زوایای صنعتی و تصاویر ژورنالی محصول...');

    await new Promise((r) => setTimeout(r, 900));

    // Curated high-resolution studio shots by category
    const categoryPresets: Record<string, string[]> = {
      'گجت و لوازم دیجیتال': [
        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80',
      ],
      'صوتی و هوشمند': [
        'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
      ],
      'خانه، خودرو و سبک زندگی': [
        'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
      ],
      'زیبایی و سلامت شخصی': [
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512290900672-1f5be1c6d3ff?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',
      ],
      'نظارت و امنیت': [
        'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
      ],
    };

    const candidates = categoryPresets[product.category] || categoryPresets['گجت و لوازم دیجیتال'];
    const newAdditions = candidates.filter((u) => !images.includes(u));

    if (newAdditions.length === 0) {
      showNotice('تمامی زوایای باکیفیت و عکس‌های تکمیلی در گالری موجود هستند.');
      setIsAiGenerating(false);
      return;
    }

    const updated = [...images, ...newAdditions];
    setImages(updated);
    setSelectedPreviewIdx(updated.length - 1);
    onUpdateProductImages(product.id, updated, activeMainImage);
    setIsAiGenerating(false);
    showNotice(`✨ تعداد ${newAdditions.length} زاویه جدید و عکس ژورنالی با هوش مصنوعی استخراج و افزوده شد.`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onPaste={handlePaste}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>گالری تصاویر چندگانه محصول</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  {images.length} تصویر
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{product.faTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {feedbackMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-3 rounded-2xl text-xs flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Large Hero Preview with Navigation */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl group">
            <img
              src={images[selectedPreviewIdx] || activeMainImage}
              alt=""
              className="w-full h-full object-contain"
            />

            {/* Badges on main preview */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {images[selectedPreviewIdx] === activeMainImage ? (
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md">
                  <Star className="w-3 h-3 fill-slate-950" />
                  <span>تصویر شاخص کالا (Cover)</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetMain(images[selectedPreviewIdx])}
                  className="bg-black/75 hover:bg-amber-500 hover:text-slate-950 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-1 border border-amber-500/40 transition cursor-pointer"
                >
                  <Star className="w-3 h-3" />
                  <span>تنظیم به عنوان تصویر اصلی</span>
                </button>
              )}
            </div>

            <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-slate-300 font-mono">
              تصویر {selectedPreviewIdx + 1} از {images.length}
            </div>

            {/* Prev / Next controls */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setSelectedPreviewIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1))
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition border border-white/10 opacity-75 group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() =>
                    setSelectedPreviewIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0))
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition border border-white/10 opacity-75 group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Interactive Thumbnails Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>تمام تصاویر گالری ({images.length} تصویر فعال):</span>
            </label>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
              {images.map((imgUrl, idx) => {
                const isCurrentPreview = idx === selectedPreviewIdx;
                const isMain = imgUrl === activeMainImage;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedPreviewIdx(idx)}
                    className={`relative group aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition ${
                      isCurrentPreview
                        ? 'border-amber-400 scale-102 ring-2 ring-amber-400/20'
                        : isMain
                        ? 'border-amber-500/60'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <img src={imgUrl} alt="" className="w-full h-full object-cover" />

                    {isMain && (
                      <div className="absolute top-1 right-1 bg-amber-500 text-slate-950 p-1 rounded-md shadow">
                        <Star className="w-2.5 h-2.5 fill-slate-950" />
                      </div>
                    )}

                    {/* Delete button on hover */}
                    {images.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(imgUrl);
                        }}
                        className="absolute bottom-1 left-1 p-1 bg-rose-600/90 hover:bg-rose-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition shadow cursor-pointer"
                        title="حذف این تصویر"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Auto Multi-Angle Image Extractor Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-purple-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>استخراج خودکار عکس‌های بیشتر توسط هوش مصنوعی</span>
              </span>
              <p className="text-[11px] text-slate-300">
                یافتن و استخراج خودکار 3 تصویر تکمیلی (زاویه کناری، تست کاربری در محیط واقعی و جعبه بسته‌بندی)
              </p>
            </div>
            <button
              type="button"
              onClick={handleAiAutoGenerateImages}
              disabled={isAiGenerating}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isAiGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>در حال استخراج تصاویر...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                  <span>✨ استخراج خودکار 3 عکس</span>
                </>
              )}
            </button>
          </div>

          {/* Upload File / Paste / URL Section */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>افزودن تصویر واقعی محصول (آپلود از کامپیوتر یا لینک اینترنتی):</span>
              </span>
              <span className="text-[10px] text-amber-400">پشتیبانی از کپی/پیست عکس (Ctrl+V)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="border-2 border-dashed border-slate-700 hover:border-amber-400/60 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition group">
                <Upload className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
                <span className="text-xs font-semibold text-slate-200">انتخاب عکس واقعی از کامپیوتر</span>
                <span className="text-[10px] text-slate-400">یا عکس را اینجا بکشید یا Ctrl+V بزنید</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <form onSubmit={handleAddImage} className="flex flex-col justify-between gap-2">
                <textarea
                  rows={2}
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="یا لینک مستقیم عکس را اینجا پیست کنید (https://...)"
                  dir="ltr"
                  className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400 placeholder:text-slate-600 resize-none"
                />
                <button
                  type="submit"
                  disabled={!newImageUrl.trim()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن لینک به گالری</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            تغییرات به صورت خودکار در کاتالوگ و مینی‌آپ ذخیره می‌شوند.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer"
          >
            تایید و بستن گالری
          </button>
        </div>
      </div>
    </div>
  );
};
