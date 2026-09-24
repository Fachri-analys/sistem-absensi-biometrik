'use client';

import React, { useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AttendanceDonutChart } from '@/components/charts/AllCharts';
import { INITIAL_STUDENTS } from '@/data/mockData';

export default function GuruKelasPage() {
  const [genderFilter, setGenderFilter] = useState('Semua Gender');
  const [sortOrder, setSortOrder] = useState('no-asc');

  const filteredStudents = INITIAL_STUDENTS.filter((s) => {
    if (genderFilter === 'Semua Gender') return true;
    return s.jenisKelamin === genderFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner matching Page 9 */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              XI RPL 2 (Rekayasa Perangkat Lunak)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Wali Kelas: Bu Ratna | Tahun Ajaran 2026/2027
            </p>
          </div>
          <div className="self-start sm:self-auto">
            <span className="inline-block px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700">
              32 Total Siswa
            </span>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 text-xs">
          <div>
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
              JURUSAN
            </span>
            <p className="font-bold text-slate-800">Rekayasa Perangkat Lunak</p>
          </div>
          <div>
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
              HARI MENGAJAR
            </span>
            <p className="font-bold text-slate-800">Selasa & Jumat</p>
          </div>
          <div>
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
              RUANG KELAS
            </span>
            <p className="font-bold text-slate-800">Lab RPL Baru (Lantai 2)</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Student Roster (Left 2 cols) & Attendance Donut (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          {/* Table Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h3 className="text-base font-bold text-slate-800">Daftar Siswa Kelas XI RPL 2</h3>

            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 pl-3 pr-8 py-2 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="Semua Gender">Semua Gender</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 pl-3 pr-8 py-2 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="no-asc">Urutkan: No Absen</option>
                  <option value="name-asc">Urutkan: Nama (A-Z)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-3">No</th>
                  <th className="pb-3 px-3">Foto</th>
                  <th className="pb-3 px-3">Nama Siswa</th>
                  <th className="pb-3 px-3">NIS</th>
                  <th className="pb-3 px-3">Jenis Kelamin</th>
                  <th className="pb-3 px-3">Status Hari Ini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-slate-400 font-semibold">{s.no}</td>
                    <td className="py-3 px-3">
                      <div
                        className={`w-8 h-8 rounded-full ${s.avatarBg || 'bg-slate-600'} text-white flex items-center justify-center font-bold text-[11px]`}
                      >
                        {s.avatarInitials}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">{s.nama}</td>
                    <td className="py-3 px-3 text-slate-500">{s.nis}</td>
                    <td className="py-3 px-3 text-slate-500">{s.jenisKelamin}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={s.statusHariIni} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Kehadiran Donut & Urgent Notification */}
        <div className="space-y-6">
          {/* Donut Chart Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <h4 className="text-xs font-bold text-slate-800 tracking-tight mb-2">Kehadiran Hari Ini</h4>
            <AttendanceDonutChart />
          </div>

          {/* Urgent Notification Card */}
          <div className="bg-[#fff8eb] rounded-2xl p-5 border border-[#fde68a] text-xs space-y-2">
            <div className="flex items-center gap-2 text-[#d97706] font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Pemberitahuan Mendesak</span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              Terdapat 2 siswa (Farhan & Aditya) yang tidak memindai wajah hari ini. Segera verifikasi secara manual jika ada izin tertulis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
