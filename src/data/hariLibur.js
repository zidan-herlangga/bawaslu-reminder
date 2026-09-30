// Hari libur nasional dan cuti bersama Indonesia.
// Sumber: Surat Keputusan Bersama (SKB) 3 Menteri tentang Hari Libur Nasional
// dan Cuti Bersama Tahun 2026 (No. 1497/2025, No. 2/2025, No. 5/2025) serta
// Tahun 2027 (No. 1205/2026, No. 3/2026, No. 2/2026).
// Tanggal tetap setiap tahun ditambahkan terpisah untuk tahun yang belum
// terbit SKB-nya (2028 dan seterusnya).

const SKU = {
  2026: [
    { tanggal: '01-01', nama: 'Tahun Baru 2026 Masehi', jenis: 'libur' },
    { tanggal: '01-16', nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'libur' },
    { tanggal: '02-16', nama: 'Tahun Baru Imlek 2577 Kongzili', jenis: 'cuti' },
    { tanggal: '02-17', nama: 'Tahun Baru Imlek 2577 Kongzili', jenis: 'libur' },
    { tanggal: '03-18', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', jenis: 'cuti' },
    { tanggal: '03-19', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', jenis: 'libur' },
    { tanggal: '03-20', nama: 'Idulfitri 1447 Hijriah', jenis: 'cuti' },
    { tanggal: '03-21', nama: 'Idulfitri 1447 Hijriah', jenis: 'libur' },
    { tanggal: '03-22', nama: 'Idulfitri 1447 Hijriah', jenis: 'libur' },
    { tanggal: '03-23', nama: 'Idulfitri 1447 Hijriah', jenis: 'cuti' },
    { tanggal: '03-24', nama: 'Idulfitri 1447 Hijriah', jenis: 'cuti' },
    { tanggal: '04-03', nama: 'Wafat Yesus Kristus', jenis: 'libur' },
    { tanggal: '04-05', nama: 'Kebangkitan Yesus Kristus (Paskah)', jenis: 'libur' },
    { tanggal: '05-01', nama: 'Hari Buruh Internasional', jenis: 'libur' },
    { tanggal: '05-14', nama: 'Kenaikan Yesus Kristus', jenis: 'libur' },
    { tanggal: '05-15', nama: 'Kenaikan Yesus Kristus', jenis: 'cuti' },
    { tanggal: '05-27', nama: 'Iduladha 1447 Hijriah', jenis: 'libur' },
    { tanggal: '05-28', nama: 'Iduladha 1447 Hijriah', jenis: 'cuti' },
    { tanggal: '05-31', nama: 'Hari Raya Waisak 2570 BE', jenis: 'libur' },
    { tanggal: '06-01', nama: 'Hari Lahir Pancasila', jenis: 'libur' },
    { tanggal: '06-16', nama: '1 Muharam, Tahun Baru Islam 1448 Hijriah', jenis: 'libur' },
    { tanggal: '08-17', nama: 'Proklamasi Kemerdekaan RI', jenis: 'libur' },
    { tanggal: '08-25', nama: 'Maulid Nabi Muhammad SAW', jenis: 'libur' },
    { tanggal: '12-24', nama: 'Kelahiran Yesus Kristus', jenis: 'cuti' },
    { tanggal: '12-25', nama: 'Kelahiran Yesus Kristus', jenis: 'libur' },
  ],
  2027: [
    { tanggal: '01-01', nama: 'Tahun Baru 2027 Masehi', jenis: 'libur' },
    { tanggal: '01-05', nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'libur' },
    { tanggal: '02-05', nama: 'Tahun Baru Imlek 2578 Kongzili', jenis: 'cuti' },
    { tanggal: '02-06', nama: 'Tahun Baru Imlek 2578 Kongzili', jenis: 'libur' },
    { tanggal: '03-08', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1949)', jenis: 'libur' },
    { tanggal: '03-09', nama: 'Idulfitri 1448 Hijriah', jenis: 'cuti' },
    { tanggal: '03-10', nama: 'Idulfitri 1448 Hijriah', jenis: 'libur' },
    { tanggal: '03-11', nama: 'Idulfitri 1448 Hijriah', jenis: 'libur' },
    { tanggal: '03-12', nama: 'Idulfitri 1448 Hijriah', jenis: 'cuti' },
    { tanggal: '03-15', nama: 'Idulfitri 1448 Hijriah', jenis: 'cuti' },
    { tanggal: '03-25', nama: 'Wafat Yesus Kristus', jenis: 'cuti' },
    { tanggal: '03-26', nama: 'Wafat Yesus Kristus', jenis: 'libur' },
    { tanggal: '03-28', nama: 'Kebangkitan Yesus Kristus (Paskah)', jenis: 'libur' },
    { tanggal: '05-01', nama: 'Hari Buruh Internasional', jenis: 'libur' },
    { tanggal: '05-06', nama: 'Kenaikan Yesus Kristus', jenis: 'libur' },
    { tanggal: '05-17', nama: 'Iduladha 1448 Hijriah', jenis: 'libur' },
    { tanggal: '05-18', nama: 'Iduladha 1448 Hijriah', jenis: 'cuti' },
    { tanggal: '05-19', nama: 'Hari Raya Waisak 2571 BE', jenis: 'cuti' },
    { tanggal: '05-20', nama: 'Hari Raya Waisak 2571 BE', jenis: 'libur' },
    { tanggal: '06-01', nama: 'Hari Lahir Pancasila', jenis: 'libur' },
    { tanggal: '06-06', nama: '1 Muharam, Tahun Baru Islam 1449 Hijriah', jenis: 'libur' },
    { tanggal: '08-15', nama: 'Maulid Nabi Muhammad SAW', jenis: 'libur' },
    { tanggal: '08-17', nama: 'Proklamasi Kemerdekaan RI', jenis: 'libur' },
    { tanggal: '12-24', nama: 'Kelahiran Yesus Kristus', jenis: 'cuti' },
    { tanggal: '12-25', nama: 'Kelahiran Yesus Kristus', jenis: 'libur' },
    { tanggal: '12-26', nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'libur' },
  ],
};

const TETAP = [
  { tanggal: '01-01', nama: 'Tahun Baru Masehi' },
  { tanggal: '05-01', nama: 'Hari Buruh Internasional' },
  { tanggal: '06-01', nama: 'Hari Lahir Pancasila' },
  { tanggal: '08-17', nama: 'Proklamasi Kemerdekaan RI' },
  { tanggal: '12-25', nama: 'Kelahiran Yesus Kristus' },
];

export function getHariLibur(key) {
  const tahun = key.slice(0, 4);
  const bulanTanggal = key.slice(5);

  const dariSku = (SKU[tahun] ?? []).find((hari) => hari.tanggal === bulanTanggal);
  if (dariSku) return dariSku;

  const tetap = TETAP.find((hari) => hari.tanggal === bulanTanggal);
  return tetap ? { ...tetap, jenis: 'libur' } : null;
}

export function labelJenis(jenis) {
  return jenis === 'cuti' ? 'Cuti bersama' : 'Libur nasional';
}
