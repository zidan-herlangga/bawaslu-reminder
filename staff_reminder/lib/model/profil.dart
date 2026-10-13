/// Profil pengguna (`profiles`).
class Profil {
  const Profil({
    this.namaLengkap,
    this.divisi,
    this.jabatan,
    this.roleAkses,
    this.statusAkun,
  });

  final String? namaLengkap;
  final String? divisi;
  final String? jabatan;
  final String? roleAkses;
  final String? statusAkun;

  factory Profil.dariJson(Map<String, dynamic> json) {
    return Profil(
      namaLengkap: json['nama_lengkap']?.toString(),
      divisi: json['divisi']?.toString(),
      jabatan: json['jabatan']?.toString(),
      roleAkses: json['role_akses']?.toString(),
      statusAkun: json['status_akun']?.toString(),
    );
  }

  /// Profil cadangan dari metadata pengguna Supabase Auth.
  factory Profil.dariMetadata(Map<String, dynamic>? meta) {
    if (meta == null) return const Profil();
    return Profil(
      namaLengkap: meta['nama_lengkap']?.toString() ?? meta['full_name']?.toString(),
      divisi: meta['divisi']?.toString(),
      jabatan: meta['jabatan']?.toString(),
      roleAkses: meta['role_akses']?.toString(),
    );
  }
}
