'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart2,
  Settings,
  ShieldAlert,
  LogOut,
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Data Siswa', href: '/admin/siswa', icon: Users },
    { label: 'Data Guru', href: '/admin/guru', icon: BookOpen },
    { label: 'Laporan Absensi', href: '/admin/laporan', icon: BarChart2 },
    { label: 'Pengaturan', href: '/admin/pengaturan', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0d2847] text-white min-h-[calc(100vh-73px)] flex flex-col justify-between p-4 shrink-0 shadow-lg">
      <div>
        {/* Brand Logo inside Admin Sidebar */}
        <div className="px-3 py-4 mb-4 border-b border-blue-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold shadow">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight block leading-none">HadirFace</span>
              <span className="text-[10px] font-semibold text-sky-300 tracking-wider uppercase mt-1 block">
                Portal Administrasi
              </span>
            </div>
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
                    ? 'bg-blue-600 text-white shadow-md font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-blue-900/50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Info Card & Logout */}
      <div className="space-y-3 pt-6 border-t border-blue-900/60">
        <div className="p-3.5 rounded-xl bg-blue-950/70 border border-blue-800/60 text-xs text-blue-200">
          <p className="font-semibold text-white mb-1">Butuh Bantuan?</p>
          <p className="text-blue-300 leading-relaxed text-[11px]">
            Hubungi IT Support SMKN 11 Jakarta melalui Helpdesk untuk penyesuaian server Face ID.
          </p>
        </div>

        <Link
          href="/secure-admin-gate"
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Konsol Admin</span>
        </Link>
      </div>
    </aside>
  );
};
