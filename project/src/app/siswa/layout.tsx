import React from 'react';
import { TopHeader } from '@/components/layout/TopHeader';
import { SiswaSidebar } from '@/components/layout/SiswaSidebar';

export default function SiswaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9]">
      <TopHeader role="siswa" userName="Raka" searchPlaceholder="Cari informasi absensi..." />
      <div className="flex flex-1">
        <SiswaSidebar />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
