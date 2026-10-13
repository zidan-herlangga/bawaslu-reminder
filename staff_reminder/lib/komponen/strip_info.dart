import 'package:material_ui/material_ui.dart';

import '../tema/warna.dart';

/// Strip gelap tipis di paling atas yang menampilkan identitas instansi.
class StripInfo extends StatelessWidget {
  const StripInfo({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Warna.solid,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: const Text(
        'Bawaslu Bekasi Kota - Sistem Pengingat Jadwal',
        textAlign: TextAlign.center,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: Warna.solidMuted,
          fontSize: 11.5,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
