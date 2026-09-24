import React from 'react';
import { TopHeader } from '@/components/layout/TopHeader';
import { GuruSidebar } from '@/components/layout/GuruSidebar';

export default function GuruLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9]">
      <TopHeader role="guru" userName="Bu Ratna" searchPlaceholder="Cari siswa, kelas, atau riwayat..." />
      <div className="flex flex-1">
        <GuruSidebar />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
