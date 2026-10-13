import 'package:material_ui/material_ui.dart';

import '../tema/warna.dart';

/// Label pil kecil (badge), dipakai untuk kategori dan divisi jadwal.
class Lencana extends StatelessWidget {
  const Lencana({
    super.key,
    required this.teks,
    this.latar = Warna.surface,
    this.warna = Warna.muted,
    this.garis = Warna.line,
    this.ikon,
    this.mayus = false,
  });

  final String teks;
  final Color latar;
  final Color warna;
  final Color garis;
  final IconData? ikon;
  final bool mayus;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: latar,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: garis),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (ikon != null) ...[
            Icon(ikon, size: 13, color: warna),
            const SizedBox(width: 4),
          ],
          Text(
            mayus ? teks.toUpperCase() : teks,
            style: TextStyle(
              color: warna,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              letterSpacing: mayus ? 0.4 : 0,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}
