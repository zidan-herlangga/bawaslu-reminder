import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../layanan/supabase.dart';
import '../tema/warna.dart';

/// Layar masuk memakai Supabase Auth (email + kata sandi).
class LayarMasuk extends StatefulWidget {
  const LayarMasuk({super.key});

  @override
  State<LayarMasuk> createState() => _LayarMasukState();
}

class _LayarMasukState extends State<LayarMasuk> {
  final _email = TextEditingController();
  final _sandi = TextEditingController();
  bool _memuat = false;
  String? _galat;

  @override
  void dispose() {
    _email.dispose();
    _sandi.dispose();
    super.dispose();
  }

  Future<void> _masuk() async {
    final db = supabase;
    if (db == null) {
      setState(() => _galat = 'Supabase belum dikonfigurasi (dart-define kosong).');
      return;
    }

    setState(() {
      _memuat = true;
      _galat = null;
    });

    try {
      await db.auth.signInWithPassword(
        email: _email.text.trim(),
        password: _sandi.text,
      );
      if (mounted) context.go('/');
    } on AuthException catch (e) {
      if (mounted) setState(() => _galat = e.message);
    } catch (_) {
      if (mounted) setState(() => _galat = 'Gagal masuk. Periksa koneksi lalu coba lagi.');
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
                    'Masuk',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Warna.ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Masuk untuk mengelola jadwal dan pengingat.',
                    style: TextStyle(color: Warna.muted, fontSize: 13),
                  ),
                  const SizedBox(height: 20),
                  FTextField(
                    label: const Text('Email'),
                    hint: 'Masukkan Email',
                    keyboardType: TextInputType.emailAddress,
                    control: FTextFieldControl.managed(controller: _email),
                  ),
                  const SizedBox(height: 16),
                  FTextField(
                    label: const Text('Kata sandi'),
                    hint: 'Masukkan Kata Sandi',
                    obscureText: true,
                    control: FTextFieldControl.managed(controller: _sandi),
                    onSubmit: (_) => _masuk(),
                  ),
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
                    onPress: _memuat ? null : _masuk,
                    child: Text(_memuat ? 'Memproses...' : 'Masuk'),
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
