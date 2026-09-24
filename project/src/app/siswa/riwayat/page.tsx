'use client';

import React, { useState } from 'react';
import { Download, ChevronDown, Quote } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MonthlyBarChart } from '@/components/charts/AllCharts';
import { STUDENT_ATTENDANCE_LOGS, CURRENT_STUDENT } from '@/data/mockData';

export default function SiswaRiwayatPage() {
  const [selectedMonth, setSelectedMonth] = useState('September 2026');

  const handleDownloadPDF = () => {
    alert('Mengunduh Riwayat Kehadiran Semester Ganjil (PDF)...');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Riwayat Kehadiran Lengkap</h2>
          <p className="text-xs text-slate-400 mt-0.5">Melihat seluruh aktivitas absensi semester ganjil</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-xs font-semibold text-slate-700 pl-4 pr-9 py-2.5 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm cursor-pointer"
            >
              <option value="September 2026">September 2026</option>
              <option value="Agustus 2026">Agustus 2026</option>
              <option value="Juli 2026">Juli 2026</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-[#1b64da] hover:bg-[#1552b5] text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Unduh PDF</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Metric Cards matching design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL HADIR</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-800">18 Hari</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              90.5%
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TERLAMBAT</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-800">2 Kali</span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              -1.2%
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">IZIN / SAKIT</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-800">1 Hari</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
              Dokumen lengkap
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ALPHA / TANPA KET</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-800">0 Hari</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              Bagus!
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Log Table (Left) and Trends & Notes (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table Column (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Log Aktivitas Bulanan</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-3">Tanggal</th>
                  <th className="pb-3 px-3">Hari</th>
                  <th className="pb-3 px-3">Waktu Masuk</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {STUDENT_ATTENDANCE_LOGS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {row.tanggal}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{row.hari}</td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{row.waktuMasuk}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{row.keterangan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar: Tren Bulanan & Catatan Pembimbing */}
        <div className="space-y-6">
          {/* Monthly Trend Chart */}
          <MonthlyBarChart />

          {/* Catatan Pembimbing */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-3">
              <Quote className="w-4 h-4 text-blue-600" />
              <span>Catatan Pembimbing</span>
            </div>
            <blockquote className="text-xs text-slate-600 italic leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              &ldquo;{CURRENT_STUDENT.catatanPembimbing}&rdquo;
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  );
}
