'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CameraScanner } from '@/components/face-id/CameraScanner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Calendar, HelpCircle, ArrowRight } from 'lucide-react';

export default function SiswaDashboardPage() {
  const [logs, setLogs] = useState([
    { tanggal: '11 Sep 2026', waktu: '06:47 WIB', status: 'Tepat Waktu' },
    { tanggal: '10 Sep 2026', waktu: '06:52 WIB', status: 'Tepat Waktu' },
    { tanggal: '09 Sep 2026', waktu: '07:08 WIB', status: 'Terlambat' },
    { tanggal: '08 Sep 2026', waktu: '06:45 WIB', status: 'Tepat Waktu' },
  ]);

  const classmates = [
    { nama: 'Nadia Safitri', initials: 'NS', bg: 'bg-emerald-600', waktu: 'Masuk pukul 06:49', status: 'Tepat Waktu' },
    { nama: 'Ahmad Fauzan', initials: 'AF', bg: 'bg-slate-500', waktu: 'Masuk pukul 06:53', status: 'Tepat Waktu' },
    { nama: 'Dinda Putri', initials: 'DP', bg: 'bg-slate-700', waktu: 'Masuk pukul 07:04', status: 'Terlambat' },
    { nama: 'Rizky Ananda', initials: 'RA', bg: 'bg-slate-600', waktu: 'Masuk pukul 07:06', status: 'Terlambat' },
  ];

  const handleNewAttendance = (time: string) => {
    // Add real-time log entry
    setLogs((prev) => [
      { tanggal: '11 Sep 2026', waktu: time, status: 'Tepat Waktu' },
      ...prev.slice(0, 3),
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Columns: Camera & Classmate Activity */}
      <div className="lg:col-span-2 space-y-6">
        {/* Camera Scanner Viewfinder */}
        <CameraScanner onSuccessAttendance={handleNewAttendance} />

        {/* Aktivitas Teman Kelas */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Aktivitas Teman Kelas</h3>
              <p className="text-xs text-slate-400">Absensi terbaru • XI RPL 2</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span>28 dari 32 siswa hadir</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {classmates.map((c, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-slate-50/50 flex flex-col justify-between"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className={`w-8 h-8 rounded-full ${c.bg} text-white flex items-center justify-center font-bold text-xs shrink-0`}
                  >
                    {c.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">{c.nama}</div>
                    <div className="text-[10px] text-slate-400 truncate">{c.waktu}</div>
                  </div>
                </div>
                <div className="mt-1">
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Riwayat Absensi Widget & Limit info */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Riwayat Absensi</h3>
            <Link
              href="/siswa/riwayat"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Lihat semua
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Dark card: Kehadiran Hari Ini */}
          <div className="bg-[#122438] text-white p-5 rounded-2xl mb-5 flex items-center justify-between shadow-md">
            <div>
              <p className="text-xs text-slate-300 font-medium mb-1">Kehadiran Hari Ini</p>
              <div className="text-3xl font-extrabold tracking-tight">Hadir</div>
              <p className="text-[11px] text-slate-400 mt-1">11 Sep 2026 • 06:47 WIB</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-sky-400">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          {/* List items */}
          <div className="space-y-3">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800">{log.tanggal}</div>
                  <div className="text-[11px] text-slate-400">{log.waktu}</div>
                </div>
                <StatusBadge status={log.status} />
              </div>
            ))}
          </div>

          {/* Info Card: Batas hadir */}
          <div className="mt-6 p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-snug">
              Batas hadir tepat waktu pukul <span className="font-semibold text-slate-700">07:00 WIB</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
