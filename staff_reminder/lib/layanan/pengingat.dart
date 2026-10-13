import 'dart:convert';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';
import 'supabase.dart';

/// Klien untuk endpoint `api/notify.js` — tombol "Ingatkan".
///
/// Mengirim pengingat push untuk satu jadwal ke seluruh staf yang relevan.
/// Backend memverifikasi sesi lewat Bearer token dan hanya mengizinkan pembuat
/// jadwal yang mengirim, jadi app tidak perlu tahu daftar penerimanya.
class Pengingat {
  Pengingat._();

  /// Kirim pengingat untuk [scheduleId]. Mengembalikan kalimat ringkas hasil
  /// untuk ditampilkan ke pengguna. Melempar [Exception] bila gagal.
  static Future<String> kirim(String scheduleId) async {
    final origin = Env.apiOrigin;
    if (origin.isEmpty) {
      throw Exception('Alamat backend (API_ORIGIN) belum dikonfigurasi.');
    }

    final klienSupabase = supabase;
    if (klienSupabase == null) {
      throw Exception('Sesi tidak ditemukan. Silakan masuk kembali.');
    }

    final token = await _tokenSegar(klienSupabase);
    if (token == null || token.isEmpty) {
      throw Exception('Sesi berakhir. Silakan keluar lalu masuk kembali.');
    }

    final klien = HttpClient();
    try {
      final permintaan = await klien.postUrl(Uri.parse('$origin/api/notify'));
      permintaan.headers.contentType = ContentType.json;
      permintaan.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      permintaan.write(jsonEncode({'scheduleId': scheduleId}));

      final balasan = await permintaan.close();
      final teks = await balasan.transform(utf8.decoder).join();
      final Map<String, dynamic> data = teks.isEmpty
          ? const {}
          : Map<String, dynamic>.from(jsonDecode(teks) as Map);

      if (balasan.statusCode == 401) {
        throw Exception('Sesi berakhir. Silakan keluar lalu masuk kembali.');
      }
      if (balasan.statusCode >= 400) {
        throw Exception(
          data['error']?.toString() ??
              'Gagal mengirim pengingat (${balasan.statusCode}).',
        );
      }
      return _ringkas(data);
    } finally {
      klien.close(force: true);
    }
  }

  /// Ambil access token yang masih berlaku.
  ///
  /// Pengingat dikirim lewat [HttpClient] mentah, bukan klien Supabase, jadi
  /// request ini tidak memicu penyegaran token otomatis seperti query biasa.
  /// Bila sesi sudah kedaluwarsa (mis. app lama di latar belakang), token lama
  /// ditolak backend dengan 401. Karena itu kita segarkan dulu di sini.
  static Future<String?> _tokenSegar(SupabaseClient klien) async {
    try {
      final hasil = await klien.auth.refreshSession();
      final token = hasil.session?.accessToken;
      if (token != null && token.isNotEmpty) return token;
    } catch (_) {
      // Jatuh ke sesi tersimpan sebagai upaya terakhir.
    }
    return klien.auth.currentSession?.accessToken;
  }

  static String _ringkas(Map<String, dynamic> data) {
    final terkirim = (data['terkirim'] as num?)?.toInt() ?? 0;
    final push = (data['push'] as num?)?.toInt() ?? 0;
    final catatan = _catatan(data['catatan']);

    if (terkirim == 0) {
      return catatan.isNotEmpty ? catatan : 'Tidak ada penerima yang perlu diberi tahu.';
    }

    final dasar = push > 0
        ? 'Pengingat dikirim ke $terkirim staf ($push perangkat).'
        : 'Pengingat dicatat untuk $terkirim staf, tetapi belum sampai ke perangkat.';
    return catatan.isNotEmpty ? '$dasar $catatan' : dasar;
  }

  static String _catatan(Object? nilai) {
    if (nilai == null) return '';
    if (nilai is List) {
      return nilai.where((e) => e != null).map((e) => e.toString()).join(' ');
    }
    return nilai.toString();
  }
}
