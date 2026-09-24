'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { CURRENT_TEACHER } from '@/data/mockData';

export default function GuruProfilPage() {
  const teacher = CURRENT_TEACHER;

  return (
    <div className="space-y-6">
      {/* Main Grid: Profile Card (Left 2 cols) & Teaching Summary (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-7 border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
          {/* Circular Photo Avatar */}
          <div className="w-28 h-28 rounded-full overflow-hidden mb-4 border-4 border-slate-100 shadow-md bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white">
            <span className="text-3xl font-bold">RL</span>
          </div>

          <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{teacher.nama}</h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">NIP. {teacher.nip}</p>

          {/* Details list */}
          <div className="w-full max-w-md mt-8 space-y-4 text-left text-xs">
            <div className="border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                MATA PELAJARAN UTAMA
              </span>
              <p className="text-sm font-semibold text-slate-800">{teacher.mataPelajaranUtama}</p>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                EMAIL INSTANSI
              </span>
              <p className="text-sm font-semibold text-slate-800">{teacher.email}</p>
            </div>

            <div className="pb-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                NOMOR WHATSAPP
              </span>
              <p className="text-sm font-semibold text-slate-800">{teacher.telepon}</p>
            </div>
          </div>

          {/* Info: Managed by Admin */}
          <div className="w-full max-w-md mt-6 p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center gap-2.5 text-xs text-amber-700 font-medium text-left">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[11px]">Data profil dan kata sandi dikelola oleh administrator. Hubungi admin untuk perubahan.</span>
          </div>
        </div>

        {/* Teaching Summary (1 col) matching Page 12 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Ringkasan Aktivitas Mengajar (Semester Ganjil)
          </h3>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-400 font-medium block mb-1">Jam Mengajar / Minggu</span>
            <div className="text-2xl font-black text-slate-800">{teacher.jamMengajarMingguan}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-400 font-medium block mb-1">Rasio Kehadiran Mengajar</span>
            <div className="text-2xl font-black text-emerald-600">{teacher.rasioKehadiranMengajar}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-400 font-medium block mb-1">Wali Kelas</span>
            <div className="text-xl font-black text-slate-800">{teacher.waliKelas}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
