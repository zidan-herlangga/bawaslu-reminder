import 'package:material_ui/material_ui.dart';

import 'warna.dart';

/// Gaya visual satu kategori jadwal (Rapat/Tugas/Pengawasan/Lainnya).
class GayaKategori {
  const GayaKategori({
    required this.latar,
    required this.teks,
    required this.garis,
    required this.aksen,
    required this.ikon,
  });

  final Color latar;
  final Color teks;
  final Color garis;
  final Color aksen;
  final IconData ikon;
}

/// Pemetaan kategori ke gaya. Nilainya sepadan dengan `KATEGORI_STYLE`
/// di `src/components/Dashboard.jsx` (web).
GayaKategori gayaKategori(String kategori) {
  switch (kategori) {
    case 'Rapat':
      return const GayaKategori(
        latar: Warna.blue50,
        teks: Warna.blue700,
        garis: Warna.blue200,
        aksen: Warna.blue,
        ikon: Icons.groups_rounded,
      );
    case 'Tugas':
      return const GayaKategori(
        latar: Warna.amber50,
        teks: Warna.amber800,
        garis: Warna.amber200,
        aksen: Warna.amber500,
        ikon: Icons.assignment_rounded,
      );
    case 'Pengawasan':
      return const GayaKategori(
        latar: Warna.green50,
        teks: Warna.green700,
        garis: Warna.green200,
        aksen: Warna.green500,
        ikon: Icons.visibility_rounded,
      );
    default:
      return const GayaKategori(
        latar: Warna.surface,
        teks: Warna.muted,
        garis: Warna.line,
        aksen: Warna.line,
        ikon: Icons.event_note_rounded,
      );
  }
}
