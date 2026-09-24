import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  badgeText?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  badgeText,
  badgeVariant = 'primary',
  className,
}) => {
  const badgeStyles = {
    primary: 'text-blue-600 bg-blue-50 border-blue-200/60',
    success: 'text-emerald-600 bg-emerald-50 border-emerald-200/60',
    warning: 'text-amber-600 bg-amber-50 border-amber-200/60',
    danger: 'text-rose-600 bg-rose-50 border-rose-200/60',
    neutral: 'text-slate-600 bg-slate-100 border-slate-200',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between transition-all hover:shadow-md',
        className
      )}
    >
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        {title}
      </span>
      <div className="flex items-baseline justify-between mt-2">
        <span className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
          {value}
        </span>
        {badgeText && (
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-0.5 rounded-full border',
              badgeStyles[badgeVariant]
            )}
          >
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
