export interface Student {
  id: string;
  no: number;
  nama: string;
  nis: string;
  kelas: string;
  jurusan: string;
  jenisKelamin: 'Laki-laki' | 'Perempuan';
  statusAkademik: 'Aktif' | 'Tidak Aktif';
  statusHariIni: 'Tepat Waktu' | 'Terlambat' | 'Izin (Sakit)' | 'Izin' | 'Alpha';
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
  status: 'Aktif' | 'Cuti';
  avatarInitials: string;
  avatarBg?: string;
  email: string;
  telepon: string;
}

export interface AttendanceLog {
  tanggal: string;
  hari: string;
  waktuMasuk: string;
  status: 'Tepat Waktu' | 'Terlambat' | 'Izin' | 'Alpha';
  keterangan: string;
}

export const CURRENT_STUDENT = {
  nama: "Raka Pratama",
  nis: "20241087",
  status: "Siswa Aktif",
  kelas: "XI RPL 2",
  jurusan: "Rekayasa Perangkat Lunak (RPL)",
  tahunAjaran: "2026 / 2027 (Ganjil)",
  avatarInitials: "RP",
  statKehadiran: {
    totalHadir: "18 Hari",
    totalHadirPct: "90.5%",
    terlambat: "2 Kali",
    terlambatDelta: "-1.2%",
    izinSakit: "1 Hari",
    alpha: "0 Hari",
    kehadiranBulanIniPct: "96%",
    rasioSemesterTotal: "98.4%",
    targetSemester: "95%",
    hadirEfektif: "54 Hari",
    sakitIzinResmi: "1 Hari",
    terlambatSemester: "2 Kali",
    alasanLainAlpha: "0 Hari",
  },
  catatanPembimbing: "Sangat baik, Raka! Tingkatkan terus konsistensi bangun pagi agar persentase keterlambatan tetap di bawah batas aman sekolah.",
};

export const CURRENT_TEACHER = {
  nama: "Bu Ratna Lestari, S.Pd.",
  nip: "19850412 201101 2 003",
  waliKelas: "XI RPL 2",
  mataPelajaranUtama: "Pemrograman Perangkat Bergerak (Mobile)",
  email: "ratna.lestari@smkn11jakarta.sch.id",
  telepon: "+62 812-3456-7890",
  jamMengajarMingguan: "24 Jam",
  rasioKehadiranMengajar: "98.2%",
  kehadiranBulanIni: "98%",
  ruangKelas: "Lab RPL Baru (Lantai 2)",
  jadwal: "Selasa & Jumat",
  jumlahSiswa: 32,
};

export const INITIAL_STUDENTS: Student[] = [
  {
    id: "s-1",
    no: 1,
    nama: "Aditya Wijaya",
    nis: "20241001",
    kelas: "XI RPL 2",
    jurusan: "Rekayasa Perangkat Lunak",
    jenisKelamin: "Laki-laki",
    statusAkademik: "Aktif",
    statusHariIni: "Tepat Waktu",
    waktuMasuk: "06:42 WIB",
    keterangan: "Melalui Face ID Camera utama",
    avatarInitials: "AW",
    avatarBg: "bg-blue-600",
  },
  {
    id: "s-2",
    no: 2,
    nama: "Amanda Lestari",
    nis: "20241005",
    kelas: "XI RPL 2",
    jurusan: "Rekayasa Perangkat Lunak",
    jenisKelamin: "Perempuan",
    statusAkademik: "Aktif",
    statusHariIni: "Tepat Waktu",
    waktuMasuk: "06:48 WIB",
    keterangan: "Melalui Face ID Camera utama",
    avatarInitials: "AL",
    avatarBg: "bg-pink-600",
  },
  {
    id: "s-3",
    no: 3,
    nama: "Bagus Pratama",
    nis: "20241012",
    kelas: "XI RPL 2",
    jurusan: "Rekayasa Perangkat Lunak",
    jenisKelamin: "Laki-laki",
    statusAkademik: "Aktif",
    statusHariIni: "Terlambat",
    waktuMasuk: "07:04 WIB",
    keterangan: "Lalu lintas padat daerah simpang",
    avatarInitials: "BP",
    avatarBg: "bg-amber-600",
  },
  {
    id: "s-4",
    no: 4,
    nama: "Citra Dewi",
    nis: "20241019",
    kelas: "XI RPL 2",
    jurusan: "Rekayasa Perangkat Lunak",
    jenisKelamin: "Perempuan",
    statusAkademik: "Aktif",
    statusHariIni: "Izin (Sakit)",
    waktuMasuk: "--:-- WIB",
    keterangan: "Surat dokter terlampir di WhatsApp",
    avatarInitials: "CD",
    avatarBg: "bg-teal-600",
  },
  {
    id: "s-5",
    no: 5,
    nama: "Dimas Saputra",
    nis: "20241022",
    kelas: "XI RPL 2",
    jurusan: "Rekayasa Perangkat Lunak",
    jenisKelamin: "Laki-laki",
    statusAkademik: "Tidak Aktif",
    statusHariIni: "Tepat Waktu",
    waktuMasuk: "06:51 WIB",
    keterangan: "Kehadiran pagi normal",
    avatarInitials: "DS",
    avatarBg: "bg-indigo-600",
  },
  {
    id: "s-6",
    no: 6,
    nama: "Farhan Malik",
    nis: "20241031",
    kelas: "XI RPL 2",
    jurusan: "Rekayasa Perangkat Lunak",
    jenisKelamin: "Laki-laki",
    statusAkademik: "Aktif",
    statusHariIni: "Alpha",
    waktuMasuk: "--:-- WIB",
    keterangan: "Tidak ada keterangan pemindaian",
    avatarInitials: "FM",
    avatarBg: "bg-red-600",
  },
  {
    id: "s-7",
    no: 7,
    nama: "Gita Salsabila",
    nis: "20241035",
    kelas: "XI RPL 2",
    jurusan: "Rekayasa Perangkat Lunak",
    jenisKelamin: "Perempuan",
    statusAkademik: "Aktif",
    statusHariIni: "Tepat Waktu",
    waktuMasuk: "06:45 WIB",
    keterangan: "Melalui Face ID Camera utama",
    avatarInitials: "GS",
    avatarBg: "bg-purple-600",
  },
  {
    id: "s-8",
    no: 8,
    nama: "Hendra Wijaya",
    nis: "20241040",
    kelas: "XI RPL 2",
    jurusan: "Rekayasa Perangkat Lunak",
    jenisKelamin: "Laki-laki",
    statusAkademik: "Aktif",
    statusHariIni: "Terlambat",
    waktuMasuk: "07:11 WIB",
    keterangan: "Kendala angkutan umum",
    avatarInitials: "HW",
    avatarBg: "bg-emerald-600",
  },
];

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: "t-1",
    no: 1,
    namaLengkap: "Ratna Sari, S.Pd.",
    nip: "198205122009012003",
    mataPelajaran: "Pemrograman Web",
    kelasWali: "XI RPL 2",
    status: "Aktif",
    avatarInitials: "RS",
    avatarBg: "bg-blue-600",
    email: "ratna.sari@smkn11jkt.sch.id",
    telepon: "081234567890",
  },
  {
    id: "t-2",
    no: 2,
    namaLengkap: "Budi Setiawan, M.T.",
    nip: "197803152005011002",
    mataPelajaran: "Basis Data",
    kelasWali: "XII RPL 1",
    status: "Aktif",
    avatarInitials: "BS",
    avatarBg: "bg-teal-600",
    email: "budi.setiawan@smkn11jkt.sch.id",
    telepon: "081298765432",
  },
  {
    id: "t-3",
    no: 3,
    namaLengkap: "Siti Rahma, S.Kom.",
    nip: "198911042018022001",
    mataPelajaran: "Jaringan Komputer",
    kelasWali: "X TKJ 1",
    status: "Aktif",
    avatarInitials: "SR",
    avatarBg: "bg-purple-600",
    email: "siti.rahma@smkn11jkt.sch.id",
    telepon: "081377889900",
  },
  {
    id: "t-4",
    no: 4,
    namaLengkap: "Dewi Lestari, S.Pd.",
    nip: "198501242011012004",
    mataPelajaran: "Dasar Desain Grafis",
    kelasWali: "XI RPL 1",
    status: "Cuti",
    avatarInitials: "DL",
    avatarBg: "bg-rose-600",
    email: "dewi.lestari@smkn11jkt.sch.id",
    telepon: "081512341234",
  },
];

export const STUDENT_ATTENDANCE_LOGS: AttendanceLog[] = [
  {
    tanggal: "11 Sep 2026",
    hari: "Jumat",
    waktuMasuk: "06:47 WIB",
    status: "Tepat Waktu",
    keterangan: "Melalui Face ID Camera utama",
  },
  {
    tanggal: "10 Sep 2026",
    hari: "Kamis",
    waktuMasuk: "06:52 WIB",
    status: "Tepat Waktu",
    keterangan: "Melalui Face ID Camera utama",
  },
  {
    tanggal: "09 Sep 2026",
    hari: "Rabu",
    waktuMasuk: "07:08 WIB",
    status: "Terlambat",
    keterangan: "Lalu lintas padat daerah simpang",
  },
  {
    tanggal: "08 Sep 2026",
    hari: "Selasa",
    waktuMasuk: "06:45 WIB",
    status: "Tepat Waktu",
    keterangan: "Melalui Face ID Camera utama",
  },
  {
    tanggal: "07 Sep 2026",
    hari: "Senin",
    waktuMasuk: "---",
    status: "Izin",
    keterangan: "Sakit - Surat keterangan dokter terlampir",
  },
  {
    tanggal: "04 Sep 2026",
    hari: "Jumat",
    waktuMasuk: "06:38 WIB",
    status: "Tepat Waktu",
    keterangan: "Kehadiran pagi normal",
  },
];

export const CLASS_SUMMARY_ADMIN = [
  { kelas: "XI RPL 2", totalSiswa: 32, hadir: 28, terlambat: 2, izin: 1, alpha: 1, persentase: "96%" },
  { kelas: "X TKJ 1", totalSiswa: 30, hadir: 24, terlambat: 4, izin: 0, alpha: 2, persentase: "90%" },
  { kelas: "XII RPL 1", totalSiswa: 32, hadir: 31, terlambat: 1, izin: 0, alpha: 0, persentase: "98%" },
  { kelas: "XI RPL 1", totalSiswa: 30, hadir: 30, terlambat: 0, izin: 0, alpha: 0, persentase: "100%" },
];

export const CLASS_REPORT_ADMIN = [
  { kelas: "XI RPL 2", totalSiswa: 32, rataHadir: "96.5%", terlambat: "Aditya (4)", alpha: "Hendra (1)" },
  { kelas: "X TKJ 1", totalSiswa: 30, rataHadir: "91.2%", terlambat: "Rudi (5)", alpha: "Farhan (3)" },
  { kelas: "XII RPL 1", totalSiswa: 32, rataHadir: "98.7%", terlambat: "Putri (2)", alpha: "-" },
  { kelas: "XI RPL 1", totalSiswa: 30, rataHadir: "99.1%", terlambat: "-", alpha: "-" },
];

export const REKAP_HARIAN_GURU = [
  { tanggal: "Kamis, 10 Sep 2026", hadir: "31 Siswa", lambat: "1 Siswa", izin: "0 Siswa", alpha: "0 Siswa", rasio: "Hadir" },
  { tanggal: "Rabu, 9 Sep 2026", hadir: "30 Siswa", lambat: "0 Siswa", izin: "2 Siswa", alpha: "0 Siswa", rasio: "Hadir" },
  { tanggal: "Selasa, 8 Sep 2026", hadir: "28 Siswa", lambat: "3 Siswa", izin: "1 Siswa", alpha: "0 Siswa", rasio: "Hadir" },
  { tanggal: "Senin, 7 Sep 2026", hadir: "32 Siswa", lambat: "0 Siswa", izin: "0 Siswa", alpha: "0 Siswa", rasio: "Hadir" },
];

export const ADMIN_USERS = [
  { nama: "Hendra Admin 1", role: "IT Admin", initials: "AD" },
  { nama: "Yudi Prasetyo", role: "Super Admin", initials: "AD" },
  { nama: "Mega Lestari", role: "Staff Tata Usaha", initials: "AD" },
];
