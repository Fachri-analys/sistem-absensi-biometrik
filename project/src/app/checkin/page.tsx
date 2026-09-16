"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CheckinSuccessData {
  status: "ON_TIME" | "LATE";
  recordedAt: string;
  studentName: string;
}

export default function CheckinPage() {
  const [nisn, setNisn] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    title: string;
    message: string;
    data?: CheckinSuccessData;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Inisialisasi kamera depan
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Gagal mengakses kamera. Pastikan izin kamera telah diberikan di peramban Anda.");
      setIsCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Ambil gambar dari video stream
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontal agar tidak terbalik (karena cermin selfie)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        const url = URL.createObjectURL(blob);
        setCapturedPhotoUrl(url);
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const retakePhoto = () => {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
    setResult(null);
    startCamera();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nisn || nisn.trim().length !== 10) {
      alert("Masukkan 10 digit NISN yang valid.");
      return;
    }
    if (!capturedBlob) {
      alert("Silakan ambil foto wajah terlebih dahulu.");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("nisn", nisn.trim());
      formData.append("photo", capturedBlob, "checkin.jpg");

      const res = await fetch("/api/attendance/checkin", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => null);

      if (res.status === 201) {
        setResult({
          success: true,
          title: "Presensi Berhasil!",
          message: `Selamat datang, ${json.studentName}. Kehadiran Anda telah dicatat.`,
          data: json,
        });
      } else if (res.status === 409) {
        setResult({
          success: false,
          title: "Sudah Tercatat",
          message: json?.error?.message || "Anda sudah tercatat hadir hari ini.",
        });
      } else if (res.status === 422) {
        setResult({
          success: false,
          title: "Verifikasi Gagal",
          message: json?.error?.message || "Wajah tidak cocok, belum terdaftar, atau kualitas foto kurang jelas.",
        });
      } else if (res.status === 429) {
        setResult({
          success: false,
          title: "Batas Percobaan Terlampaui",
          message: "Terlalu banyak percobaan. Harap tunggu beberapa menit sebelum mencoba lagi.",
        });
      } else {
        setResult({
          success: false,
          title: "Gagal Memproses",
          message: json?.error?.message || "Terjadi kendala saat memproses presensi. Silakan coba kembali.",
        });
      }
    } catch (err) {
      console.error("Checkin submit error:", err);
      setResult({
        success: false,
        title: "Koneksi Bermasalah",
        message: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setNisn("");
    retakePhoto();
  };

  return (
    <div style={{ maxWidth: 540, margin: "0 auto" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Screen Hasil Presensi */}
      {result ? (
        <div className="card result-card">
          <div className={`result-icon ${result.success ? "success" : "error"}`}>
            {result.success ? "✓" : "✕"}
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            {result.title}
          </h2>
          <p className="card-subtitle" style={{ fontSize: "1rem" }}>
            {result.message}
          </p>

          {result.data && (
            <div
              style={{
                background: "var(--bg-main)",
                padding: "1rem",
                borderRadius: 8,
                margin: "1rem 0 1.5rem 0",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Nama Siswa:</span>
                <span style={{ fontWeight: 600 }}>{result.data.studentName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Waktu Hadir:</span>
                <span style={{ fontWeight: 600 }}>
                  {new Date(result.data.recordedAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })} WIB
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Status:</span>
                <span className={`badge ${result.data.status === "ON_TIME" ? "badge-on-time" : "badge-late"}`}>
                  {result.data.status === "ON_TIME" ? "Tepat Waktu" : "Terlambat"}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button type="button" onClick={resetAll} className="btn btn-primary">
              Presensi Siswa Lain
            </button>
            {!result.success && (
              <button type="button" onClick={retakePhoto} className="btn btn-secondary">
                Coba Ulang Foto
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Form Presensi Siswa */
        <div className="card">
          <h1 className="card-title">Presensi Wajah Mandiri</h1>
          <p className="card-subtitle">
            Posisikan wajah Anda tepat di dalam lingkaran dan pastikan pencahayaan cukup terang.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="nisn" className="form-label">
                Nomor Induk Siswa Nasional (NISN)
              </label>
              <input
                id="nisn"
                type="text"
                className="form-input"
                placeholder="10 digit NISN (cth: 0051234567)"
                maxLength={10}
                value={nisn}
                onChange={(e) => setNisn(e.target.value.replace(/\D/g, ""))}
                disabled={isLoading}
                required
              />
            </div>

            {/* Jendela Kamera / Foto Terpilih */}
            <div className="camera-container">
              {capturedPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capturedPhotoUrl}
                  alt="Foto Preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-video"
                  />
                  <div className="camera-overlay">
                    <div className="face-guide-oval" />
                    <div className="camera-hint">Posisikan wajah di dalam oval</div>
                  </div>
                </>
              )}
            </div>

            {cameraError && (
              <div
                style={{
                  background: "var(--danger-light)",
                  color: "var(--danger)",
                  padding: "0.75rem",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                {cameraError}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {!capturedPhotoUrl ? (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="btn btn-primary btn-full"
                  disabled={!isCameraActive || isLoading}
                >
                  <span>📷</span>
                  <span>Ambil Foto Wajah</span>
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    disabled={isLoading || nisn.length !== 10}
                  >
                    {isLoading ? "Memverifikasi Wajah..." : "Kirim & Catat Kehadiran"}
                  </button>
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="btn btn-secondary btn-full"
                    disabled={isLoading}
                  >
                    Ambil Ulang Foto
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
