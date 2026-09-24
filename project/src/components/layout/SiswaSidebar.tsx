'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, User, HelpCircle, ScanFace, LogOut } from 'lucide-react';

export const SiswaSidebar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/siswa', icon: Home },
    { label: 'Riwayat', href: '/siswa/riwayat', icon: ClipboardList },
    { label: 'Profil Saya', href: '/siswa/profil', icon: User },
    { label: 'Bantuan', href: '/siswa/bantuan', icon: HelpCircle },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 min-h-[calc(100vh-73px)] flex flex-col justify-between p-4 shrink-0">
      <div>
        {/* Brand Logo inside sidebar */}
        <div className="flex items-center gap-2.5 px-3 py-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <ScanFace className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-slate-800 tracking-tight block leading-none">HadirFace</span>
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Portal Siswa</span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50/80 text-blue-600 shadow-sm border border-blue-100/50'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Info Card & Logout */}
      <div className="space-y-3 pt-6 border-t border-slate-100">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
          <p className="font-semibold text-slate-800 mb-1">Kesulitan absen?</p>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            Pastikan wajah terlihat jelas dan pencahayaan ruangan cukup.
          </p>
        </div>

        <Link
          href="/login"
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Portal Siswa</span>
        </Link>
      </div>
    </aside>
  );
};
