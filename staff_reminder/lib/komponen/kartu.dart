import 'package:material_ui/material_ui.dart';

import '../tema/warna.dart';

/// Kartu dasar bergaya Bawaslu: latar putih, garis tipis, sudut membulat.
class Kartu extends StatelessWidget {
  const Kartu({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isi = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Warna.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Warna.line),
      ),
      child: child,
    );

    if (onTap == null) return isi;
    return GestureDetector(onTap: onTap, child: isi);
  }
}
