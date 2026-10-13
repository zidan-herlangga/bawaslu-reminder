/// Konfigurasi runtime yang diisi lewat `--dart-define`.
///
/// Nilai rahasia tidak pernah ditulis di kode. Saat menjalankan atau membangun,
/// lewatkan lewat berkas dart-define, misalnya:
///
/// ```shell
/// flutter run --dart-define-from-file=dart_define.json
/// ```
///
/// Isi `dart_define.json` (jangan di-commit):
/// ```json
/// {
///   "SUPABASE_URL": "https://xxxx.supabase.co",
///   "SUPABASE_ANON_KEY": "eyJ...",
///   "API_ORIGIN": "https://bawasagenda.vercel.app"
/// }
/// ```
///
/// `SUPABASE_URL`/`SUPABASE_ANON_KEY` memakai nilai yang sama dengan
/// `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` di berkas `.env` web. Anon key
/// memang kunci publik (dilindungi RLS); jangan pakai service role key di app.
class Env {
  const Env._();

  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  /// Origin backend Vercel (fungsi di folder `api/`).
  static const String apiOrigin = String.fromEnvironment('API_ORIGIN');

  static bool get adaSupabase => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
