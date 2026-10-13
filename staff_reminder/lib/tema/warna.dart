import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

/// Palet warna aplikasi.
///
/// Satu-satunya sumber warna. Nilainya identik dengan token `--bw-*` di
/// `src/index.css` (web) supaya app Android dan web terlihat sama. Aplikasi ini
/// light-only, jadi hanya tabel terang yang dipakai.
class Warna {
  const Warna._();

  // Aksen utama (merah merek).
  static const blue = Color(0xFFE02401);
  static const blueHi = Color(0xFFBC1E01);
  static const blue50 = Color(0xFFFCE9E6);
  static const blue100 = Color(0xFFF7C8C0);
  static const blue200 = Color(0xFFF09280);
  static const blue700 = Color(0xFF921701);
  static const blue900 = Color(0xFF550E00);

  // Status merah (bahaya/galat).
  static const red = Color(0xFFD0342C);
  static const red50 = Color(0xFFFCEBEA);
  static const red100 = Color(0xFFF7D2D0);
  static const redSolid = Color(0xFFB3271F);

  // Status kuning (peringatan).
  static const amber = Color(0xFFEBA83A);
  static const amber50 = Color(0xFFFDF6EB);
  static const amber200 = Color(0xFFF6D8A6);
  static const amber500 = Color(0xFFC18A30);
  static const amber800 = Color(0xFF815C20);
  static const amber900 = Color(0xFF594016);

  // Status hijau (selesai).
  static const green = Color(0xFF15803D);
  static const green50 = Color(0xFFEAF7EF);
  static const green200 = Color(0xFFC0E6D0);
  static const green500 = Color(0xFF22A55B);
  static const green700 = Color(0xFF166534);

  // Netral.
  static const ink = Color(0xFF1E1B18);
  static const ink2 = Color(0xFF3A3530);
  static const muted = Color(0xFF756F66);
  static const line = Color(0xFFEAE4DB);
  static const surface = Color(0xFFF6F1EA);
  static const canvas = Color(0xFFFAF7F3);
  static const card = Color(0xFFFFFFFF);

  // Permukaan gelap (mis. tombol solid).
  static const solid = Color(0xFF221F1B);
  static const solidText = Color(0xFFFAF7F3);
  static const solidMuted = Color(0xADFAF7F3);

  static const putih = Color(0xFFFFFFFF);
}

/// Tema ForUI aplikasi, dibangun di atas tema `neutral` lalu warna diganti
/// dengan palet Bawaslu.
FThemeData temaBawaslu() {
  final dasar = FTheme.neutral.light.touch;
  return FThemeData(
    touch: true,
    debugLabel: 'Bawaslu Light',
    colors: dasar.colors.copyWith(
      primary: Warna.blue,
      primaryForeground: Warna.putih,
      background: Warna.canvas,
      foreground: Warna.ink,
      card: Warna.card,
      border: Warna.line,
      secondary: Warna.surface,
      secondaryForeground: Warna.ink2,
      muted: Warna.surface,
      mutedForeground: Warna.muted,
      destructive: Warna.redSolid,
      destructiveForeground: Warna.putih,
      error: Warna.red,
      errorForeground: Warna.putih,
    ),
  );
}
