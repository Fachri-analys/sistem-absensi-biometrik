'use client';

import React, { useState } from 'react';
import { Search, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { ClassComparisonBarChart } from '@/components/charts/AllCharts';
import { CLASS_REPORT_ADMIN } from '@/data/mockData';

export default function AdminLaporanPage() {
  const [selectedClass, setSelectedClass] = useState('Kelas XI RPL 2');
  const [dateRange, setDateRange] = useState('1 Sep - 11 Sep 2026');
  const [searchQuery, setSearchQuery] = useState('');

  const handleExport = (type: string) => {
    alert(`Mengekspor Laporan Kehadiran (${type})...`);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-xs font-semibold text-slate-700 pl-3.5 pr-8 py-2.5 rounded-xl hover:border-slate-300 focus:outline-none shadow-sm cursor-pointer"
            >
              <option value="Kelas XI RPL 2">Kelas XI RPL 2</option>
              <option value="Kelas X TKJ 1">Kelas X TKJ 1</option>
              <option value="Kelas XII RPL 1">Kelas XII RPL 1</option>
              <option value="Kelas XI RPL 1">Kelas XI RPL 1</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-xs font-semibold text-slate-700 pl-3.5 pr-8 py-2.5 rounded-xl hover:border-slate-300 focus:outline-none shadow-sm cursor-pointer"
            >
              <option value="1 Sep - 11 Sep 2026">1 Sep - 11 Sep 2026</option>
              <option value="Agustus 2026">Agustus 2026</option>
              <option value="Juli 2026">Juli 2026</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Center Search & Export Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari riwayat laporan..."
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            />
          </div>

          <button
            onClick={() => handleExport('PDF')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-rose-500" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={() => handleExport('Excel')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1b64da] hover:bg-[#1552b5] text-white shadow-sm transition-all active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Comparison Chart & Semester Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Comparison Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-2">
            Perbandingan Kehadiran Antar Kelas (Hari Ini)
          </h3>
          <ClassComparisonBarChart />
        </div>

        {/* Right 1 Col: Dark Stats Card matching Page 17 */}
        <div className="bg-[#122438] text-white rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-300 font-medium block mb-1">Statistik Semester</span>
            <h4 className="text-xs text-slate-400 font-normal">Rata-rata Sekolah Ganjil</h4>
            <div className="text-4xl font-black text-white mt-2 tracking-tight">94.8%</div>
          </div>

          <div className="pt-4 border-t border-slate-700/60 text-xs text-slate-300">
            <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-semibold mb-2">
              Prestasi Baik
            </span>
            <p className="text-[11px] text-slate-400 leading-snug">
              Unggul dan stabil di atas target sekolah (90%)
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Table: Detail Laporan Kehadiran Kelas */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-4">
          Detail Laporan Kehadiran Kelas
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">Kelas</th>
                <th className="pb-3 px-3">Total Siswa</th>
                <th className="pb-3 px-3">Rata-rata Hadir</th>
                <th className="pb-3 px-3">Terlambat (Siswa)</th>
                <th className="pb-3 px-3">Alpha Terbanyak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {CLASS_REPORT_ADMIN.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">{row.kelas}</td>
                  <td className="py-3 px-3 text-slate-600">{row.totalSiswa}</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">{row.rataHadir}</td>
                  <td className="py-3 px-3 text-amber-600">{row.terlambat}</td>
                  <td className="py-3 px-3 text-rose-600 font-medium">{row.alpha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
