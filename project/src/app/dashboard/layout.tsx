import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
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
          <Link href="/login" className="nav-link font-semibold text-blue-600">
            Portal HadirFace →
          </Link>
        </div>
      </nav>
      <main className="container">{children}</main>
    </div>
  );
}
