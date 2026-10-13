import 'package:material_ui/material_ui.dart';

import '../tema/warna.dart';

/// Chip pilihan bergaya pil, dipakai untuk filter divisi dan status.
class ChipFilter extends StatelessWidget {
  const ChipFilter({
    super.key,
    required this.label,
    required this.aktif,
    required this.onTap,
  });

  final String label;
  final bool aktif;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: aktif ? Warna.blue : Warna.card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: aktif ? Warna.blue : Warna.line),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: aktif ? Colors.white : Warna.muted,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
