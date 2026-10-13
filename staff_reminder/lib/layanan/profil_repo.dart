import '../model/profil.dart';
import 'supabase.dart';

/// Akses tabel `profiles`, dengan cadangan dari metadata pengguna.
class ProfilRepo {
  const ProfilRepo._();

  static Future<Profil> ambil() async {
    final klien = supabase;
    if (klien == null) return const Profil(namaLengkap: 'Staf Bawaslu');

    final pengguna = klien.auth.currentUser;
    if (pengguna == null) return const Profil();

    try {
      final data = await klien
          .from('profiles')
          .select('nama_lengkap, divisi, jabatan, role_akses, status_akun')
          .eq('id', pengguna.id)
          .maybeSingle();

      if (data == null) return Profil.dariMetadata(pengguna.userMetadata);
      return Profil.dariJson(Map<String, dynamic>.from(data));
    } catch (_) {
      return Profil.dariMetadata(pengguna.userMetadata);
    }
  }

  /// Simpan perubahan profil pengguna.
  ///
  /// Memakai UPDATE, bukan upsert. `upsert` diterjemahkan PostgREST menjadi
  /// "insert ... on conflict do update", dan baris percobaan itu diperiksa
  /// terhadap constraint NOT NULL lebih dulu. Karena form tidak mengirim
  /// `email` (NOT NULL tanpa default), jalur insert selalu gagal walau barisnya
  /// sudah ada. UPDATE menghindari masalah itu. Bila baris profil belum ada,
  /// baris lengkap dibuat lewat INSERT dengan email dari akun.
  static Future<void> simpan({
    String? namaLengkap,
    String? divisi,
    String? jabatan,
  }) async {
    final klien = supabase;
    final pengguna = klien?.auth.currentUser;
    if (klien == null || pengguna == null) {
      throw StateError('Backend belum dikonfigurasi atau sesi tidak ditemukan.');
    }

    final nama = (namaLengkap ?? '').trim();
    final div = (divisi ?? '').trim();
    final jab = (jabatan ?? '').trim();
    if (nama.isEmpty || div.isEmpty || jab.isEmpty) {
      throw Exception('Nama, divisi, dan jabatan wajib diisi.');
    }

    final hasil = await klien
        .from('profiles')
        .update({'nama_lengkap': nama, 'divisi': div, 'jabatan': jab})
        .eq('id', pengguna.id)
        .select('id');

    if ((hasil as List).isNotEmpty) return;

    // Belum ada baris profil: buat lengkap (email diambil dari akun).
    await klien.from('profiles').insert({
      'id': pengguna.id,
      'nama_lengkap': nama,
      'email': pengguna.email ?? '',
      'divisi': div,
      'jabatan': jab,
    });
  }
}
