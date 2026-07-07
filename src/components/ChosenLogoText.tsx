import React from 'react';

interface ChosenLogoTextProps {
  className?: string;
  height?: number | string;
}

export default function ChosenLogoText({
  className = 'h-9 w-auto',
  height = '100%'
}: ChosenLogoTextProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 1000 250"
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Rich metallic golden gradient for the figure and crescent */}
        <linearGradient id="logoTextGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5D061" />
          <stop offset="30%" stopColor="#E6B33C" />
          <stop offset="70%" stopColor="#B58925" />
          <stop offset="100%" stopColor="#8C6514" />
        </linearGradient>

        {/* Vibrant green gradient for the leaf */}
        <linearGradient id="logoTextGreenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9BD446" />
          <stop offset="50%" stopColor="#7CB03D" />
          <stop offset="100%" stopColor="#4A751F" />
        </linearGradient>

        {/* Drop shadow for extra depth */}
        <filter id="logoTextSubtleShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      <g filter="url(#logoTextSubtleShadow)">
        {/* LEFT CREST (Scaled from 500x500 original) */}
        <g transform="translate(10, 10) scale(0.46)">
          {/* Leaf Outer */}
          <path
            d="M85 115 C60 155, 95 245, 210 320 C195 285, 170 230, 150 190 C115 150, 100 130, 85 115 Z"
            fill="url(#logoTextGreenGradient)"
          />
          {/* Leaf Inner */}
          <path
            d="M158 193 C180 220, 220 270, 238 312 C230 245, 195 180, 158 193 Z"
            fill="url(#logoTextGreenGradient)"
          />
          {/* Figure Head */}
          <circle cx="245" cy="85" r="42" fill="url(#logoTextGoldGradient)" />
          {/* Figure Body */}
          <path
            d="M88 105 C140 105, 185 125, 245 155 C275 140, 375 75, 490 10 C405 100, 285 245, 258 290 C256 295, 254 295, 254 290 C242 225, 175 155, 88 105 Z"
            fill="url(#logoTextGoldGradient)"
          />
          {/* Crescent */}
          <path
            d="M85 225 C80 275, 115 330, 175 365 C245 405, 340 375, 385 305 C405 270, 400 215, 350 120 C395 190, 410 270, 375 325 C330 395, 225 415, 150 375 C100 345, 80 290, 85 225 Z"
            fill="url(#logoTextGoldGradient)"
          />
        </g>

        {/* VERTICAL DIVIDER LINE */}
        <line x1="270" y1="25" x2="270" y2="225" stroke="url(#logoTextGoldGradient)" strokeWidth="6" strokeLinecap="round" />

        {/* TEXT BRANDING */}
        {/* "I AM CHOSEN" */}
        <text
          x="310"
          y="135"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontWeight="900"
          fontSize="82"
          letterSpacing="4"
          fill="url(#logoTextGoldGradient)"
        >I AM CHOSEN</text>

        {/* Left underline/side-line */}
        <line x1="310" y1="185" x2="420" y2="185" stroke="url(#logoTextGoldGradient)" strokeWidth="3" />

        {/* "INTERNATIONAL" */}
        <text
          x="440"
          y="196"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontWeight="800"
          fontSize="32"
          letterSpacing="12"
          fill="#38BDF8"
        >INTERNATIONAL</text>

        {/* Right underline/side-line */}
        <line x1="835" y1="185" x2="945" y2="185" stroke="url(#logoTextGoldGradient)" strokeWidth="3" />
      </g>
    </svg>
  );
}
