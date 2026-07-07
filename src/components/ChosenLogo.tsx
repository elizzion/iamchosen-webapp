import React from 'react';

interface ChosenLogoProps {
  className?: string;
  showText?: boolean;
  textColorClass?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
}

export default function ChosenLogo({
  className = '',
  showText = false,
  textColorClass = 'text-gold',
  size = 'md'
}: ChosenLogoProps) {
  // Determine standard size classes if not custom
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
    xl: 'w-48 h-48',
    custom: className
  };

  const currentSizeClass = size === 'custom' ? className : sizeClasses[size];

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Visual Logo SVG */}
      <svg
        className={currentSizeClass}
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Rich metallic golden gradient for the figure and crescent */}
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5D061" />
            <stop offset="30%" stopColor="#E6B33C" />
            <stop offset="70%" stopColor="#B58925" />
            <stop offset="100%" stopColor="#8C6514" />
          </linearGradient>

          {/* Vibrant green gradient for the leaf */}
          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9BD446" />
            <stop offset="50%" stopColor="#7CB03D" />
            <stop offset="100%" stopColor="#4A751F" />
          </linearGradient>

          {/* Drop shadow for extra depth */}
          <filter id="subtle-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.4" />
          </filter>
        </defs>

        <g filter="url(#subtle-shadow)">
          {/* 1. LEFT GREEN LEAF (In two premium lobes with a natural white split vein) */}
          {/* Lobe 1: Outer Left */}
          <path
            d="M85 115 C60 155, 95 245, 210 320 C195 285, 170 230, 150 190 C115 150, 100 130, 85 115 Z"
            fill="url(#greenGradient)"
          />
          {/* Lobe 2: Inner Right */}
          <path
            d="M158 193 C180 220, 220 270, 238 312 C230 245, 195 180, 158 193 Z"
            fill="url(#greenGradient)"
          />

          {/* 2. CENTRAL GOLDEN HUMAN FIGURE */}
          {/* Head */}
          <circle cx="245" cy="85" r="42" fill="url(#goldGradient)" />
          {/* Dynamic Body and Outstretched Arms */}
          <path
            d="M88 105 C140 105, 185 125, 245 155 C275 140, 375 75, 490 10 C405 100, 285 245, 258 290 C256 295, 254 295, 254 290 C242 225, 175 155, 88 105 Z"
            fill="url(#goldGradient)"
          />

          {/* 3. SWEEPING GOLDEN CRESCENT ARC (Frames the bottom and right side) */}
          <path
            d="M85 225 C80 275, 115 330, 175 365 C245 405, 340 375, 385 305 C405 270, 400 215, 350 120 C395 190, 410 270, 375 325 C330 395, 225 415, 150 375 C100 345, 80 290, 85 225 Z"
            fill="url(#goldGradient)"
          />
        </g>
      </svg>

      {/* Official Text Branding (Optional) */}
      {showText && (
        <div className="text-center mt-4 select-none">
          <div className={`font-black tracking-[0.25em] text-lg sm:text-xl uppercase ${textColorClass}`}>
            I AM CHOSEN
          </div>
          <div className="text-[9px] sm:text-[10px] tracking-[0.45em] text-zinc-400 font-medium uppercase mt-1">
            INTERNATIONAL
          </div>
        </div>
      )}
    </div>
  );
}
