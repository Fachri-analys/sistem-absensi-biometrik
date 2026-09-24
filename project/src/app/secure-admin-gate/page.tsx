'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { OFFICIAL_SCHOOL_DOMAIN } from '@/lib/auth-security';

export default function SecureAdminGatePage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin.it@smkn11jkt.sch.id');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail.endsWith(OFFICIAL_SCHOOL_DOMAIN)) {
      setErrorMessage(`Hanya menerima email dengan domain "${OFFICIAL_SCHOOL_DOMAIN}".`);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmedEmail,
          password,
          role: 'admin',
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setErrorMessage(data?.error?.message || data?.message || 'Email atau kata sandi tidak valid.');
        setIsLoading(false);
        return;
      }

      router.push('/admin');
    } catch {
      setErrorMessage('Terjadi gangguan saat memverifikasi keamanan.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8fafc]">
      {/* LEFT COLUMN: School Branding */}
      <div className="lg:w-[48%] bg-gradient-to-br from-[#1864da] via-[#1552b5] to-[#0f3d8a] text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden shrink-0">
        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 relative flex items-center justify-center shrink-0 drop-shadow-[0_4px_14px_rgba(0,0,0,0.3)]">
            <Image
              src="/images/logo-smkn11.webp"
              alt="Logo SMKN 11 Jakarta"
              width={56}
              height={56}
              priority
              className="w-full h-full object-contain filter drop-shadow hover:scale-105 transition-transform"
            />
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-blue-200 uppercase">
              NEGERI 11 JAKARTA
            </div>
            <div className="text-base font-extrabold tracking-tight text-white uppercase leading-tight">
              SMK BISNIS DAN MANAJEMEN
            </div>
            <div className="text-[11px] text-sky-200 font-medium tracking-wide mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse"></span>
              <span>Unggul • Kreatif • Berkarakter</span>
            </div>
          </div>
        </div>

        {/* Center Headline */}
        <div className="my-16 lg:my-0 relative z-10 max-w-lg">
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-extrabold leading-[1.15] text-white tracking-tight mb-6">
            Membuka Gerbang <br />
            Dunia, Mengukir <br />
            Prestasi Mulia
          </h1>
          <p className="text-sm lg:text-base text-blue-100 font-normal leading-relaxed opacity-90 max-w-md">
            Portal Layanan Akademik Terpadu untuk menyokong proses belajar mengajar yang transparan,
            modern, dan berintegritas.
          </p>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-blue-200/80 font-medium">
          <span>Versi Aplikasi 3.4.0</span>
          <span className="text-sky-200/90 font-semibold">Unggul • Kreatif • Berkarakter</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Admin Login Form */}
      <div className="lg:w-[52%] flex flex-col items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Portal Administrasi
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Masuk dengan email resmi sekolah untuk mengakses konsol admin
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden">
            {/* Card Header */}
            <div className="bg-[#12273e] text-white p-5 text-center flex flex-col items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center mb-2 border border-white/20">
                <ShieldCheck className="w-5 h-5 text-blue-300" />
              </div>
              <span className="text-base font-bold tracking-wide">Administrator</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Manajemen Sistem Akademik</span>
            </div>

            {/* Error */}
            {errorMessage && (
              <div className="mx-6 mt-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <span className="font-semibold block">Validasi Gagal:</span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAdminLogin} className="p-7 space-y-5">
              {/* Email */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Resmi Sekolah
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Wajib @smkn11jkt.sch.id
                  </span>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="nama.admin@smkn11jkt.sch.id"
                    className="w-full pl-10 pr-4 py-2.5 text-sm text-slate-800 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Gunakan email resmi institusi dengan domain @smkn11jkt.sch.id
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Masukkan Kata Sandi"
                    className="w-full pl-10 pr-10 py-2.5 text-sm text-slate-800 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#12273e] hover:bg-[#0c1c2e] text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>Masuk sebagai Admin</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Sistem Keamanan Terenkripsi · Akses dibatasi untuk personel IT resmi SMKN 11 Jakarta
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
