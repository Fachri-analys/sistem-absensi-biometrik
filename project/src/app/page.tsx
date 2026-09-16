import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", textAlign: "center" }}>
      <div className="card" style={{ padding: "2.5rem 1.5rem" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🏫</div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Sistem Presensi Biometrik
        </h1>
        <p className="card-subtitle" style={{ maxWidth: 460, margin: "0 auto 2rem auto" }}>
          Presensi mandiri siswa sekolah berbasis pengenalan wajah 1:1 dan anti-spoofing liveness detection.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 360, margin: "0 auto" }}>
          <Link href="/checkin" className="btn btn-primary btn-full" style={{ padding: "1rem" }}>
            <span>📸</span>
            <span>Mulai Presensi Siswa</span>
          </Link>
          <Link href="/dashboard" className="btn btn-secondary btn-full" style={{ padding: "0.85rem" }}>
            <span>📊</span>
            <span>Buka Live Dashboard</span>
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <div className="card" style={{ padding: "1rem", textAlign: "left" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--primary)" }}>🔒 Privasi Terjamin</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Foto presensi hanya diproses di RAM dan tidak pernah disimpan ke server.
          </div>
        </div>
        <div className="card" style={{ padding: "1rem", textAlign: "left" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--success)" }}>⚡ Verifikasi 1:1 Cepat</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Pencocokan wajah presisi tinggi berbasis NISN dengan kecepatan sub-detik.
          </div>
        </div>
      </div>
    </div>
  );
}
