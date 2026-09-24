/**
 * Centralized TypeScript Type Definitions
 * HadirFace Academic Portal - SMKN 11 Jakarta
 */

export type UserRole = 'siswa' | 'guru' | 'admin';

export type AttendanceStatus =
  | 'Tepat Waktu'
  | 'Terlambat'
  | 'Izin (Sakit)'
  | 'Izin'
  | 'Alpha';

export type AcademicStatus = 'Aktif' | 'Tidak Aktif' | 'Cuti';

export type Gender = 'Laki-laki' | 'Perempuan';

export interface Student {
  id: string;
  no: number;
  nama: string;
  nis: string;
  kelas: string;
  jurusan: string;
  jenisKelamin: Gender;
  statusAkademik: AcademicStatus;
  statusHariIni: AttendanceStatus;
  waktuMasuk?: string;
  keterangan?: string;
  avatarInitials: string;
  avatarBg?: string;
}

export interface Teacher {
  id: string;
  no: number;
  namaLengkap: string;
  nip: string;
  mataPelajaran: string;
  kelasWali: string;
  status: AcademicStatus;
  avatarInitials: string;
  avatarBg?: string;
  email: string;
  telepon: string;
}

export interface AttendanceLog {
  tanggal: string;
  hari: string;
  waktuMasuk: string;
  status: AttendanceStatus;
  keterangan: string;
}

export interface AdminUser {
  nama: string;
  role: string;
  initials: string;
}

export interface ClassSummary {
  kelas: string;
  totalSiswa: number;
  hadir: number;
  terlambat: number;
  izin: number;
  alpha: number;
  persentase: string;
}

export interface ClassReport {
  kelas: string;
  totalSiswa: number;
  rataHadir: string;
  terlambat: string;
  alpha: string;
}
