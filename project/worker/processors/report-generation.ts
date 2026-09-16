import type { Job } from "bullmq";
import PDFDocument from "pdfkit";
import { prisma } from "../../src/lib/prisma";
import { logger } from "../../src/lib/logger";
import { uploadObject, Buckets } from "../../src/lib/object-storage";

/**
 * docs/09-QUEUE-WORKER-SPEC.md — queue `report-generation`.
 * FR-REPORT-001.
 *
 * ANTI N+1: seluruh baris attendance untuk rentang tanggal/kelas diambil
 * dalam SATU query dengan include terarah (student+class), TIDAK di-loop
 * per hari atau per siswa dengan query terpisah. Untuk rentang data yang
 * sangat besar di masa depan, pertimbangkan cursor-based pagination di sini
 * — untuk skala sekolah (ratusan-ribuan baris per bulan) satu query masih
 * wajar dan jauh lebih sederhana untuk dijaga benar.
 *
 * IDEMPOTENCY: job memakai jobId = reportId (lihat route export). Jika
 * diproses ulang, PDF baru menimpa object key yang SAMA (bukan membuat file
 * baru) — konsisten dengan docs/09-QUEUE-WORKER-SPEC.md: "job yang diproses
 * ulang menimpa hasil sebelumnya, bukan membuat file duplikat."
 */

export interface ReportGenerationJobData {
  reportId: string;
  requestedBy: string;
  type: "ATTENDANCE_EXPORT";
  filterParams: {
    classId?: string;
    dateFrom: string;
    dateTo: string;
  };
}

const REPORT_EXPIRY_HOURS = 24;

export async function processReportGenerationJob(
  job: Job<ReportGenerationJobData>
): Promise<void> {
  const { reportId, filterParams } = job.data;
  const log = logger.child({ jobId: job.id, queue: "report-generation", reportId });

  try {
    await prisma.report.update({ where: { id: reportId }, data: { status: "PROCESSING" } });

    const rows = await prisma.attendance.findMany({
      where: {
        recordedAt: {
          gte: new Date(filterParams.dateFrom),
          lte: new Date(filterParams.dateTo),
        },
        ...(filterParams.classId ? { student: { classId: filterParams.classId } } : {}),
      },
      orderBy: { recordedAt: "asc" },
      select: {
        recordedAt: true,
        status: true,
        matchScore: true,
        student: {
          select: {
            nisn: true,
            fullName: true,
            class: { select: { name: true, major: { select: { name: true } } } },
          },
        },
      },
    });

    const pdfBuffer = await renderAttendancePdf(rows, filterParams);

    const objectKey = `reports/${reportId}.pdf`;
    await uploadObject(Buckets.reports, objectKey, pdfBuffer, "application/pdf");

    const expiresAt = new Date(Date.now() + REPORT_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.report.update({
      where: { id: reportId },
      data: { status: "DONE", objectKey, expiresAt },
    });

    log.info({ msg: "report_generated", rowCount: rows.length, objectKey });
  } catch (err) {
    log.error({ msg: "report_generation_failed", error: err });
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "FAILED" },
    });
    throw err; // biarkan BullMQ mencatat kegagalan untuk retry/alert
  }
}

type AttendanceRow = {
  recordedAt: Date;
  status: string;
  matchScore: unknown;
  student: {
    nisn: string;
    fullName: string;
    class: { name: string; major: { name: string } };
  };
};

function renderAttendancePdf(
  rows: AttendanceRow[],
  filter: { dateFrom: string; dateTo: string }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text("Laporan Kehadiran Siswa", { align: "center" });
    doc
      .fontSize(10)
      .text(`Periode: ${filter.dateFrom} s/d ${filter.dateTo}`, { align: "center" });
    doc.moveDown(1);

    // Satu sumber kebenaran untuk kolom (label + lebar) — sengaja BUKAN dua
    // array paralel (headers[] dan colWidths[] terpisah). Dua array paralel
    // gampang tidak sinkron kalau salah satunya diubah tanpa yang lain (mis.
    // nambah 1 kolom baru tapi lupa nambah lebarnya), dan di bawah
    // `noUncheckedIndexedAccess` (tsconfig kita) itu juga bikin TypeScript
    // benar menandai akses index sebagai "mungkin undefined". Struktur
    // berpasangan begini menghilangkan kelas bug itu sepenuhnya, bukan cuma
    // meredam pesan errornya.
    const columns: Array<{ label: string; width: number }> = [
      { label: "Waktu", width: 90 },
      { label: "Nama", width: 130 },
      { label: "NISN", width: 90 },
      { label: "Kelas", width: 110 },
      { label: "Status", width: 60 },
      { label: "Skor", width: 60 },
    ];

    doc.fontSize(9).font("Helvetica-Bold");
    const headerY = doc.y;
    let x = doc.page.margins.left;
    for (const column of columns) {
      doc.text(column.label, x, headerY, { width: column.width });
      x += column.width;
    }
    doc.y = headerY + 14;
    doc.font("Helvetica");

    for (const row of rows) {
      // Cek pergantian halaman manual — pdfkit tidak otomatis membuat tabel
      // multi-halaman, jadi kita tangani sendiri untuk data besar.
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }
      const rowY = doc.y;
      let cx = doc.page.margins.left;
      const cellValues = [
        row.recordedAt.toISOString().replace("T", " ").slice(0, 16),
        row.student.fullName,
        row.student.nisn,
        row.student.class.name,
        row.status,
        String(row.matchScore),
      ];

      // Panjang cellValues HARUS selalu sama dengan columns — dijaga oleh
      // struktur di atas (bukan cuma diasumsikan). Kalau suatu saat salah
      // satu berubah tanpa yang lain, ini akan melempar error jelas saat
      // development, bukan diam-diam merender kolom kosong di production.
      if (cellValues.length !== columns.length) {
        throw new Error(
          `Jumlah kolom (${columns.length}) tidak cocok dengan jumlah nilai sel (${cellValues.length}).`
        );
      }

      for (let i = 0; i < columns.length; i++) {
        const column = columns[i]!; // aman: panjang sudah diverifikasi identik di atas
        const value = cellValues[i]!;
        doc.text(value, cx, rowY, { width: column.width });
        cx += column.width;
      }

      // Kunci posisi Y baris berikutnya secara eksplisit — jangan andalkan
      // doc.y otomatis, karena setiap doc.text() dengan x/y eksplisit di
      // kolom yang sama bisa menggeser cursor secara tidak konsisten kalau
      // salah satu sel wrap ke baris baru.
      doc.y = rowY + 14;
    }

    if (rows.length === 0) {
      doc.text("Tidak ada data kehadiran pada periode/filter yang dipilih.");
    }

    doc.end();
  });
}
