'use client';

import React, { useState } from 'react';
import { Info, CheckCircle2, Save } from 'lucide-react';

interface ManualEntry {
  id: string;
  no: number;
  nama: string;
  nis: string;
  status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
  keterangan: string;
  selected: boolean;
}

export default function GuruAbsensiManualPage() {
  const [entries, setEntries] = useState<ManualEntry[]>([
    { id: '1', no: 1, nama: 'Aditya Wijaya', nis: '20241001', status: 'Hadir', keterangan: '', selected: true },
    { id: '2', no: 2, nama: 'Amanda Lestari', nis: '20241005', status: 'Hadir', keterangan: '', selected: true },
    { id: '3', no: 3, nama: 'Bagus Pratama', nis: '20241012', status: 'Hadir', keterangan: '', selected: true },
    { id: '4', no: 4, nama: 'Citra Dewi', nis: '20241019', status: 'Sakit', keterangan: 'Surat dokter terlampir di WhatsApp', selected: true },
    { id: '5', no: 5, nama: 'Dimas Saputra', nis: '20241022', status: 'Hadir', keterangan: '', selected: true },
    { id: '6', no: 6, nama: 'Farhan Malik', nis: '20241031', status: 'Alpa', keterangan: '', selected: false },
  ]);

  const [toastMsg, setToastMsg] = useState('');

  const handleStatusChange = (id: string, newStatus: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa') => {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
  };

  const handleKeteranganChange = (id: string, text: string) => {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, keterangan: text } : item))
    );
  };

  const toggleSelect = (id: string) => {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSave = () => {
    setToastMsg('Data absensi manual kelas XI RPL 2 berhasil disimpan ke server!');
    setTimeout(() => setToastMsg(''), 3000);
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Blue Informative Alert Banner matching Page 10 */}
      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100 flex items-center gap-3 text-xs text-sky-800">
        <Info className="w-5 h-5 text-sky-600 shrink-0" />
        <p className="leading-snug">
          Gunakan absensi manual jika HadirFace mengalami kendala koneksi atau jika siswa memiliki surat izin fisik.
        </p>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        {/* Header & Save Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-800">Input Absensi Manual Kelas XI RPL 2</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tanggal: 11 September 2026 • Jam Ke-1 & 2 (Produktif RPL)
            </p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-2 bg-[#12273e] hover:bg-[#0c1c2e] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Absensi</span>
          </button>
        </div>

        {/* Form Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3 text-center w-12">Pilih</th>
                <th className="pb-3 px-3 w-12">No</th>
                <th className="pb-3 px-3">Nama Siswa</th>
                <th className="pb-3 px-3">NIS</th>
                <th className="pb-3 px-3">Status Kehadiran</th>
                <th className="pb-3 px-3">Keterangan Tambahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {entries.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Select Checkbox */}
                  <td className="py-3.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                  </td>

                  {/* No */}
                  <td className="py-3.5 px-3 text-slate-400 font-semibold">{item.no}</td>

                  {/* Nama */}
                  <td className="py-3.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                    {item.nama}
                  </td>

                  {/* NIS */}
                  <td className="py-3.5 px-3 text-slate-500">{item.nis}</td>

                  {/* Status Kehadiran Radio Segmented Buttons */}
                  <td className="py-3.5 px-3">
                    <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'Hadir')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          item.status === 'Hadir'
                            ? 'bg-[#1b64da] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Hadir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'Sakit')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          item.status === 'Sakit'
                            ? 'bg-[#f59e0b] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Sakit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'Izin')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          item.status === 'Izin'
                            ? 'bg-[#3b82f6] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Izin
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'Alpa')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          item.status === 'Alpa'
                            ? 'bg-[#ef4444] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Alpa
                      </button>
                    </div>
                  </td>

                  {/* Keterangan Tambahan Input */}
                  <td className="py-3.5 px-3">
                    <input
                      type="text"
                      value={item.keterangan}
                      onChange={(e) => handleKeteranganChange(item.id, e.target.value)}
                      placeholder="Tulis catatan jika ada..."
                      className="w-full max-w-sm px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                    />
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
