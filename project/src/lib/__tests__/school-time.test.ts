import { describe, it, expect } from "vitest";
import {
  minutesSinceMidnightSchoolTime,
  schoolLocalDateKey,
  getSchoolDayRangeUtc,
  schoolAttendanceDateValue,
  SCHOOL_TIMEZONE_OFFSET_MINUTES,
} from "../school-time";

/**
 * Test-test ini SENGAJA fokus pada kasus tepi jam 00:00-07:00 WIB — ini
 * persis jendela waktu di mana bug lama (batas hari pakai UTC) menghasilkan
 * jawaban salah. Kalau ada yang mengubah school-time.ts di masa depan dan
 * tidak sengaja mengembalikan logic ke UTC naive, test ini harus GAGAL.
 */

describe("school-time: minutesSinceMidnightSchoolTime", () => {
  it("06:30 WIB (23:30 UTC hari sebelumnya) dihitung sebagai 06:30, bukan 23:30", () => {
    // 06:30 WIB = 23:30 UTC hari sebelumnya (WIB = UTC+7)
    const instant = new Date("2026-09-11T23:30:00.000Z");
    const minutes = minutesSinceMidnightSchoolTime(instant);
    expect(minutes).toBe(6 * 60 + 30); // 390
  });

  it("07:00 WIB tepat di titik pergantian hari UTC (00:00 UTC) dihitung benar", () => {
    const instant = new Date("2026-09-12T00:00:00.000Z"); // = 07:00 WIB
    expect(minutesSinceMidnightSchoolTime(instant)).toBe(7 * 60);
  });

  it("23:59 WIB (16:59 UTC) dihitung benar, bukan overflow ke hari berikutnya", () => {
    const instant = new Date("2026-09-11T16:59:00.000Z"); // = 23:59 WIB
    expect(minutesSinceMidnightSchoolTime(instant)).toBe(23 * 60 + 59);
  });

  it("konstanta offset WIB adalah +7 jam", () => {
    expect(SCHOOL_TIMEZONE_OFFSET_MINUTES).toBe(7 * 60);
  });
});

describe("school-time: schoolLocalDateKey (BUG UTAMA yang diperbaiki)", () => {
  it("06:30 WIB tanggal 12 Sept masih dianggap tanggal 12, meski UTC-nya masih tanggal 11", () => {
    // Ini PERSIS skenario bug: 06:30 WIB tgl 12 = 23:30 UTC tgl 11.
    // Implementasi lama (`date.toISOString().slice(0,10)` di UTC) akan
    // salah mengembalikan "2026-09-11".
    const instant = new Date("2026-09-11T23:30:00.000Z");
    expect(schoolLocalDateKey(instant)).toBe("2026-09-12");
  });

  it("23:00 WIB tanggal 12 (masih siang hari UTC) tetap tanggal 12", () => {
    const instant = new Date("2026-09-12T16:00:00.000Z"); // 23:00 WIB tgl 12
    expect(schoolLocalDateKey(instant)).toBe("2026-09-12");
  });
});

describe("school-time: getSchoolDayRangeUtc", () => {
  it("presensi jam 06:45 WIB masuk ke rentang hari yang benar (bukan hari sebelumnya)", () => {
    const scanTime = new Date("2026-09-11T23:45:00.000Z"); // 06:45 WIB, 12 Sept
    const { start, end } = getSchoolDayRangeUtc(scanTime);

    expect(scanTime.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(scanTime.getTime()).toBeLessThan(end.getTime());

    // Rentang harus tepat 24 jam.
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);

    // Titik mulai rentang harus jatuh di 17:00 UTC hari sebelumnya
    // (= 00:00 WIB tanggal 12).
    expect(start.toISOString()).toBe("2026-09-11T17:00:00.000Z");
  });

  it("dua kejadian di hari sekolah yang sama (06:00 dan 23:00 WIB) masuk rentang yang sama", () => {
    const morning = new Date("2026-09-11T23:00:00.000Z"); // 06:00 WIB, 12 Sept
    const night = new Date("2026-09-12T16:00:00.000Z"); // 23:00 WIB, 12 Sept

    const rangeMorning = getSchoolDayRangeUtc(morning);
    const rangeNight = getSchoolDayRangeUtc(night);

    expect(rangeMorning.start.getTime()).toBe(rangeNight.start.getTime());
    expect(rangeMorning.end.getTime()).toBe(rangeNight.end.getTime());
  });

  it("kejadian tepat sebelum tengah malam WIB dan tepat sesudahnya masuk rentang BERBEDA", () => {
    const beforeMidnight = new Date("2026-09-11T16:59:59.000Z"); // 23:59:59 WIB, 11 Sept
    const afterMidnight = new Date("2026-09-11T17:00:01.000Z"); // 00:00:01 WIB, 12 Sept

    const rangeBefore = getSchoolDayRangeUtc(beforeMidnight);
    const rangeAfter = getSchoolDayRangeUtc(afterMidnight);

    expect(rangeBefore.start.getTime()).not.toBe(rangeAfter.start.getTime());
  });
});

describe("school-time: schoolAttendanceDateValue", () => {
  it("konsisten dengan getSchoolDayRangeUtc().start untuk instant yang sama", () => {
    const instant = new Date("2026-09-11T23:30:00.000Z");
    const attendanceDate = schoolAttendanceDateValue(instant);
    const range = getSchoolDayRangeUtc(instant);
    expect(attendanceDate.getTime()).toBe(range.start.getTime());
  });

  it("dua presensi siswa yang sama di hari sekolah yang sama menghasilkan attendanceDate identik (syarat unique constraint)", () => {
    // Ini membuktikan constraint @@unique([studentId, attendanceDate]) di
    // schema.prisma akan benar-benar menangkap keduanya sebagai "hari yang
    // sama", memenuhi tujuan constraint tersebut.
    const scan1 = new Date("2026-09-11T23:05:00.000Z"); // 06:05 WIB
    const scan2 = new Date("2026-09-12T09:30:00.000Z"); // 16:30 WIB, hari sekolah sama
    expect(schoolAttendanceDateValue(scan1).getTime()).toBe(
      schoolAttendanceDateValue(scan2).getTime()
    );
  });
});
