'use client';

import React from 'react';

import { WeeklyLineChart } from '@/components/charts/AllCharts';
import { CLASS_SUMMARY_ADMIN } from '@/data/mockData';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* 4 Stat Metric Cards matching Page 14 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL SISWA</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-800">480</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
              15 Kelas
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            TOTAL GURU & WALI
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-800">24</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
              24 Pendidik
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL KELAS</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-800">15</span>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60">
              3 Jurusan
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            KEHADIRAN HARI INI
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-800">94%</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
              Sangat Baik
            </span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Weekly Line Chart (Left 2 cols) & Pemberitahuan Terbaru (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Tren Kehadiran Mingguan (%)</h3>
          <WeeklyLineChart />
        </div>

        {/* Right 1 Col: Pemberitahuan Terbaru */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Pemberitahuan Terbaru</h3>

          {/* Item 1 */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs">
            <span className="font-bold text-blue-700 block mb-0.5">Siswa Baru Terdaftar</span>
            <p className="text-[11px] text-blue-900/80 leading-snug">
              Andika Pratama (XI RPL 2) berhasil mendaftarkan Face ID biometrik wajah.
            </p>
          </div>

          {/* Item 2 */}
          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-100 text-xs">
            <span className="font-bold text-rose-700 block mb-0.5">Anomali Deteksi Absensi</span>
            <p className="text-[11px] text-rose-900/80 leading-snug">
              Pencahayaan rendah terdeteksi di kamera gerbang utama pukul 07:12 WIB.
            </p>
          </div>

          {/* Item 3 */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 text-xs">
            <span className="font-bold text-amber-700 block mb-0.5">Izin Pending (1)</span>
            <p className="text-[11px] text-amber-900/80 leading-snug">
              Dinda Putri mengajukan izin sakit dengan lampiran surat dokter.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Table: Ringkasan Kehadiran Kelas Hari Ini */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-4">
          Ringkasan Kehadiran Kelas Hari Ini
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">Kelas</th>
                <th className="pb-3 px-3">Total Siswa</th>
                <th className="pb-3 px-3">Hadir</th>
                <th className="pb-3 px-3">Terlambat</th>
                <th className="pb-3 px-3">Izin</th>
                <th className="pb-3 px-3">Alpha</th>
                <th className="pb-3 px-3">Persentase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {CLASS_SUMMARY_ADMIN.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">{c.kelas}</td>
                  <td className="py-3 px-3 text-slate-600">{c.totalSiswa}</td>
                  <td className="py-3 px-3 text-emerald-600 font-semibold">{c.hadir}</td>
                  <td className="py-3 px-3 text-amber-600 font-semibold">{c.terlambat}</td>
                  <td className="py-3 px-3 text-blue-600">{c.izin}</td>
                  <td className="py-3 px-3 text-rose-600 font-semibold">{c.alpha}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                      {c.persentase}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
