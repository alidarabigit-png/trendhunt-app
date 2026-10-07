import React from 'react';

interface NfsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const NfsLogo: React.FC<NfsLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
}) => {
  const iconSizes = {
    sm: 'h-6 sm:h-6.5',
    md: 'h-7 sm:h-8',
    lg: 'h-10 sm:h-11',
  };

  const titleSizes = {
    sm: 'text-xs sm:text-sm font-bold',
    md: 'text-sm sm:text-base font-extrabold',
    lg: 'text-lg sm:text-xl font-black',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Official NFS Logo Card with Sleek Proportioned White Plate */}
      <div className="bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl shadow-sm border border-slate-200/90 flex items-center justify-center shrink-0 hover:shadow-md transition">
        <svg
          viewBox="0 0 450 180"
          className={`${iconSizes[size]} w-auto object-contain max-w-[105px] sm:max-w-[130px]`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* ================= LETTER N ================= */}
          {/* Outer Red Geometric Contour */}
          <path
            d="M 22 135 L 22 48 Q 22 26 44 26 L 142 128 Q 152 138 160 130 L 160 30"
            stroke="#BA0C2F"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Inner Black Vertical & Chevron Shapes */}
          <path
            d="M 40 148 L 40 68"
            stroke="#000000"
            strokeWidth="11"
            strokeLinecap="square"
            fill="none"
          />
          <path
            d="M 40 78 L 132 148"
            stroke="#000000"
            strokeWidth="11"
            strokeLinecap="round"
            fill="none"
          />

          {/* Right Red Accent Stroke of N */}
          <path
            d="M 152 30 L 152 118"
            stroke="#BA0C2F"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />

          {/* ================= LETTER F ================= */}
          {/* Solid Black Rounded F Top Bar & Vertical Stem */}
          <path
            d="M 180 150 L 180 54 Q 180 28 206 28 L 260 28 Q 270 28 270 38 Q 270 48 260 48 L 202 48 L 202 150 Q 202 158 191 158 Q 180 158 180 150 Z"
            fill="#000000"
          />

          {/* Middle Black Horizontal Bar of F */}
          <rect
            x="210"
            y="78"
            width="55"
            height="22"
            rx="11"
            fill="#000000"
          />

          {/* ================= LETTER S ================= */}
          {/* Top Black Sweeping Speed Loop */}
          <path
            d="M 412 36 L 298 36 Q 270 36 270 66 Q 270 94 300 94 L 372 94 Q 388 94 388 112 Q 388 128 368 128 L 235 128"
            stroke="#000000"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Middle Red Accent Speed Needle */}
          <path
            d="M 444 80 L 322 80 Q 312 80 312 87 Q 312 94 322 94 L 388 94"
            stroke="#BA0C2F"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Bottom Red Aerodynamic Track Sweep */}
          <path
            d="M 205 152 L 370 152 Q 412 152 412 118 Q 412 90 388 90 L 338 90"
            stroke="#BA0C2F"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Brand Text Identity with Proportional Harmony */}
      {showText && (
        <div className="flex flex-col text-right justify-center">
          <div className="flex items-center gap-1.5 whitespace-nowrap leading-none">
            <span
              className={`tracking-normal text-slate-900 dark:text-white transition-colors leading-tight ${titleSizes[size]}`}
            >
              نفیس تجارت <span className="text-[#BA0C2F] dark:text-[#FF4D6D] font-black">هوشمند</span>
            </span>
            <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md bg-rose-600/10 dark:bg-rose-500/20 text-[#BA0C2F] dark:text-[#FF4D6D] border border-rose-500/30">
              NFS
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium tracking-tight whitespace-nowrap mt-1 hidden xs:block">
            سامانه بازرگانی و واردات هوشمند کالا • B2B
          </span>
        </div>
      )}
    </div>
  );
};
