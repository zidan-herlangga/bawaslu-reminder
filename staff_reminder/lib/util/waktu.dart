import 'package:intl/intl.dart';

/// Pemformatan tanggal dan jam dalam bahasa Indonesia.
///
/// Cermin dari `src/lib/formatWaktu.js` (web) supaya format jam dan tanggal
/// tidak pernah berbeda antar halaman.
class Waktu {
  const Waktu._();

  static final DateFormat _jam = DateFormat('HH:mm');
  static final DateFormat _tanggalPanjang = DateFormat('EEEE, d MMMM y', 'id_ID');
  static final DateFormat _tanggalPendek = DateFormat('EEE, d MMM y', 'id_ID');
  static final DateFormat _bulanTahun = DateFormat('MMMM y', 'id_ID');
  static final DateFormat _waktuLengkap = DateFormat('EEEE, d MMMM y • HH:mm', 'id_ID');

  static DateTime? _parse(Object? nilai) {
    if (nilai == null) return null;
    if (nilai is DateTime) return nilai;
    return DateTime.tryParse(nilai.toString());
  }

  /// `09:05`
  static String jam(Object? nilai) {
    final d = _parse(nilai);
    return d == null ? '' : _jam.format(d);
  }

  /// `Senin, 5 Januari 2026`
  static String tanggalPanjang(Object? nilai) {
    final d = _parse(nilai);
    return d == null ? '' : _tanggalPanjang.format(d);
  }

  /// `Sen, 5 Jan 2026`
  static String tanggalPendek(Object? nilai) {
    final d = _parse(nilai);
    return d == null ? '' : _tanggalPendek.format(d);
  }

  /// `Januari 2026`
  static String bulanTahun(Object? nilai) {
    final d = _parse(nilai);
    return d == null ? '' : _bulanTahun.format(d);
  }

  /// `Senin, 5 Januari 2026 • 09:05`
  static String lengkap(Object? nilai) {
    final d = _parse(nilai);
    return d == null ? '' : _waktuLengkap.format(d);
  }

  /// `2026-01-05` untuk sebuah [DateTime].
  static String hari(DateTime tanggal) {
    final m = tanggal.month.toString().padLeft(2, '0');
    final d = tanggal.day.toString().padLeft(2, '0');
    return '${tanggal.year}-$m-$d';
  }

  /// `2026-01-05` untuk ISO apa pun; kosong bila tidak valid.
  static String hariKey(Object? nilai) {
    final d = _parse(nilai);
    return d == null ? '' : hari(d);
  }

  /// "2 hari lagi", "3 jam 5 menit lagi", atau "Sudah dimulai".
  static String sisa(int targetMs, int nowMs) {
    final diff = targetMs - nowMs;
    if (diff <= 0) return 'Sudah dimulai';

    final totalMenit = diff ~/ 60000;
    final hari = totalMenit ~/ 1440;
    final jam = (totalMenit % 1440) ~/ 60;
    final menit = totalMenit % 60;

    if (hari > 0) return '$hari hari lagi';
    if (jam > 0) return '$jam jam $menit menit lagi';
    if (menit > 0) return '$menit menit lagi';
    return 'Kurang dari 1 menit';
  }
}
