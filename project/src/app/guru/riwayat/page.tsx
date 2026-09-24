'use client';

import React, { useState } from 'react';
import { ChevronDown, FileSpreadsheet, Printer } from 'lucide-react';
import { WeeklyBarChart } from '@/components/charts/AllCharts';
import { REKAP_HARIAN_GURU } from '@/data/mockData';

export default function GuruRiwayatPage() {
  const [selectedMonth, setSelectedMonth] = useState('September 2026');
  const [selectedStatus, setSelectedStatus] = useState('Semua Status');

  const handleExport = (type: string) => {
    alert(`Mengekspor laporan rekapitulasi kehadiran (${type})...`);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar matching Page 11 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Dropdown Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-xs font-semibold text-slate-700 pl-4 pr-9 py-2.5 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm cursor-pointer"
            >
              <option value="September 2026">Bulan: September 2026</option>
              <option value="Agustus 2026">Bulan: Agustus 2026</option>
              <option value="Juli 2026">Bulan: Juli 2026</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-xs font-semibold text-slate-700 pl-4 pr-9 py-2.5 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm cursor-pointer"
            >
              <option value="Semua Status">Semua Status</option>
              <option value="Tepat Waktu">Tepat Waktu</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Izin">Izin</option>
              <option value="Alpha">Alpha</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExport('Excel')}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 shadow-sm transition-all active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => handleExport('PDF')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            <Printer className="w-4 h-4 text-slate-200" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {/* Card 1: Tren Kehadiran Mingguan (%) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Tren Kehadiran Mingguan (%)</h3>
        <WeeklyBarChart />
      </div>

      {/* Card 2: Rekap Kehadiran Harian */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Rekap Kehadiran Harian</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">Tanggal</th>
                <th className="pb-3 px-3">Total Hadir</th>
                <th className="pb-3 px-3">Total Lambat</th>
                <th className="pb-3 px-3">Total Izin</th>
                <th className="pb-3 px-3">Total Alpha</th>
                <th className="pb-3 px-3">Rasio Kehadiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {REKAP_HARIAN_GURU.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                    {row.tanggal}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{row.hadir}</td>
                  <td className="py-3 px-3 text-slate-600">{row.lambat}</td>
                  <td className="py-3 px-3 text-slate-600">{row.izin}</td>
                  <td className="py-3 px-3 text-slate-600">{row.alpha}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                      {row.rasio}
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
