import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, Errors } from "@/lib/api-errors";
import { requireAuth, requireCameraAuth } from "@/lib/require-auth";
import {
  parseOrThrow,
  attendanceListQuerySchema,
  createAttendanceSchema,
} from "@/lib/validation";
import { paginate, resolveClassScopeOrThrow } from "@/lib/scope";
import { hashCameraApiKey } from "@/lib/camera-key";
import { getEffectiveAttendanceSetting, resolveAttendanceStatus } from "@/lib/attendance-settings";
import { enqueueAttendanceProcessing } from "@/lib/queues";
import { publishAttendanceEvent } from "@/lib/realtime";
import { invalidateCache } from "@/lib/redis";
import { schoolAttendanceDateValue, schoolLocalDateKey } from "@/lib/school-time";

// Jendela deduplikasi presensi (FR-ATTENDANCE-003). Nilai default 5 menit,
// bisa dipindah ke attendance_settings di iterasi berikutnya jika kebijakan
// sekolah butuh per-kelas — untuk sekarang cukup satu konstanta global karena
// belum ada kebutuhan eksplisit untuk override per kelas pada requirement ini.
const DEDUP_WINDOW_MINUTES = 5;

/**
 * GET /api/attendance (FR-ATTENDANCE tabel log dengan filter)
 * Satu query dengan include terarah (student+class, camera) — bukan N+1
 * per baris attendance. findMany+count paralel via paginate().
 */
export const GET = withErrorHandling(async (req: Request) => {
  const session = await requireAuth(req, [
    "ADMIN",
    "OPERATOR",
    "WALI_KELAS",
    "VIEWER",
    "SUPER_ADMIN",
  ]);

  const url = new URL(req.url);
  const query = parseOrThrow(attendanceListQuerySchema, Object.fromEntries(url.searchParams));
  const effectiveClassId = await resolveClassScopeOrThrow(session, query.classId);

  const where: Prisma.AttendanceWhereInput = {
    ...(effectiveClassId ? { student: { classId: effectiveClassId } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          recordedAt: {
            ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          student: {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" } },
              { nisn: { contains: query.search } },
            ],
          },
        }
      : {}),
  };

  const result = await paginate({ page: query.page, pageSize: query.pageSize }, ({ skip, take }) => ({
    findMany: prisma.attendance.findMany({
      where,
      skip,
      take,
      orderBy: { recordedAt: "desc" },
      select: {
        id: true,
        matchScore: true,
        livenessPassed: true,
        status: true,
        recordedAt: true,
        student: {
          select: {
            id: true,
            nisn: true,
            fullName: true,
            class: { select: { id: true, name: true, major: { select: { name: true } } } },
          },
        },
        camera: { select: { id: true, name: true, location: true } },
      },
    }),
    count: prisma.attendance.count({ where }),
  }));

  return NextResponse.json(result);
});

/**
 * POST /api/attendance (FR-ATTENDANCE-001..004)
 *
 * Urutan validasi SENGAJA disusun begini (murah → mahal, dan aman → efek
 * samping) supaya request tidak valid gagal secepat mungkin tanpa membebani
 * DB lebih dari perlu:
 *
 * 1. Autentikasi kamera (X-Camera-Key) — tanpa ini, tolak sebelum apa pun.
 * 2. Rate limit per kamera.
 * 3. Validasi schema body.
 * 4. Cek idempotency key — kalau sudah pernah diproses, kembalikan hasil
 *    yang SAMA (bukan bikin lagi), request retry dari kamera aman diulang.
 * 5. Ambil siswa + effective threshold kelasnya (satu query siswa dengan
 *    classId, lalu satu query setting — tidak bisa digabung karena setting
 *    baru diketahui classId-nya setelah siswa ditemukan).
 * 6. Validasi threshold & liveness — DITOLAK di sini tidak masuk tabel
 *    attendance sama sekali (bukan disimpan lalu ditandai tidak valid).
 * 7. Cek duplikasi dalam jendela waktu (FR-ATTENDANCE-003).
 * 8. Simpan attendance (source of truth) — baru SETELAH ini berhasil,
 *    baru enqueue job turunan & publish realtime (non-blocking, best-effort).
 */
export const POST = withErrorHandling(async (req: Request) => {
  const cameraId = await requireCameraAuth(req, async (apiKey) => {
    const hash = hashCameraApiKey(apiKey);
    const camera = await prisma.camera.findUnique({
      where: { apiKeyHash: hash, deletedAt: null },
      select: { id: true },
    });
    // Tidak ada kolom "isActive" terpisah di model Camera — status
    // ONLINE/OFFLINE adalah status konektivitas, bukan aktif/nonaktif akun.
    // deletedAt: null (sudah difilter di query) sudah cukup sebagai syarat
    // "kamera terdaftar dan boleh dipakai".
    return camera ? { id: camera.id, isActive: true } : null;
  });

  const body = parseOrThrow(createAttendanceSchema, await req.json().catch(() => ({})));

  // Idempotency: retry jaringan dari kamera dengan idempotencyKey yang sama
  // TIDAK BOLEH membuat record kedua. Constraint unique di schema adalah
  // pengaman terakhir; pengecekan eksplisit di sini memberi respons yang
  // benar (200 dengan data existing) alih-alih error 409 membingungkan
  // untuk kasus retry yang sebetulnya sukses.
  const existingByIdempotency = await prisma.attendance.findUnique({
    where: { idempotencyKey: body.idempotencyKey },
    select: { id: true, status: true, recordedAt: true, studentId: true },
  });
  if (existingByIdempotency) {
    return NextResponse.json(
      { ...existingByIdempotency, deduped: true },
      { status: 200 }
    );
  }

  const student = await prisma.student.findUnique({
    where: { id: body.studentId, deletedAt: null, isActive: true },
    select: { id: true, fullName: true, classId: true, class: { select: { name: true } } },
  });
  if (!student) {
    throw Errors.validation({ studentId: ["Siswa tidak ditemukan atau tidak aktif."] });
  }

  const setting = await getEffectiveAttendanceSetting(student.classId);

  if (!body.livenessPassed) {
    throw Errors.unprocessable("Liveness check tidak lolos — kemungkinan spoof.");
  }
  if (body.matchScore < setting.matchThreshold) {
    throw Errors.unprocessable(
      `Skor kecocokan (${body.matchScore}) di bawah ambang minimum (${setting.matchThreshold}).`
    );
  }

  const recordedAt = new Date(body.recordedAt);
  const dedupWindowStart = new Date(recordedAt.getTime() - DEDUP_WINDOW_MINUTES * 60 * 1000);
  // Tanggal sekolah (WIB, tanpa jam) — BUKAN tanggal kalender UTC. Lihat
  // src/lib/school-time.ts untuk penjelasan lengkap kenapa ini penting:
  // jam masuk sekolah (~06:30-07:00 WIB) berada sebelum titik pergantian
  // hari UTC (07:00 WIB), jadi memakai tanggal UTC akan salah menghitung
  // presensi pagi sebagai "kemarin". Dipakai sebagai bagian unique
  // constraint @@unique([studentId, attendanceDate]) di schema.prisma.
  const attendanceDate = schoolAttendanceDateValue(recordedAt);

  // Pengecekan ini adalah UX-level check (memberi pesan error yang jelas
  // secepat mungkin) — BUKAN satu-satunya pertahanan terhadap duplikasi.
  // Di bawah concurrency tinggi (banyak siswa scan bersamaan, lihat
  // docs/10-TEST-PLAN.md TC-ATT-003), dua request untuk siswa yang sama bisa
  // lolos SELECT ini bersamaan sebelum salah satunya sempat INSERT — race
  // klasik "check-then-act". Pertahanan yang SEBENARNYA race-proof ada di
  // constraint database @@unique([studentId, attendanceDate]) (lihat
  // schema.prisma) yang ditegakkan PostgreSQL sendiri, ditangani lewat
  // catch P2002 di bawah — SELECT di sini murni untuk pesan error yang lebih
  // spesifik (menyebutkan jam presensi sebelumnya) pada jalur non-race biasa.
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
      `Siswa ini sudah tercatat hadir pada ${recentDuplicate.recordedAt.toISOString()} (dalam jendela ${DEDUP_WINDOW_MINUTES} menit).`
    );
  }

  const status = resolveAttendanceStatus(recordedAt, setting);

  let attendance: { id: string; status: string; matchScore: Prisma.Decimal; recordedAt: Date };
  try {
    attendance = await prisma.attendance.create({
      data: {
        studentId: student.id,
        cameraId,
        matchScore: body.matchScore,
        livenessPassed: body.livenessPassed,
        status,
        recordedAt,
        attendanceDate,
        idempotencyKey: body.idempotencyKey,
      },
      select: { id: true, status: true, matchScore: true, recordedAt: true },
    });
  } catch (err) {
    // P2002 = unique constraint violation. Ini KEADAAN NORMAL yang harus
    // ditangani dengan baik, bukan error tak terduga — terjadi saat dua
    // request untuk siswa yang sama lolos pengecekan di atas bersamaan
    // (race condition) dan sama-sama mencoba INSERT. PostgreSQL menolak
    // yang kedua; kita tangkap di sini dan kembalikan record yang BENAR-BENAR
    // tersimpan (dari request yang menang race), bukan melempar 500 generik
    // ke kamera untuk kondisi yang sebetulnya bisa ditangani dengan baik.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined) ?? [];

      if (target.includes("idempotency_key")) {
        const existing = await prisma.attendance.findUnique({
          where: { idempotencyKey: body.idempotencyKey },
          select: { id: true, status: true, matchScore: true, recordedAt: true },
        });
        if (existing) {
          return NextResponse.json({ ...existing, deduped: true }, { status: 200 });
        }
      }

      // Constraint (studentId, attendanceDate) — siswa ini sudah punya
      // presensi valid hari ini dari request lain yang menang race.
      const existingToday = await prisma.attendance.findFirst({
        where: { studentId: student.id, attendanceDate },
        select: { id: true, status: true, matchScore: true, recordedAt: true },
      });
      if (existingToday) {
        throw Errors.conflict(
          `Siswa ini sudah tercatat hadir hari ini pada ${existingToday.recordedAt.toISOString()}.`
        );
      }
    }

    // Bukan P2002 yang kita kenali, atau data existing yang diharapkan tidak
    // ditemukan (kondisi tak terduga) — lempar ulang untuk ditangani sebagai
    // 500 oleh withErrorHandling, jangan diam-diam ditelan.
    throw err;
  }

  // Efek samping non-blocking — kegagalan di sini TIDAK membatalkan response
  // 201 karena data inti sudah aman tersimpan di PostgreSQL.
  await invalidateCache(
    `attendance:latest:5`,
    `dashboard:stats:${schoolLocalDateKey(recordedAt)}:all`
  );
  await enqueueAttendanceProcessing({
    attendanceId: attendance.id,
    studentId: student.id,
    cameraId,
    recordedAt: recordedAt.toISOString(),
  });
  await publishAttendanceEvent({
    attendanceId: attendance.id,
    studentId: student.id,
    studentName: student.fullName,
    classId: student.classId,
    className: student.class.name,
    cameraId,
    status: attendance.status as "ON_TIME" | "LATE",
    matchScore: Number(attendance.matchScore),
    recordedAt: recordedAt.toISOString(),
  });

  return NextResponse.json(attendance, { status: 201 });
});
