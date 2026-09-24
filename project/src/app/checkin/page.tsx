"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CheckinSuccessData {
  status: "ON_TIME" | "LATE";
  recordedAt: string;
  studentName: string;
}

const CHECKIN_FRAME_COUNT = Math.max(
  1,
  Math.min(10, Number.parseInt(process.env.NEXT_PUBLIC_CHECKIN_FRAME_COUNT ?? "5", 10) || 5)
);
const CHECKIN_FRAME_INTERVAL_MS = Math.max(
  0,
  Math.min(2000, Number.parseInt(process.env.NEXT_PUBLIC_CHECKIN_FRAME_INTERVAL_MS ?? "150", 10) || 0)
);

export default function CheckinPage() {
  const [nisn, setNisn] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedBlobs, setCapturedBlobs] = useState<Blob[]>([]);
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

  // Ambil beberapa frame dari video stream agar recognition tidak bergantung
  // pada satu frame yang mungkin blur/tertutup/berubah pencahayaan.
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const captureOneFrame = () =>
      new Promise<Blob>((resolve, reject) => {
        // Reset transform because the same canvas is reused for every frame.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Flip horizontal agar tidak terbalik (karena cermin selfie).
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Gagal mengambil frame kamera."))),
          "image/jpeg",
          0.9
        );
      });

    setIsCapturing(true);
    setCameraError(null);
    try {
      const frames: Blob[] = [];
      for (let index = 0; index < CHECKIN_FRAME_COUNT; index += 1) {
        frames.push(await captureOneFrame());
        if (index < CHECKIN_FRAME_COUNT - 1 && CHECKIN_FRAME_INTERVAL_MS > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, CHECKIN_FRAME_INTERVAL_MS));
        }
      }
      setCapturedBlobs(frames);
      if (frames[0]) {
        setCapturedPhotoUrl(URL.createObjectURL(frames[0]));
      }
      stopCamera();
    } catch (err) {
      console.error("Camera capture error:", err);
      setCameraError("Gagal mengambil semua frame kamera. Silakan coba lagi.");
    } finally {
      setIsCapturing(false);
    }
  };

  const retakePhoto = () => {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedBlobs([]);
    setResult(null);
    startCamera();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nisn || nisn.trim().length !== 10) {
      alert("Masukkan 10 digit NISN yang valid.");
      return;
    }
    if (capturedBlobs.length !== CHECKIN_FRAME_COUNT) {
      alert(`Silakan ambil ${CHECKIN_FRAME_COUNT} frame wajah terlebih dahulu.`);
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("nisn", nisn.trim());
      capturedBlobs.forEach((blob, index) => {
        formData.append("photo", blob, `checkin-${index + 1}.jpg`);
      });

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
            Posisikan wajah Anda tepat di dalam lingkaran. Sistem akan mengambil {CHECKIN_FRAME_COUNT} frame
            untuk verifikasi yang lebih stabil.
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
                  disabled={!isCameraActive || isLoading || isCapturing}
                >
                  <span>📷</span>
                  <span>{isCapturing ? `Mengambil ${CHECKIN_FRAME_COUNT} frame...` : `Ambil ${CHECKIN_FRAME_COUNT} Frame Wajah`}</span>
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    disabled={isLoading || nisn.length !== 10 || capturedBlobs.length !== CHECKIN_FRAME_COUNT}
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
