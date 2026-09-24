'use client';

import React, { useState } from 'react';
import { ChevronDown, Mail, PhoneCall } from 'lucide-react';

export default function GuruBantuanPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Bagaimana cara melakukan absensi manual?',
      a: "Pilih menu 'Absensi Manual', centang nama siswa yang bersangkutan, lalu pilih status (Hadir/Sakit/Izin/Alpa) dan klik tombol 'Simpan Absensi' di kanan atas.",
    },
    {
      q: 'Bagaimana melihat laporan rekap kehadiran kelas bulanan?',
      a: "Masuk ke menu 'Riwayat', gunakan filter bulan di bagian atas, lalu klik tombol 'Export Excel' atau 'Cetak PDF' untuk mengunduh rekap otomatis.",
    },
    {
      q: 'Siswa tidak terdeteksi Face ID, apa solusi pertama?',
      a: 'Pastikan kamera bersih, siswa menghadap lurus ke layar, dan tidak memakai aksesoris penutup wajah berlebih. Jika kendala berlanjut, input absensi manual.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Grid matching Page 13 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accordion FAQ (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            FAQ & Kendala Umum Wali Kelas
          </h3>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <span className="text-xs font-bold text-slate-800">{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-500 leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Kontak IT Admin Sekolah */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4 h-fit">
          <div>
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">Kontak IT Admin Sekolah</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Hubungi IT Admin jika terjadi error HadirFace di ruang kelas atau ketidaksinkronan data siswa baru.
            </p>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2.5 text-slate-700">
              <PhoneCall className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-semibold">Ext. 104 (Lantai 2 Admin)</span>
            </div>
            <a
              href="mailto:admin.it@smkn11jkt.sch.id"
              className="flex items-center gap-2.5 text-blue-600 hover:underline"
            >
              <Mail className="w-4 h-4 text-blue-600 shrink-0" />
              <span>admin.it@smkn11jkt.sch.id</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
