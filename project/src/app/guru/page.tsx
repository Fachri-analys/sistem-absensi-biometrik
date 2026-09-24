'use client';

import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { INITIAL_STUDENTS, Student } from '@/data/mockData';

export default function GuruDashboardPage() {
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [toastMsg, setToastMsg] = useState('');

  const handleQuickAction = (id: string, newStatus: 'Tepat Waktu' | 'Izin') => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, statusHariIni: newStatus } : s))
    );
    setToastMsg(`Status presensi berhasil diubah ke ${newStatus}!`);
    setTimeout(() => setToastMsg(''), 2500);
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200">
          {toastMsg}
        </div>
      )}

      {/* 3 Metric Cards matching Page 8 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            TOTAL SISWA KELAS
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-800">32</span>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
              1 Kelas Aktif
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            HADIR HARI INI
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-800">115</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
              90% Kehadiran
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            BELUM ABSEN / ALPHA
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-800">13</span>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200/60">
              Tindak Lanjut
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Attendance Table (Left 2 cols) & Teacher Performance/Class info (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-800">Daftar Absensi Kelas Hari Ini</h3>
            <p className="text-xs text-slate-400 font-medium">XI RPL 2 (Rekayasa Perangkat Lunak)</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-3">No</th>
                  <th className="pb-3 px-3">Nama Siswa</th>
                  <th className="pb-3 px-3">NIS</th>
                  <th className="pb-3 px-3">Waktu Masuk</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-center">Aksi Manual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-slate-400 font-semibold">{s.no}</td>
                    <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">{s.nama}</td>
                    <td className="py-3 px-3 text-slate-500">{s.nis}</td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{s.waktuMasuk}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={s.statusHariIni} />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleQuickAction(s.id, 'Tepat Waktu')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                            s.statusHariIni === 'Tepat Waktu'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Hadir
                        </button>
                        <button
                          onClick={() => handleQuickAction(s.id, 'Izin')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                            s.statusHariIni.includes('Izin')
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Izin
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Kehadiran Saya, Kelas Saya, Pemberitahuan Hari Ini */}
        <div className="space-y-5">
          {/* Kehadiran Saya Dark Card */}
          <div className="bg-[#122438] text-white p-5 rounded-2xl shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-300 font-medium">Kehadiran Saya Hari Ini</span>
              <Calendar className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-extrabold tracking-tight mb-2">Hadir</div>
            <p className="text-[11px] text-slate-400 leading-snug">
              11 Sep 2026 • 06:32 WIB • Tepat Waktu
            </p>
          </div>

          {/* Kelas Saya Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Kelas Saya
              </span>
              <h4 className="text-base font-extrabold text-slate-800 mt-1">XI RPL 2</h4>
              <p className="text-xs text-slate-500">Rekayasa Perangkat Lunak</p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Jumlah siswa</span>
                <span className="font-bold text-slate-800">32 siswa</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jadwal</span>
                <span className="font-bold text-slate-800">Selasa & Jumat</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wali kelas</span>
                <span className="font-bold text-slate-800">Bu Ratna</span>
              </div>
            </div>
          </div>

          {/* Pemberitahuan Hari Ini */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-800 tracking-tight">Pemberitahuan Hari Ini</h4>

            {/* Notification 1 */}
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs">
              <span className="font-bold text-rose-700 block mb-0.5">3 Siswa Belum Absen</span>
              <p className="text-[11px] text-rose-600/90 leading-snug">
                Siswa XI RPL 2 belum melakukan pemindaian wajah hingga pukul 07:15.
              </p>
            </div>

            {/* Notification 2 */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs">
              <span className="font-bold text-amber-700 block mb-0.5">Izin Sakit Baru</span>
              <p className="text-[11px] text-amber-700/90 leading-snug">
                Citra Dewi (XI RPL 2) mengirimkan surat izin sakit hari ini.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
