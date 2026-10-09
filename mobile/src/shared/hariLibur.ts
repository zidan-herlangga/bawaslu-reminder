// Data Hari Libur Nasional dan Cuti Bersama Indonesia (berdasarkan SKB 3 Menteri)
// Tersedia untuk tahun 2025 dan 2026; kalender dapat menavigasi antar bulan.

// Sumber: SKB 3 Menteri (19 September 2025) untuk 2026, SKB 2024 untuk 2025

export type TipeHariLibur = 'libur_nasional' | 'cuti_bersama' | 'peristiwa';

export interface HariLibur {
  tanggal: string; // 'YYYY-MM-DD'
  nama: string;
  tipe: TipeHariLibur;
}

const LIBUR_2025: HariLibur[] = [
  { tanggal: '2025-01-01', nama: 'Tahun Baru 2025 Masehi', tipe: 'libur_nasional' },
  { tanggal: '2025-01-27', nama: 'Isra Mikraj Nabi Muhammad SAW', tipe: 'libur_nasional' },
  { tanggal: '2025-01-28', nama: 'Tahun Baru Imlek 2576 Kongzili (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2025-01-29', nama: 'Tahun Baru Imlek 2576 Kongzili', tipe: 'libur_nasional' },
  { tanggal: '2025-03-28', nama: 'Hari Suci Nyepi (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2025-03-29', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1947)', tipe: 'libur_nasional' },
  { tanggal: '2025-03-31', nama: 'Idul Fitri 1446 Hijriah', tipe: 'libur_nasional' },
  { tanggal: '2025-04-01', nama: 'Idul Fitri 1446 Hijriah', tipe: 'libur_nasional' },
  { tanggal: '2025-04-02', nama: 'Idul Fitri 1446 H (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2025-04-03', nama: 'Idul Fitri 1446 H (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2025-04-04', nama: 'Idul Fitri 1446 H (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2025-04-07', nama: 'Idul Fitri 1446 H (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2025-04-18', nama: 'Wafat Yesus Kristus', tipe: 'libur_nasional' },
  { tanggal: '2025-04-20', nama: 'Kebangkitan Yesus Kristus (Paskah)', tipe: 'libur_nasional' },
  { tanggal: '2025-05-01', nama: 'Hari Buruh Internasional', tipe: 'libur_nasional' },
  { tanggal: '2025-05-12', nama: 'Hari Raya Waisak 2569 BE', tipe: 'libur_nasional' },
  { tanggal: '2025-05-13', nama: 'Hari Raya Waisak 2569 BE (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2025-05-29', nama: 'Kenaikan Yesus Kristus', tipe: 'libur_nasional' },
  { tanggal: '2025-05-30', nama: 'Kenaikan Yesus Kristus (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2025-06-01', nama: 'Hari Lahir Pancasila', tipe: 'libur_nasional' },
  { tanggal: '2025-06-06', nama: 'Idul Adha 1446 Hijriah', tipe: 'libur_nasional' },
  { tanggal: '2025-06-09', nama: 'Idul Adha 1446 H (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2025-06-27', nama: 'Tahun Baru Islam 1447 Hijriah', tipe: 'libur_nasional' },
  { tanggal: '2025-08-17', nama: 'Proklamasi Kemerdekaan', tipe: 'libur_nasional' },
  { tanggal: '2025-09-05', nama: 'Maulid Nabi Muhammad SAW', tipe: 'libur_nasional' },
  { tanggal: '2025-12-25', nama: 'Kelahiran Yesus Kristus (Natal)', tipe: 'libur_nasional' },
  { tanggal: '2025-12-26', nama: 'Kelahiran Yesus Kristus (Cuti Bersama)', tipe: 'cuti_bersama' },
];

const LIBUR_2026: HariLibur[] = [
  { tanggal: '2026-01-01', nama: 'Tahun Baru 2026 Masehi', tipe: 'libur_nasional' },
  { tanggal: '2026-01-16', nama: 'Isra Mikraj Nabi Muhammad SAW', tipe: 'libur_nasional' },
  { tanggal: '2026-02-16', nama: 'Tahun Baru Imlek 2577 Kongzili (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2026-02-17', nama: 'Tahun Baru Imlek 2577 Kongzili', tipe: 'libur_nasional' },
  { tanggal: '2026-03-18', nama: 'Hari Suci Nyepi (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2026-03-19', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', tipe: 'libur_nasional' },
  { tanggal: '2026-03-20', nama: 'Idul Fitri 1447 H (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2026-03-21', nama: 'Idul Fitri 1447 Hijriah', tipe: 'libur_nasional' },
  { tanggal: '2026-03-22', nama: 'Idul Fitri 1447 Hijriah', tipe: 'libur_nasional' },
  { tanggal: '2026-03-23', nama: 'Idul Fitri 1447 H (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2026-03-24', nama: 'Idul Fitri 1447 H (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2026-04-03', nama: 'Wafat Yesus Kristus', tipe: 'libur_nasional' },
  { tanggal: '2026-04-05', nama: 'Kebangkitan Yesus Kristus (Paskah)', tipe: 'libur_nasional' },
  { tanggal: '2026-05-01', nama: 'Hari Buruh Internasional', tipe: 'libur_nasional' },
  { tanggal: '2026-05-14', nama: 'Kenaikan Yesus Kristus', tipe: 'libur_nasional' },
  { tanggal: '2026-05-15', nama: 'Kenaikan Yesus Kristus (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2026-05-27', nama: 'Idul Adha 1447 Hijriah', tipe: 'libur_nasional' },
  { tanggal: '2026-05-28', nama: 'Idul Adha 1447 H (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2026-05-31', nama: 'Hari Raya Waisak 2570 BE', tipe: 'libur_nasional' },
  { tanggal: '2026-06-01', nama: 'Hari Lahir Pancasila', tipe: 'libur_nasional' },
  { tanggal: '2026-06-16', nama: 'Tahun Baru Islam 1448 Hijriah', tipe: 'libur_nasional' },
  { tanggal: '2026-08-17', nama: 'Proklamasi Kemerdekaan', tipe: 'libur_nasional' },
  { tanggal: '2026-08-25', nama: 'Maulid Nabi Muhammad SAW', tipe: 'libur_nasional' },
  { tanggal: '2026-12-24', nama: 'Kelahiran Yesus Kristus (Cuti Bersama)', tipe: 'cuti_bersama' },
  { tanggal: '2026-12-25', nama: 'Kelahiran Yesus Kristus (Natal)', tipe: 'libur_nasional' },
];

const SEMUA_LIBUR: HariLibur[] = [...LIBUR_2025, ...LIBUR_2026];

export function dapatkanHariLibur(tahun: number, bulan: number): HariLibur[] {
  const bln = String(bulan + 1).padStart(2, '0');
  const prefix = `${tahun}-${bln}`;
  return SEMUA_LIBUR.filter((l) => l.tanggal.startsWith(prefix));
}

export function dapatkanLiburPerTanggal(tahun: number, bulan: number, hari: number): HariLibur[] {
  const th = String(tahun).padStart(4, '0');
  const bln = String(bulan + 1).padStart(2, '0');
  const hr = String(hari).padStart(2, '0');
  const kunci = `${th}-${bln}-${hr}`;
  return SEMUA_LIBUR.filter((l) => l.tanggal === kunci);
}

export function adaHariLibur(tahun: number, bulan: number, hari: number): boolean {
  return dapatkanLiburPerTanggal(tahun, bulan, hari).length > 0;
}
