import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistem Absensi Biometrik",
  description: "Presensi Mandiri Siswa Berbasis Biometrik Wajah 1:1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <nav className="navbar">
          <Link href="/" className="nav-brand">
            <span>📷</span>
            <span>Absensi Wajah</span>
          </Link>
          <div className="nav-links">
            <Link href="/checkin" className="nav-link">
              Presensi Siswa
            </Link>
            <Link href="/dashboard" className="nav-link">
              Dashboard
            </Link>
          </div>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
