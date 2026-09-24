'use client';

import React, { useState } from 'react';
import { Save, CheckCircle2, X } from 'lucide-react';
import { ADMIN_USERS } from '@/data/mockData';

export default function AdminPengaturanPage() {
  const [namaSekolah, setNamaSekolah] = useState('SMKN 11 Jakarta');
  const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
  const [jamMasuk, setJamMasuk] = useState('07:00 WIB');
  const [batasToleransi, setBatasToleransi] = useState('15 Menit');
  const [sensitivitas, setSensitivitas] = useState('Sangat Tinggi (Rekomendasi)');
  const [batasPercobaan, setBatasPercobaan] = useState('3 Kali');
  const [pushNotification, setPushNotification] = useState(true);

  const [admins, setAdmins] = useState(ADMIN_USERS);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('IT Admin');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg('Seluruh pengaturan sistem absensi berhasil disimpan!');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdmins([...admins, { nama: newAdminName, role: newAdminRole, initials: 'AD' }]);
    setShowAddAdminModal(false);
    setNewAdminName('');
    setToastMsg('Admin baru berhasil didaftarkan!');
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

      {/* Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            Pengaturan Sistem Absensi
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Konfigurasi parameter operasional dan otentikasi biometrik
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="flex items-center gap-2 bg-[#1b64da] hover:bg-[#1552b5] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
        >
          <Save className="w-4 h-4" />
          <span>Simpan Pengaturan</span>
        </button>
      </div>

      {/* Main Grid: Form Sections (Left 2 cols) & Admin Management (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Sections */}
        <form onSubmit={handleSaveSettings} className="lg:col-span-2 space-y-6">
          {/* Card 1: Pengaturan Umum */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Pengaturan Umum</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Sekolah</label>
                <input
                  type="text"
                  value={namaSekolah}
                  onChange={(e) => setNamaSekolah(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tahun Ajaran</label>
                <input
                  type="text"
                  value={tahunAjaran}
                  onChange={(e) => setTahunAjaran(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Jam Masuk</label>
                <input
                  type="text"
                  value={jamMasuk}
                  onChange={(e) => setJamMasuk(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Batas Toleransi Terlambat (menit)
                </label>
                <input
                  type="text"
                  value={batasToleransi}
                  onChange={(e) => setBatasToleransi(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Pengaturan HadirFace */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Pengaturan HadirFace</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sensitivitas Deteksi</label>
                <select
                  value={sensitivitas}
                  onChange={(e) => setSensitivitas(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 font-medium cursor-pointer"
                >
                  <option value="Sangat Tinggi (Rekomendasi)">Sangat Tinggi (Rekomendasi)</option>
                  <option value="Tinggi">Tinggi</option>
                  <option value="Sedang">Sedang</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Batas Percobaan Ulang
                </label>
                <select
                  value={batasPercobaan}
                  onChange={(e) => setBatasPercobaan(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 font-medium cursor-pointer"
                >
                  <option value="3 Kali">3 Kali</option>
                  <option value="5 Kali">5 Kali</option>
                  <option value="Tak Terbatas">Tak Terbatas</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 3: Notifikasi & Integrasi */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight mb-4">
              Notifikasi & Integrasi
            </h3>

            <div className="flex items-center justify-between py-2">
              <span className="text-xs font-semibold text-slate-700">
                Laporan Push Notification ke Wali Kelas
              </span>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setPushNotification(!pushNotification)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  pushNotification ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    pushNotification ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </form>

        {/* Right 1 Col: Manajemen Admin Card matching Page 18 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4 h-fit">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Manajemen Admin</h3>
            <button
              onClick={() => setShowAddAdminModal(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              + Tambah
            </button>
          </div>

          {/* List of Admins */}
          <div className="space-y-3">
            {admins.map((adm, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {adm.initials}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">{adm.nama}</div>
                  <div className="text-[11px] text-slate-400 font-medium">{adm.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Tambah Akun Admin</h3>
              <button
                onClick={() => setShowAddAdminModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddAdmin} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Contoh: Rina Kusuma"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role / Jabatan</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800"
                >
                  <option value="IT Admin">IT Admin</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Staff Tata Usaha">Staff Tata Usaha</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                >
                  Simpan Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
