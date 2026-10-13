/// Pilihan baku aplikasi. Nilainya sama dengan `src/constants/options.js`
/// (web) supaya data yang dikirim ke Supabase selalu konsisten.
class Opsi {
  const Opsi._();

  static const List<String> divisi = [
    'Pencegahan, Partisipasi Masyarakat, dan Humas',
    'Hukum dan Penyelesaian Sengketa',
    'Penanganan Pelanggaran dan Data Informasi',
    'Sumber Daya Manusia, Organisasi, Diklat, dan Fasilitasi',
  ];

  static const Map<String, String> divisiSingkat = {
    'Pencegahan, Partisipasi Masyarakat, dan Humas': 'Pencegahan & Humas',
    'Hukum dan Penyelesaian Sengketa': 'Hukum & Sengketa',
    'Penanganan Pelanggaran dan Data Informasi': 'Pelanggaran & Data',
    'Sumber Daya Manusia, Organisasi, Diklat, dan Fasilitasi': 'SDM & Diklat',
  };

  static const List<String> jabatan = [
    'Ketua / Komisioner',
    'Koordinator Divisi',
    'Staf Teknis',
    'Staf Pendukung',
  ];

  static const List<String> kategori = ['Rapat', 'Tugas', 'Pengawasan', 'Lainnya'];

  static const int panjangMinimalSandi = 6;

  static const int menitPengingat = 15;

  /// Label divisi singkat, atau nilai aslinya bila tidak dikenal.
  static String singkatDivisi(String? nilai) {
    if (nilai == null || nilai.isEmpty) return '';
    return divisiSingkat[nilai] ?? nilai;
  }
}
