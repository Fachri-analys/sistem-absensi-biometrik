"use client";

import { useState, useEffect } from "react";

interface AttendanceRecord {
  attendanceId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  status: "ON_TIME" | "LATE";
  matchScore: number;
  recordedAt: string;
}

export default function DashboardPage() {
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [onTimeCount, setOnTimeCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);

  // Ambil log presensi awal hari ini
  useEffect(() => {
    async function fetchInitialLogs() {
      try {
        const res = await fetch("/api/attendance/latest?limit=10");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const formatted: AttendanceRecord[] = data.map((item) => ({
              attendanceId: item.id,
              studentId: item.student.id,
              studentName: item.student.fullName,
              classId: item.student.class.id,
              className: item.student.class.name,
              status: item.status,
              matchScore: Number(item.matchScore),
              recordedAt: item.recordedAt,
            }));
            setLogs(formatted);
            setOnTimeCount(formatted.filter((i) => i.status === "ON_TIME").length);
            setLateCount(formatted.filter((i) => i.status === "LATE").length);
          }
        }
      } catch (err) {
        console.error("Gagal memuat log awal:", err);
      }
    }
    fetchInitialLogs();
  }, []);

  // Hubungkan ke SSE stream realtime
  useEffect(() => {
    const eventSource = new EventSource("/api/realtime/attendance");

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const record: AttendanceRecord = JSON.parse(event.data);
        setLogs((prev) => [record, ...prev.slice(0, 49)]); // simpan 50 data terakhir

        if (record.status === "ON_TIME") {
          setOnTimeCount((prev) => prev + 1);
        } else if (record.status === "LATE") {
          setLateCount((prev) => prev + 1);
        }
      } catch (err) {
        console.error("Gagal parse SSE event:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Dashboard Presensi Realtime</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Pantau kehadiran siswa sekolah secara langsung dengan pembaruan otomatis.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isConnected ? "var(--success)" : "var(--danger)",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" }}>
            {isConnected ? "Live SSE Terhubung" : "Menghubungkan..."}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Total Kehadiran Hari Ini</div>
          <div className="stat-value">{onTimeCount + lateCount}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Hadir Tepat Waktu</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {onTimeCount}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Terlambat</div>
          <div className="stat-value" style={{ color: "var(--warning)" }}>
            {lateCount}
          </div>
        </div>
      </div>

      {/* Live Stream Table */}
      <div className="card">
        <div className="card-title">Aktivitas Presensi Terkini</div>
        <div className="card-subtitle">Log siswa yang baru saja melakukan pemindaian wajah.</div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th>Status</th>
                <th>Skor Kemiripan</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    Belum ada data presensi hari ini.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.attendanceId}>
                    <td style={{ fontWeight: 500 }}>
                      {new Date(log.recordedAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })} WIB
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.studentName}</td>
                    <td>{log.className}</td>
                    <td>
                      <span className={`badge ${log.status === "ON_TIME" ? "badge-on-time" : "badge-late"}`}>
                        {log.status === "ON_TIME" ? "Tepat Waktu" : "Terlambat"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      {(log.matchScore * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
