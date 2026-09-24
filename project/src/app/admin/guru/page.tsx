'use client';

import React, { useState } from 'react';
import { Search, Plus, Upload, X, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { INITIAL_TEACHERS, Teacher } from '@/data/mockData';

export default function AdminDataGuruPage() {
  const [teachers, setTeachers] = useState<Teacher[]>(INITIAL_TEACHERS);
  const [filterWali, setFilterWali] = useState('Semua Wali Kelas');
  const [searchQuery, setSearchQuery] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [namaGuru, setNamaGuru] = useState('');
  const [nipGuru, setNipGuru] = useState('');
  const [mapelGuru, setMapelGuru] = useState('');
  const [kelasGuru, setKelasGuru] = useState('XI RPL 2');

  const filtered = teachers.filter((t) => {
    const matchesWali = filterWali === 'Semua Wali Kelas' || t.kelasWali === filterWali;
    const matchesSearch =
      t.namaLengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.nip.includes(searchQuery) ||
      t.mataPelajaran.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesWali && matchesSearch;
  });

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    const initials = namaGuru
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newTeacher: Teacher = {
      id: `t-${Date.now()}`,
      no: teachers.length + 1,
      namaLengkap: namaGuru,
      nip: nipGuru,
      mataPelajaran: mapelGuru,
      kelasWali: kelasGuru,
      status: 'Aktif',
      avatarInitials: initials,
      avatarBg: 'bg-teal-600',
      email: `${initials.toLowerCase()}@smkn11jkt.sch.id`,
      telepon: '08123456789',
    };

    setTeachers([...teachers, newTeacher]);
    setShowAddModal(false);
    setNamaGuru('');
    setNipGuru('');
    setMapelGuru('');
    showToast('Data guru berhasil ditambahkan!');
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Filter & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left Filter */}
        <div>
          <button
            onClick={() => setFilterWali('Semua Wali Kelas')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-sm"
          >
            Semua Wali Kelas
          </button>
        </div>

        {/* Center Search & Right Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari guru..."
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            />
          </div>

          <button
            onClick={() => alert('Fitur impor data direktori guru')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import Data</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1b64da] hover:bg-[#1552b5] text-white shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Guru</span>
          </button>
        </div>
      </div>

      {/* Teacher Directory Table Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">No</th>
                <th className="pb-3 px-3">Foto</th>
                <th className="pb-3 px-3">Nama Lengkap</th>
                <th className="pb-3 px-3">NIP</th>
                <th className="pb-3 px-3">Mata Pelajaran</th>
                <th className="pb-3 px-3">Kelas Wali</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 text-slate-400 font-semibold">{t.no}</td>
                  <td className="py-3 px-3">
                    <div
                      className={`w-7 h-7 rounded-full ${t.avatarBg || 'bg-slate-600'} text-white flex items-center justify-center font-bold text-[10px]`}
                    >
                      {t.avatarInitials}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                    {t.namaLengkap}
                  </td>
                  <td className="py-3 px-3 text-slate-500">{t.nip}</td>
                  <td className="py-3 px-3 text-slate-700 whitespace-nowrap">{t.mataPelajaran}</td>
                  <td className="py-3 px-3 text-slate-600">{t.kelasWali}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => alert(`Detail Guru: ${t.namaLengkap}`)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => alert(`Edit Guru: ${t.namaLengkap}`)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Teacher Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Tambah Data Guru Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddTeacher} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  required
                  value={namaGuru}
                  onChange={(e) => setNamaGuru(e.target.value)}
                  placeholder="Contoh: Budi Santoso, M.Kom."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">NIP Guru</label>
                <input
                  type="text"
                  required
                  value={nipGuru}
                  onChange={(e) => setNipGuru(e.target.value)}
                  placeholder="Contoh: 198501012010011001"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mata Pelajaran</label>
                <input
                  type="text"
                  required
                  value={mapelGuru}
                  onChange={(e) => setMapelGuru(e.target.value)}
                  placeholder="Contoh: Pemrograman Berorientasi Objek"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Kelas Binaan / Wali</label>
                <input
                  type="text"
                  value={kelasGuru}
                  onChange={(e) => setKelasGuru(e.target.value)}
                  placeholder="Contoh: XI RPL 2"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                >
                  Simpan Guru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
