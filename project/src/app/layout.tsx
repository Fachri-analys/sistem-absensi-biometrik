import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  title: 'HadirFace - Portal Layanan Akademik SMKN 11 Jakarta',
  description: 'Portal Layanan Akademik Terpadu SMKN 11 Jakarta untuk menyokong proses belajar mengajar yang transparan, modern, dan berintegritas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={plusJakartaSans.variable}>
      <body className={`${plusJakartaSans.className} bg-[#f4f6f9] text-[#1e293b] font-sans antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
