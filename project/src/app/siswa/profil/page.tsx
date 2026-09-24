'use client';

import React from 'react';
import { Info, ShieldCheck } from 'lucide-react';
import { CURRENT_STUDENT } from '@/data/mockData';

export default function SiswaProfilPage() {
  const student = CURRENT_STUDENT;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Profil Siswa</h2>
        <p className="text-xs text-slate-400 mt-0.5">Informasi data diri dan akun akademik Anda</p>
      </div>

      {/* Profile & Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-7 border border-slate-200/80 shadow-sm space-y-8">
          {/* Header Banner with Avatar */}
          <div className="flex items-center gap-5 pb-6 border-b border-slate-100">
            <div className="w-20 h-20 rounded-full bg-[#273240] text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0">
              {student.avatarInitials}
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">{student.nama}</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                NIS {student.nis} • <span className="text-emerald-600 font-semibold">{student.status}</span>
              </p>
              <div className="mt-2.5">
                <span className="inline-block px-3 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  {student.kelas}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 text-xs">
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] block mb-1">
                NAMA LENGKAP
              </span>
              <p className="text-sm font-semibold text-slate-800">{student.nama}</p>
            </div>

            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] block mb-1">
                NOMOR INDUK SISWA (NIS)
              </span>
              <p className="text-sm font-semibold text-slate-800">{student.nis}</p>
            </div>

            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] block mb-1">
                KOMPETENSI KEAHLIAN
              </span>
              <p className="text-sm font-semibold text-slate-800">{student.jurusan}</p>
            </div>

            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] block mb-1">
                TAHUN AJARAN
              </span>
              <p className="text-sm font-semibold text-slate-800">{student.tahunAjaran}</p>
            </div>
          </div>

          {/* Info: Managed by Admin */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center gap-2.5 text-xs text-amber-700 font-medium">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[11px]">Data profil dan kata sandi dikelola oleh administrator. Hubungi admin untuk perubahan.</span>
          </div>
        </div>

        {/* Statistik Semester Ini (1 col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-4">Statistik Semester Ini</h3>

            {/* Big Percentage Header */}
            <div className="mb-6">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                RASIO KEHADIRAN TOTAL
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#1b64da] tracking-tight">
                  {student.statKehadiran.rasioSemesterTotal}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Dari target {student.statKehadiran.targetSemester}
                </span>
              </div>
            </div>

            {/* List Stats */}
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Hadir Efektif</span>
                <span className="font-bold text-slate-800">{student.statKehadiran.hadirEfektif}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Sakit / Izin Resmi</span>
                <span className="font-bold text-slate-800">{student.statKehadiran.sakitIzinResmi}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Terlambat</span>
                <span className="font-bold text-slate-800">{student.statKehadiran.terlambatSemester}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Alasan Lain / Alpha</span>
                <span className="font-bold text-slate-800">{student.statKehadiran.alasanLainAlpha}</span>
              </div>
            </div>
          </div>

          {/* Dapodik Note Footer */}
          <div className="mt-6 p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-2.5 text-xs text-blue-700 font-medium">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-[11px]">Data ini terverifikasi otomatis sistem dapodik.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
