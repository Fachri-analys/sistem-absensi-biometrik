import { PrismaClient, RoleCode } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { randomBytes } from "node:crypto";

/**
 * Tanpa seed ini, sistem TIDAK BISA dipakai sama sekali: tidak ada baris di
 * tabel `roles` (RBAC di seluruh route bergantung pada ini), tidak ada user
 * manapun untuk login pertama kali, dan tidak ada `attendance_settings`
 * default (tanpa ini, setiap presensi jatuh ke fallback "tidak ada
 * konfigurasi" di lib/attendance-settings.ts — match threshold dari env,
 * tapi jadwal ON_TIME/LATE tidak masuk akal karena checkInLateAfterMinutes=0).
 *
 * Jalankan dengan: `npm run db:seed` (lihat package.json).
 *
 * Idempotent: aman dijalankan berkali-kali (pakai upsert), tidak akan
 * membuat role/user duplikat kalau seed dijalankan ulang di deployment yang
 * sudah pernah di-seed sebelumnya.
 */

const prisma = new PrismaClient();

const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  SUPER_ADMIN: "Akses penuh seluruh sistem termasuk manajemen user & role.",
  ADMIN: "Mengelola data master, kamera, dan melihat seluruh laporan.",
  OPERATOR: "Mengoperasikan layar pemindai wajah harian.",
  WALI_KELAS: "Melihat data dan rekap kehadiran hanya untuk kelas yang diampu.",
  VIEWER: "Akses baca-saja ke dashboard dan laporan agregat.",
};

async function seedRoles(): Promise<Record<RoleCode, string>> {
  const roleIds: Partial<Record<RoleCode, string>> = {};

  for (const code of Object.values(RoleCode)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { description: ROLE_DESCRIPTIONS[code] },
      create: { code, description: ROLE_DESCRIPTIONS[code] },
    });
    roleIds[code] = role.id;
  }

  return roleIds as Record<RoleCode, string>;
}

async function seedDefaultAttendanceSetting(): Promise<void> {
  // classId: null = default sekolah (lihat docs/04-ERD.md). Upsert manual
  // karena constraint unique untuk "satu baris default" tidak dinyatakan
  // eksplisit di schema (classId nullable tidak punya @unique alami untuk
  // nilai null) — dicek dulu, bukan asal create setiap kali seed dijalankan.
  const existing = await prisma.attendanceSetting.findFirst({ where: { classId: null } });
  if (existing) {
    console.log("  Default attendance setting sudah ada, dilewati.");
    return;
  }

  await prisma.attendanceSetting.create({
    data: {
      classId: null,
      // 07:00 WIB = 420 menit, 07:15 WIB = 435 menit (menit sejak tengah
      // malam WIB — lihat src/lib/school-time.ts dan catatan di schema.prisma
      // kenapa ini integer, bukan kolom TIME).
      checkInStartMinutes: 420,
      checkInLateAfterMinutes: 435,
      matchThreshold: 0.4, // ArcFace raw cosine similarity standard (~0.40)
    },
  });
  console.log("  Default attendance setting dibuat: masuk 07:00 WIB, terlambat setelah 07:15 WIB.");
}

async function seedSuperAdmin(roleIds: Record<RoleCode, string>): Promise<void> {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const existing = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  if (existing) {
    console.log(`  User SUPER_ADMIN (${email}) sudah ada, dilewati.`);
    return;
  }

  const finalEmail = email ?? "admin@sekolah.local";
  // TIDAK PERNAH memakai password default yang sama di setiap instalasi
  // (mis. "admin123") — itu kerentanan nyata (default credential) yang
  // sering jadi celah masuk sistem sungguhan. Kalau admin tidak menyediakan
  // SEED_SUPER_ADMIN_PASSWORD sendiri, generate password acak dan TAMPILKAN
  // SEKALI di console — admin WAJIB menggantinya setelah login pertama.
  const providedPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const password = providedPassword ?? randomBytes(12).toString("base64url");

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email: finalEmail,
      passwordHash,
      fullName: "Super Admin",
      roleId: roleIds.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`  User SUPER_ADMIN dibuat: ${finalEmail}`);
  if (!providedPassword) {
    console.log("  ⚠️  Password sementara (SIMPAN SEKARANG, tidak akan ditampilkan lagi):");
    console.log(`  ⚠️  ${password}`);
    console.log("  ⚠️  Segera login dan ganti password ini. Untuk deployment produksi,");
    console.log("  ⚠️  set SEED_SUPER_ADMIN_EMAIL & SEED_SUPER_ADMIN_PASSWORD sebelum seed.");
  }
}

async function main(): Promise<void> {
  console.log("Seeding roles...");
  const roleIds = await seedRoles();

  console.log("Seeding default attendance setting...");
  await seedDefaultAttendanceSetting();

  console.log("Seeding SUPER_ADMIN awal...");
  await seedSuperAdmin(roleIds);

  console.log("Seed selesai.");
}

main()
  .catch((err) => {
    console.error("Seed gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
