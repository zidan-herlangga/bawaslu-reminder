/// Hari libur nasional dan cuti bersama Indonesia.
///
/// Sumber: SKB 3 Menteri Tahun 2026 (No. 1497/2025, No. 2/2025, No. 5/2025)
/// dan Tahun 2027 (No. 1205/2026, No. 3/2026, No. 2/2026). Tanggal tetap
/// ditambahkan untuk tahun yang belum terbit SKB-nya.
class HariLibur {
  const HariLibur({required this.nama, required this.jenis});

  final String nama;
  final String jenis; // 'libur' | 'cuti'

  bool get cuti => jenis == 'cuti';

  static const Map<int, Map<String, HariLibur>> _sku = {
    2026: {
      '01-01': HariLibur(nama: 'Tahun Baru 2026 Masehi', jenis: 'libur'),
      '01-16': HariLibur(nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'libur'),
      '02-16': HariLibur(nama: 'Tahun Baru Imlek 2577 Kongzili', jenis: 'cuti'),
      '02-17': HariLibur(nama: 'Tahun Baru Imlek 2577 Kongzili', jenis: 'libur'),
      '03-18': HariLibur(nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', jenis: 'cuti'),
      '03-19': HariLibur(nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', jenis: 'libur'),
      '03-20': HariLibur(nama: 'Idulfitri 1447 Hijriah', jenis: 'cuti'),
      '03-21': HariLibur(nama: 'Idulfitri 1447 Hijriah', jenis: 'libur'),
      '03-22': HariLibur(nama: 'Idulfitri 1447 Hijriah', jenis: 'libur'),
      '03-23': HariLibur(nama: 'Idulfitri 1447 Hijriah', jenis: 'cuti'),
      '03-24': HariLibur(nama: 'Idulfitri 1447 Hijriah', jenis: 'cuti'),
      '04-03': HariLibur(nama: 'Wafat Yesus Kristus', jenis: 'libur'),
      '04-05': HariLibur(nama: 'Kebangkitan Yesus Kristus (Paskah)', jenis: 'libur'),
      '05-01': HariLibur(nama: 'Hari Buruh Internasional', jenis: 'libur'),
      '05-14': HariLibur(nama: 'Kenaikan Yesus Kristus', jenis: 'libur'),
      '05-15': HariLibur(nama: 'Kenaikan Yesus Kristus', jenis: 'cuti'),
      '05-27': HariLibur(nama: 'Iduladha 1447 Hijriah', jenis: 'libur'),
      '05-28': HariLibur(nama: 'Iduladha 1447 Hijriah', jenis: 'cuti'),
      '05-31': HariLibur(nama: 'Hari Raya Waisak 2570 BE', jenis: 'libur'),
      '06-01': HariLibur(nama: 'Hari Lahir Pancasila', jenis: 'libur'),
      '06-16': HariLibur(nama: '1 Muharam, Tahun Baru Islam 1448 Hijriah', jenis: 'libur'),
      '08-17': HariLibur(nama: 'Proklamasi Kemerdekaan RI', jenis: 'libur'),
      '08-25': HariLibur(nama: 'Maulid Nabi Muhammad SAW', jenis: 'libur'),
      '12-24': HariLibur(nama: 'Kelahiran Yesus Kristus', jenis: 'cuti'),
      '12-25': HariLibur(nama: 'Kelahiran Yesus Kristus', jenis: 'libur'),
    },
    2027: {
      '01-01': HariLibur(nama: 'Tahun Baru 2027 Masehi', jenis: 'libur'),
      '01-05': HariLibur(nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'libur'),
      '02-05': HariLibur(nama: 'Tahun Baru Imlek 2578 Kongzili', jenis: 'cuti'),
      '02-06': HariLibur(nama: 'Tahun Baru Imlek 2578 Kongzili', jenis: 'libur'),
      '03-08': HariLibur(nama: 'Hari Suci Nyepi (Tahun Baru Saka 1949)', jenis: 'libur'),
      '03-09': HariLibur(nama: 'Idulfitri 1448 Hijriah', jenis: 'cuti'),
      '03-10': HariLibur(nama: 'Idulfitri 1448 Hijriah', jenis: 'libur'),
      '03-11': HariLibur(nama: 'Idulfitri 1448 Hijriah', jenis: 'libur'),
      '03-12': HariLibur(nama: 'Idulfitri 1448 Hijriah', jenis: 'cuti'),
      '03-15': HariLibur(nama: 'Idulfitri 1448 Hijriah', jenis: 'cuti'),
      '03-25': HariLibur(nama: 'Wafat Yesus Kristus', jenis: 'cuti'),
      '03-26': HariLibur(nama: 'Wafat Yesus Kristus', jenis: 'libur'),
      '03-28': HariLibur(nama: 'Kebangkitan Yesus Kristus (Paskah)', jenis: 'libur'),
      '05-01': HariLibur(nama: 'Hari Buruh Internasional', jenis: 'libur'),
      '05-06': HariLibur(nama: 'Kenaikan Yesus Kristus', jenis: 'libur'),
      '05-17': HariLibur(nama: 'Iduladha 1448 Hijriah', jenis: 'libur'),
      '05-18': HariLibur(nama: 'Iduladha 1448 Hijriah', jenis: 'cuti'),
      '05-19': HariLibur(nama: 'Hari Raya Waisak 2571 BE', jenis: 'cuti'),
      '05-20': HariLibur(nama: 'Hari Raya Waisak 2571 BE', jenis: 'libur'),
      '06-01': HariLibur(nama: 'Hari Lahir Pancasila', jenis: 'libur'),
      '06-06': HariLibur(nama: '1 Muharam, Tahun Baru Islam 1449 Hijriah', jenis: 'libur'),
      '08-15': HariLibur(nama: 'Maulid Nabi Muhammad SAW', jenis: 'libur'),
      '08-17': HariLibur(nama: 'Proklamasi Kemerdekaan RI', jenis: 'libur'),
      '12-24': HariLibur(nama: 'Kelahiran Yesus Kristus', jenis: 'cuti'),
      '12-25': HariLibur(nama: 'Kelahiran Yesus Kristus', jenis: 'libur'),
      '12-26': HariLibur(nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'libur'),
    },
  };

  static const Map<String, String> _tetap = {
    '01-01': 'Tahun Baru Masehi',
    '05-01': 'Hari Buruh Internasional',
    '06-01': 'Hari Lahir Pancasila',
    '08-17': 'Proklamasi Kemerdekaan RI',
    '12-25': 'Kelahiran Yesus Kristus',
  };

  /// [key] berformat `YYYY-MM-DD`.
  static HariLibur? pada(String key) {
    if (key.length < 10) return null;
    final tahun = key.substring(0, 4);
    final bulanTanggal = key.substring(5);

    final dariSku = _sku[int.tryParse(tahun)]?[bulanTanggal];
    if (dariSku != null) return dariSku;

    final tetap = _tetap[bulanTanggal];
    return tetap == null ? null : HariLibur(nama: tetap, jenis: 'libur');
  }

  static String labelJenis(String jenis) =>
      jenis == 'cuti' ? 'Cuti bersama' : 'Libur nasional';
}
