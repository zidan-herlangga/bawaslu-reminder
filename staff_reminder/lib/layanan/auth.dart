import 'notifikasi.dart';
import 'supabase.dart';

/// Status autentikasi ringkas untuk kebutuhan routing dan layar akun.
class Auth {
  const Auth._();

  /// Sudah punya sesi aktif?
  static bool get sudahMasuk => supabase?.auth.currentSession != null;

  /// Email pengguna yang sedang masuk, kalau ada.
  static String? get email => supabase?.auth.currentUser?.email;

  /// Id pengguna yang sedang masuk, kalau ada. Dipakai untuk menentukan
  /// kepemilikan jadwal (hanya pembuat yang boleh mengubah/menghapus).
  static String? get uid => supabase?.auth.currentUser?.id;

  /// Keluar dari sesi saat ini.
  static Future<void> keluar() async {
    // Token notifikasi dihapus lebih dulu: policy RLS hanya mengizinkan
    // penghapusan selagi sesi masih aktif.
    await Notifikasi.hapusToken();
    await supabase?.auth.signOut();
  }
}
