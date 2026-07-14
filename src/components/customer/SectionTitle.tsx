import React from 'react';

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: 'gold' | 'cyan';
  className?: string;
}

export default function SectionTitle({
  title,
  subtitle,
  icon,
  accent = 'cyan',
  className = '',
}: SectionTitleProps) {
  const accentColor = accent === 'gold' ? 'text-gold' : 'text-cyan-400';
  const dotColor = accent === 'gold' ? 'bg-[#D4AF37]' : 'bg-cyan-400';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        {icon && <div className={`${accentColor} shrink-0`}>{icon}</div>}
        <h3 className="font-black text-xs sm:text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
          {title}
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${dotColor}`} />
        </h3>
      </div>
      {subtitle && (
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
