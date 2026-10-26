import React from 'react';

interface NfsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  /** dark = روی پس‌زمینه تیره (N و F سفید) */
  variant?: 'light' | 'dark';
  customLogoUrl?: string;
}

const LETTER = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' } as const;
const TEXT = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' } as const;

/** لوگوی رسمی NFS با CSS خالص؛ در صورت وجود customLogoUrl تصویر نمایش داده می‌شود. */
export const NfsLogo: React.FC<NfsLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  variant = 'light',
  customLogoUrl,
}) => {
  const base = variant === 'dark' ? 'text-white' : 'text-[#0F1115] dark:text-white';
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`} dir="ltr">
      {customLogoUrl ? (
        <img src={customLogoUrl} alt="NFS" className="h-8 w-auto object-contain" />
      ) : (
        <div className="flex flex-col items-stretch leading-none">
          <div className={`font-black tracking-tight ${LETTER[size]} ${base}`} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            <span>N</span>
            <span>F</span>
            <span className="text-[#A91D2E]">S</span>
          </div>
          <div className="h-[3px] rounded-full bg-[#A91D2E] mt-0.5" />
        </div>
      )}
      {showText && (
        <div dir="rtl" className={`flex items-center gap-2 ${base}`}>
          <span className="w-px h-6 bg-current opacity-25" />
          <span className={`font-bold leading-tight ${TEXT[size]}`}>
            نفیس استور
            <span className="block font-normal opacity-70">تجارت هوشمند B2B</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default NfsLogo;
