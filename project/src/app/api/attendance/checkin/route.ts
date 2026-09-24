import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { nisnSchema } from "@/lib/validation";
import { checkRateLimit, RateLimitPresets } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit";
import { getFaceRecognitionEngine, FaceServiceError } from "@/lib/face-recognition";
import { getEffectiveAttendanceSetting } from "@/lib/attendance-settings";
import { resolveAttendanceStatus, schoolAttendanceDateValue } from "@/lib/school-time";
import { enqueueAttendanceProcessing } from "@/lib/queues";
import { publishAttendanceEvent } from "@/lib/realtime";
import { invalidateCache } from "@/lib/redis";
import { schoolLocalDateKey } from "@/lib/school-time";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/checkin — alur presensi UTAMA sistem ini.
 *
 * Siswa buka website di HP PRIBADI masing-masing, ketik NISN, kamera HP
 * aktif, foto diambil dan dikirim ke sini. TIDAK ADA autentikasi device
 * (bandingkan dengan POST /api/attendance yang lama — itu untuk kamera/kios
 * TEPERCAYA milik sekolah dengan API key, kasus yang berbeda dan belum tentu
 * dipakai). Endpoint ini PUBLIK secara desain (siapa pun bisa memanggilnya
 * dari browser), sehingga:
 *
 * 1. TIDAK PERNAH mempercayai matchScore/livenessPassed dari klien — nilai
 *    itu 100% dihitung ULANG di server dari foto mentah yang dikirim.
 * 2. Foto mentah yang dikirim TIDAK PERNAH ditulis ke Object Storage sama
 *    sekali (beda dari enrolment, yang sempat menyimpan sementara untuk
 *    diproses async oleh worker) — di sini prosesnya SINKRON dalam satu
 *    request (siswa butuh jawaban instan "hadir"/"gagal"), buffer foto
 *    hanya hidup di memori proses selama request berlangsung, lalu dibuang.
 * 3. Rate limit ganda (per NISN, per IP) menggantikan peran "autentikasi
 *    device" — karena tidak ada password/secret yang bisa dicek di sini.
 *
 * FR-ATTENDANCE-001..004 tetap berlaku sama persis seperti sebelumnya
 * (threshold 90%, dedup, status ON_TIME/LATE, unique constraint DB) —
 * hanya SUMBER kepercayaan matchScore/livenessPassed yang berubah.
 */

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const DEDUP_WINDOW_MINUTES = 5;

export const POST = withErrorHandling(async (req: Request) => {
  const ip = getClientIp(req) ?? "unknown";

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    throw Errors.validation({ body: ["multipart/form-data diperlukan."] });
  }

  const nisnRaw = formData.get("nisn");
  const photo = formData.get("photo");

  const nisnResult = nisnSchema.safeParse(nisnRaw);
  if (!nisnResult.success) {
    throw Errors.validation({ nisn: nisnResult.error.flatten().formErrors });
  }
  const nisn = nisnResult.data;

  // Rate limit SEBELUM query DB apa pun — mencegah spam membebani database,
  // sama seperti prinsip di POST /api/auth/login.
  const [nisnLimit, ipLimit] = RateLimitPresets.checkinPerNisnAndIp(nisn, ip);
  await checkRateLimit(nisnLimit.key, nisnLimit.limit, nisnLimit.windowSeconds);
  await checkRateLimit(ipLimit.key, ipLimit.limit, ipLimit.windowSeconds);

  if (!photo || !(photo instanceof File)) {
    throw Errors.validation({ photo: ["File foto (field 'photo') wajib diunggah."] });
  }
  if (!ALLOWED_MIME_TYPES.has(photo.type)) {
    throw Errors.validation({ photo: ["Tipe file harus JPEG atau PNG."] });
  }
  if (photo.size > MAX_FILE_SIZE_BYTES) {
    throw Errors.validation({ photo: ["Ukuran file maksimum 5MB."] });
  }

  // Pesan error SENGAJA generik untuk NISN tidak ditemukan / siswa belum
  // enrolment / wajah tidak cocok — TIDAK membedakan ketiganya ke klien,
  // supaya endpoint ini tidak bisa dipakai mengecek "NISN mana saja yang
  // valid" (anti-enumeration), meski NISN sendiri semi-publik di lingkungan
  // sekolah. Detail sebenarnya tetap dicatat di server log untuk debugging.
  const genericFailure = () =>
    Errors.unprocessable("Presensi gagal — NISN tidak ditemukan, belum terdaftar wajahnya, atau wajah tidak cocok.");

  const student = await prisma.student.findUnique({
    where: { nisn, deletedAt: null, isActive: true },
    select: {
      id: true,
      fullName: true,
      classId: true,
      class: { select: { name: true } },
      biometricProfile: {
        select: { embeddingRef: true, isActive: true },
      },
    },
  });

  if (!student || !student.biometricProfile?.isActive) {
    throw genericFailure();
  }

  const photoBuffer = Buffer.from(await photo.arrayBuffer());
  const engine = getFaceRecognitionEngine();

  let similarity: number;
  let livenessPassed: boolean;

  try {
    // 1) Face detection + quality check. Endpoint quality menjalankan
    // deteksi tepat satu wajah, resolusi, dan blur check.
    const quality = await engine.validatePhotoQuality(photoBuffer);
    if (!quality.isValid) {
      throw genericFailure();
    }

    // 2) Face recognition (generate embedding + 1:1 comparison).
    const liveEmbedding = await engine.generateEmbedding(photoBuffer);
    similarity = await engine.compareEmbeddings(
      liveEmbedding.embeddingRef,
      student.biometricProfile.embeddingRef
    );

    const setting = await getEffectiveAttendanceSetting(student.classId);

    if (similarity < setting.matchThreshold) {
      throw genericFailure();
    }

    // 3) Liveness verification adalah tahap terpisah setelah recognition.
    // Hasil dihitung server dari frame mentah, bukan dari client.
    const liveness = await engine.checkLiveness(photoBuffer);
    if (!liveness.passed) {
      throw genericFailure();
    }
    livenessPassed = liveness.passed;
  } catch (err) {
    if (err instanceof FaceServiceError) {
      // Jika face-service menolak dengan 422 (wajah tidak terdeteksi / multiple faces)
      // atau 400 (gambar rusak), kembalikan genericFailure (HTTP 422) anti-enumeration,
      // BUKAN error 500 internal server error.
      if (err.statusCode === 422 || err.statusCode === 400) {
        throw genericFailure();
      }
    }
    throw err;
  }

  // --- Dari titik ini, identik dengan logic di POST /api/attendance lama:
  // dedup window, attendanceDate (WIB), status ON_TIME/LATE, unique
  // constraint + P2002 handling untuk race condition (TC-ATT-003). ---

  const recordedAt = new Date();
  const dedupWindowStart = new Date(recordedAt.getTime() - DEDUP_WINDOW_MINUTES * 60 * 1000);
  const attendanceDate = schoolAttendanceDateValue(recordedAt);

  const recentDuplicate = await prisma.attendance.findFirst({
    where: {
      studentId: student.id,
      recordedAt: { gte: dedupWindowStart, lte: recordedAt },
    },
    select: { id: true, recordedAt: true },
    orderBy: { recordedAt: "desc" },
  });
  if (recentDuplicate) {
    throw Errors.conflict(
      `Sudah tercatat hadir pada ${recentDuplicate.recordedAt.toISOString()} (dalam jendela ${DEDUP_WINDOW_MINUTES} menit).`
    );
  }

  const setting = await getEffectiveAttendanceSetting(student.classId);
  const status = resolveAttendanceStatus(recordedAt, setting);
  const idempotencyKey = `checkin-${student.id}-${recordedAt.getTime()}-${nanoid(8)}`;

  let attendance: { id: string; status: string; matchScore: Prisma.Decimal; recordedAt: Date };
  try {
    attendance = await prisma.attendance.create({
      data: {
        studentId: student.id,
        cameraId: null,
        channel: "STUDENT_PHONE",
        matchScore: similarity,
        livenessPassed: livenessPassed,
        status,
        recordedAt,
        attendanceDate,
        idempotencyKey,
      },
      select: { id: true, status: true, matchScore: true, recordedAt: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existingToday = await prisma.attendance.findFirst({
        where: { studentId: student.id, attendanceDate },
        select: { id: true, status: true, matchScore: true, recordedAt: true },
      });
      if (existingToday) {
        throw Errors.conflict(
          `Sudah tercatat hadir hari ini pada ${existingToday.recordedAt.toISOString()}.`
        );
      }
    }
    throw err;
  }

  await invalidateCache(
    `attendance:latest:5`,
    `dashboard:stats:${schoolLocalDateKey(recordedAt)}:all`
  );
  await enqueueAttendanceProcessing({
    attendanceId: attendance.id,
    studentId: student.id,
    cameraId: null,
    recordedAt: recordedAt.toISOString(),
  });
  await publishAttendanceEvent({
    attendanceId: attendance.id,
    studentId: student.id,
    studentName: student.fullName,
    classId: student.classId,
    className: student.class.name,
    cameraId: null,
    status: attendance.status as "ON_TIME" | "LATE",
    matchScore: Number(attendance.matchScore),
    recordedAt: recordedAt.toISOString(),
  });

  // photoBuffer tidak pernah di-upload/disimpan di mana pun — biarkan
  // di-garbage-collect begitu function ini selesai (tidak ada langkah
  // eksplisit "hapus" karena memang tidak pernah ada langkah "simpan").
  return NextResponse.json(
    {
      status: attendance.status,
      recordedAt: attendance.recordedAt,
      studentName: student.fullName,
    },
    { status: 201 }
  );
});
