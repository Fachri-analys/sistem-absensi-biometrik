'use client';

import React, { useState } from 'react';
import { Search, Plus, Upload, X, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { INITIAL_STUDENTS, Student } from '@/data/mockData';

export default function AdminDataSiswaPage() {
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [classFilter, setClassFilter] = useState('Semua Kelas');
  const [majorFilter, setMajorFilter] = useState('Jurusan RPL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newNis, setNewNis] = useState('');
  const [newGender, setNewGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nis.includes(searchQuery);
    return matchesSearch;
  });

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const initials = newNama
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newStudent: Student = {
      id: `s-${Date.now()}`,
      no: students.length + 1,
      nama: newNama,
      nis: newNis,
      kelas: 'XI RPL 2',
      jurusan: 'Rekayasa Perangkat Lunak',
      jenisKelamin: newGender,
      statusAkademik: 'Aktif',
      statusHariIni: 'Tepat Waktu',
      avatarInitials: initials,
      avatarBg: 'bg-indigo-600',
    };

    setStudents([newStudent, ...students]);
    setShowAddModal(false);
    setNewNama('');
    setNewNis('');
    showToast('Data siswa baru berhasil ditambahkan!');
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
        {/* Left Filter Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setClassFilter('Semua Kelas')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              classFilter === 'Semua Kelas'
                ? 'bg-white text-slate-800 border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Semua Kelas
          </button>
          <button
            onClick={() => setMajorFilter('Jurusan RPL')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              majorFilter === 'Jurusan RPL'
                ? 'bg-white text-slate-800 border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Jurusan RPL
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
              placeholder="Cari siswa..."
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            />
          </div>

          <button
            onClick={() => alert('Fitur impor data CSV/Excel')}
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
            <span>+ Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Student Directory Table Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">No</th>
                <th className="pb-3 px-3">Foto</th>
                <th className="pb-3 px-3">Nama Siswa</th>
                <th className="pb-3 px-3">NIS</th>
                <th className="pb-3 px-3">Kelas</th>
                <th className="pb-3 px-3">Jurusan</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {filtered.slice(0, 5).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 text-slate-400 font-semibold">{s.no}</td>
                  <td className="py-3 px-3">
                    <div
                      className={`w-7 h-7 rounded-full ${s.avatarBg || 'bg-slate-600'} text-white flex items-center justify-center font-bold text-[10px]`}
                    >
                      {s.avatarInitials}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">{s.nama}</td>
                  <td className="py-3 px-3 text-slate-500">{s.nis}</td>
                  <td className="py-3 px-3 text-slate-600">{s.kelas}</td>
                  <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{s.jurusan}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={s.statusAkademik} />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => alert(`Detail Siswa: ${s.nama} (NIS: ${s.nis})`)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => alert(`Edit Siswa: ${s.nama}`)}
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

        {/* Pagination Footer matching Page 15 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 mt-4 border-t border-slate-100 text-xs text-slate-500">
          <span>Menampilkan 5 dari 480 siswa</span>

          <div className="flex items-center gap-1.5 self-center">
            <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Sebelumnya
            </button>
            <button
              onClick={() => setCurrentPage(1)}
              className={`w-8 h-8 rounded-lg font-bold ${
                currentPage === 1 ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600'
              }`}
            >
              1
            </button>
            <button
              onClick={() => setCurrentPage(2)}
              className={`w-8 h-8 rounded-lg font-bold ${
                currentPage === 2 ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600'
              }`}
            >
              2
            </button>
            <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Tambah Siswa Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddStudent} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Siswa</label>
                <input
                  type="text"
                  required
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="Contoh: Muhammad Yusuf"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nomor Induk Siswa (NIS)</label>
                <input
                  type="text"
                  required
                  value={newNis}
                  onChange={(e) => setNewNis(e.target.value)}
                  placeholder="Contoh: 20241099"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Jenis Kelamin</label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800"
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
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
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
