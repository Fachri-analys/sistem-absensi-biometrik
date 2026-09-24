import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const normalized = status.toLowerCase();

  if (normalized.includes('tepat waktu') || normalized === 'aktif' || normalized === 'hadir') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200/70 ${className}`}>
        {status}
      </span>
    );
  }

  if (normalized.includes('terlambat') || normalized.includes('lambat')) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fff8eb] text-[#d97706] border border-[#fde68a] ${className}`}>
        {status}
      </span>
    );
  }

  if (normalized.includes('izin') || normalized.includes('sakit')) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] ${className}`}>
        {status}
      </span>
    );
  }

  if (normalized.includes('alpha') || normalized.includes('alpa') || normalized === 'tidak aktif') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200/70 ${className}`}>
        {status}
      </span>
    );
  }

  if (normalized.includes('cuti')) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 ${className}`}>
        {status}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 ${className}`}>
      {status}
    </span>
  );
};
