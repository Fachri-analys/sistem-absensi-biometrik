'use client';

import React, { useState } from 'react';
import { ChevronDown, Mail, Phone } from 'lucide-react';

export default function SiswaBantuanPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Bagaimana cara melakukan absensi Face ID?',
      a: 'Buka halaman utama aplikasi absensi, posisikan wajah lurus di dalam frame kamera yang tertera pada layar, dan ketuk tombol "Ambil Foto". Sistem AI akan memverifikasi biometric wajah Anda dalam beberapa detik.',
    },
    {
      q: 'Wajah tidak terdeteksi oleh sistem, apa yang harus dilakukan?',
      a: 'Pastikan kamera bersih, posisikan perangkat sejajar dengan mata, dan berada di ruangan dengan pencahayaan yang cukup. Hindari memakai masker, kacamata hitam, atau topi yang menutupi fitur wajah.',
    },
    {
      q: 'Bagaimana jika saya terlambat karena kendala di jalan?',
      a: 'Sistem tetap mencatat waktu kehadiran Anda dengan status Terlambat. Anda dapat menyampaikan kendala kepada wali kelas agar diberikan catatan verifikasi.',
    },
    {
      q: 'Bagaimana cara mengajukan Izin / Sakit?',
      a: 'Silakan lampirkan surat keterangan dokter atau surat izin orang tua/wali melalui WhatsApp wali kelas atau serahkan langsung ke staf tata usaha saat kembali ke sekolah.',
    },
  ];

  const steps = [
    { no: 1, text: 'Posisikan kamera depan setara dengan mata Anda.' },
    { no: 2, text: 'Lepas kacamata hitam, masker atau topi jika menghalangi wajah.' },
    { no: 3, text: 'Pastikan ruangan memiliki pencahayaan yang cukup.' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Pusat Bantuan & FAQ</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Temukan panduan praktis dan jawaban seputar sistem HadirFace
        </p>
      </div>

      {/* Main Grid: FAQ (Left) & Steps/Contact (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accordion FAQ (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Pertanyaan Umum (FAQ)</h3>

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

        {/* Right Column: Quick Steps & Contact Card */}
        <div className="space-y-6">
          {/* Langkah Cepat Absen */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Langkah Cepat Absen</h3>
            <div className="space-y-4">
              {steps.map((s) => (
                <div key={s.no} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                    {s.no}
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Kontak IT Admin (Dark Slate Card matching design) */}
          <div className="bg-[#1e293b] text-white rounded-2xl p-6 shadow-md space-y-4">
            <div>
              <h4 className="text-sm font-bold tracking-tight">Kontak IT Admin</h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Butuh bantuan teknis lebih lanjut mengenai verifikasi sidik wajah atau reset password?
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-700/60 text-xs">
              <a
                href="mailto:it.support@smkn11jkt.sch.id"
                className="flex items-center gap-2.5 text-slate-200 hover:text-sky-300 transition-colors"
              >
                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate">it.support@smkn11jkt.sch.id</span>
              </a>
              <div className="flex items-center gap-2.5 text-slate-200">
                <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                <span>(021) 829-1123 • Gedung C</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
