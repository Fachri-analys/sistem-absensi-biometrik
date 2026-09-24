'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, LogOut } from 'lucide-react';

interface TopHeaderProps {
  role: 'siswa' | 'guru' | 'admin';
  userName?: string;
  searchPlaceholder?: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  role,
  userName,
  searchPlaceholder = 'Cari informasi absensi...',
}) => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    router.push(role === 'admin' ? '/secure-admin-gate' : '/login');
  };

  const getGreeting = () => {
    if (userName) return `Selamat pagi, ${userName}!`;
    if (role === 'siswa') return 'Selamat pagi, Raka!';
    if (role === 'guru') return 'Selamat pagi, Bu Ratna!';
    return 'Selamat pagi, Admin!';
  };

  return (
    <header className="bg-white border-b border-slate-200/80 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Left Greeting & Date */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">{getGreeting()}</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Jumat, 11 September 2026</p>
      </div>

      {/* Center Search Input */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full bg-[#f8fafc] hover:bg-slate-100/80 focus:bg-white text-sm text-slate-700 placeholder-slate-400 pl-11 pr-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Right School Badge & Quick Switcher */}
      <div className="flex items-center gap-5">
        {/* School branding */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-sm font-bold text-slate-800 tracking-tight leading-snug">SMKN 11 Jakarta</div>
            <div className="text-[11px] text-slate-500 font-medium tracking-normal">Unggul • Kreatif • Berkarakter</div>
          </div>
          <div className="w-9 h-9 relative rounded-full bg-white border border-slate-200 p-1 shadow-sm flex items-center justify-center shrink-0">
            <Image
              src="/images/logo-smkn11.webp"
              alt="Logo SMKN 11 Jakarta"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* User Identity & Logout Button (Isolated Per Role - No Cross Switching) */}
        <div className="h-8 w-[1px] bg-slate-200" />
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 pl-2.5 pr-3 py-1.5 rounded-xl">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                role === 'siswa'
                  ? 'bg-blue-600'
                  : role === 'guru'
                  ? 'bg-indigo-600'
                  : 'bg-slate-800'
              }`}
            >
              {role === 'siswa' ? 'RP' : role === 'guru' ? 'RL' : 'AD'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {role === 'siswa'
                  ? 'Raka Pratama'
                  : role === 'guru'
                  ? 'Bu Ratna Lestari'
                  : 'Hendra IT'}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {role === 'siswa'
                  ? 'NISN: 20241087 (Siswa)'
                  : role === 'guru'
                  ? 'NIP: 19850412... (Guru)'
                  : 'Administrator'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
            title={`Keluar dari Portal ${role === 'siswa' ? 'Siswa' : role === 'guru' ? 'Guru' : 'Admin'}`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
