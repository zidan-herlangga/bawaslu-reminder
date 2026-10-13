import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../konstanta/opsi.dart';
import '../layanan/supabase.dart';
import '../tema/warna.dart';

/// Layar daftar akun memakai Supabase Auth (email + kata sandi).
///
/// Alurnya sengaja sama dengan halaman `/register` di web: buat akun lewat
/// `signUp`, lalu tulis baris `profiles` sendiri selagi sesi masih aktif.
/// Bila "Confirm email" di Supabase menyala, `signUp` tidak mengembalikan
/// sesi sehingga baris profil tidak bisa ditulis; kasus itu diberi pesan
/// khusus supaya pengelola tahu harus mematikan opsi tersebut.
class LayarDaftar extends StatefulWidget {
  const LayarDaftar({super.key});

  @override
  State<LayarDaftar> createState() => _LayarDaftarState();
}

class _LayarDaftarState extends State<LayarDaftar> {
  static final RegExp _polaEmail = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  final _nama = TextEditingController();
  final _email = TextEditingController();
  final _sandi = TextEditingController();
  String? _divisi;
  String? _jabatan;

  bool _memuat = false;
  String? _galat;
  String? _galatNama;
  String? _galatEmail;
  String? _galatSandi;
  String? _galatDivisi;
  String? _galatJabatan;

  @override
  void dispose() {
    _nama.dispose();
    _email.dispose();
    _sandi.dispose();
    super.dispose();
  }

  /// Terjemahkan galat Supabase/tulis profil menjadi kalimat yang ramah.
  String _pesanGalat(Object e) {
    final pesan = (e is AuthException) ? e.message : e.toString();
    final rendah = pesan.toLowerCase();

    if (pesan == 'EMAIL_CONFIRMATION_REQUIRED') {
      return 'Konfirmasi email masih aktif di Supabase. Nonaktifkan di '
          'Authentication > Settings > "Confirm email", lalu daftar ulang '
          'agar profil tersimpan otomatis.';
    }
    if (pesan == 'PROFILE_WRITE_FAILED') {
      return 'Gagal menyimpan profil. Pastikan supabase/schema.sql sudah '
          'dijalankan di SQL Editor Supabase.';
    }
    if (rendah.contains('already registered') ||
        rendah.contains('already been registered')) {
      return 'Email ini sudah terdaftar. Silakan masuk.';
    }
    if (rendah.contains('password')) {
      return 'Kata sandi terlalu lemah. Gunakan minimal '
          '${Opsi.panjangMinimalSandi} karakter.';
    }
    if (rendah.contains('valid email') || rendah.contains('validate email')) {
      return 'Format email tidak valid.';
    }
    if (rendah.contains('signups not allowed')) {
      return 'Pendaftaran dinonaktifkan di Supabase > Authentication > Settings.';
    }
    if (rendah.contains('rate limit') || rendah.contains('too many')) {
      return 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
    }
    return pesan.isEmpty ? 'Terjadi kesalahan. Silakan coba lagi.' : pesan;
  }

  bool _validasi() {
    final nama = _nama.text.trim();
    final email = _email.text.trim();
    final sandi = _sandi.text;

    setState(() {
      _galatNama = nama.isEmpty ? 'Nama lengkap wajib diisi.' : null;
      _galatEmail = email.isEmpty
          ? 'Email wajib diisi.'
          : (!_polaEmail.hasMatch(email) ? 'Format email tidak valid.' : null);
      _galatSandi = sandi.isEmpty
          ? 'Kata sandi wajib diisi.'
          : (sandi.length < Opsi.panjangMinimalSandi
              ? 'Kata sandi minimal ${Opsi.panjangMinimalSandi} karakter.'
              : null);
      _galatDivisi = _divisi == null ? 'Divisi wajib dipilih.' : null;
      _galatJabatan = _jabatan == null ? 'Jabatan wajib dipilih.' : null;
    });

    return _galatNama == null &&
        _galatEmail == null &&
        _galatSandi == null &&
        _galatDivisi == null &&
        _galatJabatan == null;
  }

  Future<void> _daftar() async {
    final db = supabase;
    if (db == null) {
      setState(() => _galat = 'Supabase belum dikonfigurasi (dart-define kosong).');
      return;
    }
    if (!_validasi()) return;

    final email = _email.text.trim().toLowerCase();
    final nama = _nama.text.trim();

    setState(() {
      _memuat = true;
      _galat = null;
    });

    try {
      final hasil = await db.auth.signUp(
        email: email,
        password: _sandi.text,
        data: {'nama_lengkap': nama, 'divisi': _divisi, 'jabatan': _jabatan},
      );

      // Tanpa sesi artinya "Confirm email" masih aktif; profil belum bisa ditulis.
      if (hasil.session == null) {
        throw Exception('EMAIL_CONFIRMATION_REQUIRED');
      }

      final pengguna = hasil.user;
      if (pengguna == null) throw Exception('PROFILE_WRITE_FAILED');

      await db.from('profiles').insert({
        'id': pengguna.id,
        'nama_lengkap': nama,
        'email': email,
        'divisi': _divisi,
        'jabatan': _jabatan,
        'role_akses': 'Staf',
        'status_akun': 'Aktif',
      });

      // Keluar lagi supaya pengguna masuk eksplisit dengan akun barunya.
      await db.auth.signOut();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pendaftaran berhasil. Silakan masuk.')),
      );
      context.go('/masuk');
    } catch (e) {
      if (mounted) setState(() => _galat = _pesanGalat(e));
    } finally {
      if (mounted) setState(() => _memuat = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FScaffold(
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Warna.card,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Warna.line),
                    ),
                    child: Column(
                      children: [
                        Image.asset('assets/logo-mark.png', height: 66, fit: BoxFit.contain),
                        const SizedBox(height: 18),
                        const Text(
                          'Pengingat Jadwal',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: Warna.ink,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Bawaslu Bekasi Kota',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: Warna.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Buat Akun Baru',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Warna.ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Lengkapi data berikut untuk membuat akun internal.',
                    style: TextStyle(color: Warna.muted, fontSize: 13),
                  ),
                  const SizedBox(height: 20),
                  FTextField(
                    label: const Text('Nama lengkap'),
                    hint: 'Nama sehari-hari',
                    control: FTextFieldControl.managed(controller: _nama),
                  ),
                  _GalatField(_galatNama),
                  const SizedBox(height: 16),
                  FTextField(
                    label: const Text('Email'),
                    hint: 'nama@contoh.go.id',
                    keyboardType: TextInputType.emailAddress,
                    control: FTextFieldControl.managed(controller: _email),
                  ),
                  _GalatField(_galatEmail),
                  const SizedBox(height: 16),
                  FTextField(
                    label: const Text('Kata sandi'),
                    hint: 'Minimal ${Opsi.panjangMinimalSandi} karakter',
                    obscureText: true,
                    control: FTextFieldControl.managed(controller: _sandi),
                  ),
                  _GalatField(_galatSandi),
                  const SizedBox(height: 16),
                  _PilihField(
                    label: 'Divisi',
                    nilai: _divisi,
                    pilihan: Opsi.divisi,
                    onUbah: (v) => setState(() {
                      _divisi = v;
                      _galatDivisi = null;
                    }),
                  ),
                  _GalatField(_galatDivisi),
                  const SizedBox(height: 16),
                  _PilihField(
                    label: 'Jabatan',
                    nilai: _jabatan,
                    pilihan: Opsi.jabatan,
                    onUbah: (v) => setState(() {
                      _jabatan = v;
                      _galatJabatan = null;
                    }),
                  ),
                  _GalatField(_galatJabatan),
                  if (_galat != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Warna.red50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Warna.red100),
                      ),
                      child: Text(
                        _galat!,
                        style: const TextStyle(color: Warna.red, fontSize: 12.5),
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  FButton(
                    onPress: _memuat ? null : _daftar,
                    child: Text(_memuat ? 'Mendaftarkan...' : 'Daftar Akun'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Sudah punya akun?',
                        style: TextStyle(color: Warna.muted, fontSize: 13),
                      ),
                      TextButton(
                        onPressed: _memuat ? null : () => context.go('/masuk'),
                        child: const Text('Masuk di sini'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Teks galat kecil di bawah sebuah bidang.
class _GalatField extends StatelessWidget {
  const _GalatField(this.pesan);

  final String? pesan;

  @override
  Widget build(BuildContext context) {
    if (pesan == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 6, left: 4),
      child: Text(
        pesan!,
        style: const TextStyle(color: Warna.red, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Pemilih satu nilai dari daftar, seragam dengan layar Akun.
class _PilihField extends StatelessWidget {
  const _PilihField({
    required this.label,
    required this.nilai,
    required this.pilihan,
    required this.onUbah,
  });

  final String label;
  final String? nilai;
  final List<String> pilihan;
  final ValueChanged<String?> onUbah;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        isDense: true,
        filled: true,
        fillColor: Warna.card,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Warna.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Warna.blue, width: 1.6),
        ),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          value: nilai != null && pilihan.contains(nilai) ? nilai : null,
          hint: const Text('Pilih', style: TextStyle(color: Warna.muted, fontSize: 14)),
          icon: const Icon(Icons.expand_more_rounded, color: Warna.muted),
          items: [
            for (final p in pilihan)
              DropdownMenuItem<String>(
                value: p,
                child: Text(
                  Opsi.singkatDivisi(p),
                  style: const TextStyle(color: Warna.ink, fontSize: 13.5),
                ),
              ),
          ],
          onChanged: onUbah,
        ),
      ),
    );
  }
}
