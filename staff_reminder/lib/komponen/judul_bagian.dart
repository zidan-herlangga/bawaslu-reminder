import 'package:material_ui/material_ui.dart';

import '../tema/warna.dart';

/// Judul bagian dengan keterangan jumlah di kanan.
class JudulBagian extends StatelessWidget {
  const JudulBagian({
    super.key,
    required this.judul,
    this.keterangan,
    this.ikon,
  });

  final String judul;
  final String? keterangan;
  final IconData? ikon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (ikon != null) ...[
          Icon(ikon, size: 16, color: Warna.blue),
          const SizedBox(width: 6),
        ],
        Expanded(
          child: Text(
            judul.toUpperCase(),
            style: const TextStyle(
              color: Warna.ink,
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
            ),
          ),
        ),
        if (keterangan != null)
          Text(
            keterangan!,
            style: const TextStyle(color: Warna.muted, fontSize: 12),
          ),
      ],
    );
  }
}
