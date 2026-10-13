import 'dart:async';

import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../tema/warna.dart';

/// Kartu jam besar bergaya gradien merah Bawaslu.
class WaktuSekarang extends StatefulWidget {
  const WaktuSekarang({super.key});

  @override
  State<WaktuSekarang> createState() => _WaktuSekarangState();
}

class _WaktuSekarangState extends State<WaktuSekarang> {
  late Timer _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  String _dua(int nilai) => nilai.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final tanggal = DateFormat('EEEE, d MMMM y', 'id_ID').format(now);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Warna.blue, Warna.blueHi],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [
          BoxShadow(color: Color(0x1A921701), blurRadius: 18, offset: Offset(0, 6)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'WAKTU SEKARANG',
                  style: TextStyle(
                    color: Color(0xCCFFFFFF),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.6,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0x33FFFFFF),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text(
                  'WIB',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '${_dua(now.hour)}:${_dua(now.minute)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 40,
                  fontWeight: FontWeight.w800,
                  height: 1,
                  letterSpacing: -1,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 2),
              Text(
                ':${_dua(now.second)}',
                style: const TextStyle(
                  color: Color(0xB3FFFFFF),
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  height: 1,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                now.hour < 12 ? 'AM' : 'PM',
                style: const TextStyle(
                  color: Color(0xB3FFFFFF),
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(height: 1, color: const Color(0x40FFFFFF)),
          const SizedBox(height: 8),
          Text(
            tanggal,
            style: const TextStyle(color: Color(0xD9FFFFFF), fontSize: 12.5),
          ),
        ],
      ),
    );
  }
}
