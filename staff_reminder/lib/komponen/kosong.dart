import 'package:material_ui/material_ui.dart';

import '../tema/warna.dart';

/// Keadaan kosong: ikon, judul, keterangan, dan aksi opsional.
class Kosong extends StatelessWidget {
  const Kosong({
    super.key,
    required this.ikon,
    required this.judul,
    required this.pesan,
    this.aksi,
  });

  final IconData ikon;
  final String judul;
  final String pesan;
  final Widget? aksi;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 34),
      decoration: BoxDecoration(
        color: Warna.card,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Warna.line, style: BorderStyle.solid),
      ),
      child: Column(
        children: [
          Icon(ikon, size: 40, color: Warna.blue200),
          const SizedBox(height: 12),
          Text(
            judul,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Warna.ink,
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            pesan,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Warna.muted, fontSize: 12.5, height: 1.5),
          ),
          if (aksi != null) ...[const SizedBox(height: 16), aksi!],
        ],
      ),
    );
  }
}
