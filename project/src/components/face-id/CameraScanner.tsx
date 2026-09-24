'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, SwitchCamera } from 'lucide-react';

interface CameraScannerProps {
  onSuccessAttendance?: (time: string) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onSuccessAttendance }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cameraMode, setCameraMode] = useState<'real' | 'simulated'>('simulated');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasWebcam, setHasWebcam] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize camera if user allows
  useEffect(() => {
    let stream: MediaStream | null = null;
    const initCamera = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setHasWebcam(true);
            setCameraMode('real');
          }
        }
      } catch (err) {
        // Fallback gracefully to high-tech simulated camera frame
        setHasWebcam(false);
        setCameraMode('simulated');
      }
    };

    if (cameraMode === 'real') {
      initCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraMode, facingMode]);

  const handleCapture = () => {
    if (isScanning || isSuccess) return;

    setIsScanning(true);
    // Simulate biometric analysis for 1.8 seconds
    setTimeout(() => {
      setIsScanning(false);
      setIsSuccess(true);
      if (onSuccessAttendance) {
        onSuccessAttendance('06:47 WIB');
      }
    }, 1800);
  };

  const toggleCamera = () => {
    // Always switch between front and back camera
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    // If not already using real camera, switch to real mode
    if (cameraMode !== 'real') {
      setCameraMode('real');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Absensi HadirFace</h2>
          <p className="text-xs text-slate-400">Posisikan wajah Anda di dalam frame</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Siap melakukan absensi</span>
        </div>
      </div>

      {/* Camera Viewfinder Box */}
      <div className="relative w-full h-[360px] md:h-[400px] bg-[#eef2f6] rounded-2xl overflow-hidden flex flex-col items-center justify-center border border-slate-200 shadow-inner">
        {/* Real Video element if active */}
        {cameraMode === 'real' && hasWebcam && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Central Face Target Framing Box matching design */}
        <div className="relative z-10 w-56 h-64 md:w-64 md:h-72 rounded-3xl border-2 border-slate-300/80 bg-white/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 shadow-sm">
          {/* Corner Markers */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-slate-400 rounded-tl"></div>
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-slate-400 rounded-tr"></div>
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-slate-400 rounded-bl"></div>
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-slate-400 rounded-br"></div>

          {/* Change Camera Button in upper center */}
          <button
            onClick={toggleCamera}
            className="mb-8 flex flex-col items-center justify-center text-slate-500 hover:text-slate-800 transition-colors group"
            title="Ganti Kamera"
          >
            <SwitchCamera className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-600">
              {facingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}
            </span>
          </button>

          {/* Animated scanning laser when active */}
          {isScanning && (
            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-scanline" />
          )}
        </div>

        {/* Success Overlay */}
        {isSuccess && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3 shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-1">Presensi Terverifikasi!</h3>
            <p className="text-sm text-slate-500 mb-1">
              Wajah teridentifikasi: <span className="font-semibold text-slate-700">Raka Pratama (XI RPL 2)</span>
            </p>
            <p className="text-xs text-emerald-600 font-semibold mb-5">
              11 Sep 2026 • 06:47 WIB • Tepat Waktu
            </p>
            <button
              onClick={() => setIsSuccess(false)}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow transition-all"
            >
              Lakukan Absensi Ulang
            </button>
          </div>
        )}
      </div>

      {/* Shutter Button under camera */}
      <div className="flex flex-col items-center justify-center mt-6">
        <button
          onClick={handleCapture}
          disabled={isScanning || isSuccess}
          className="relative group p-1.5 rounded-full border-4 border-slate-200 hover:border-blue-400 active:scale-95 transition-all shadow-md focus:outline-none"
          title="Ambil Foto"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-b from-slate-100 to-slate-200 group-hover:from-blue-50 group-hover:to-blue-100 flex items-center justify-center border border-slate-300 transition-all">
            <div className="w-10 h-10 rounded-full border-2 border-slate-400/80 group-hover:border-blue-500 group-hover:bg-blue-600/10 transition-all"></div>
          </div>
        </button>
        <span className="text-xs font-semibold text-slate-500 mt-2">
          {isScanning ? 'Memverifikasi wajah...' : 'Ambil Foto'}
        </span>
      </div>
    </div>
  );
};
