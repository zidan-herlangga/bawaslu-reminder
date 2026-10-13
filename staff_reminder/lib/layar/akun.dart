import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../konstanta/opsi.dart';
import '../layanan/auth.dart';
import '../layanan/profil_repo.dart';
import '../model/profil.dart';
import '../tema/warna.dart';

/// Layar Akun: profil pengguna, penyuntingan data, dan tombol keluar.
class LayarAkun extends StatefulWidget {
  const LayarAkun({super.key});

  @override
  State<LayarAkun> createState() => _LayarAkunState();
}

class _LayarAkunState extends State<LayarAkun> {
  final _nama = TextEditingController();
  Profil? _profil;
  String? _divisi;
  String? _jabatan;
  bool _memuat = true;
  bool _menyimpan = false;
  bool _ubah = false;

  @override
  void initState() {
    super.initState();
    _muat();
  }

  @override
  void dispose() {
    _nama.dispose();
    super.dispose();
  }

  Future<void> _muat() async {
    final p = await ProfilRepo.ambil();
    if (!mounted) return;
    setState(() {
      _profil = p;
      _nama.text = p.namaLengkap ?? '';
      _divisi = p.divisi;
      _jabatan = p.jabatan;
      _memuat = false;
    });
  }

  Future<void> _simpan() async {
    setState(() => _menyimpan = true);
    try {
      await ProfilRepo.simpan(
        namaLengkap: _nama.text.trim(),
        divisi: _divisi,
        jabatan: _jabatan,
      );
      if (!mounted) return;
      setState(() {
        _profil = Profil(
          namaLengkap: _nama.text.trim(),
          divisi: _divisi,
          jabatan: _jabatan,
          roleAkses: _profil?.roleAkses,
          statusAkun: _profil?.statusAkun,
        );
        _ubah = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil disimpan.')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal menyimpan: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _menyimpan = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_memuat) {
      return const Center(child: CircularProgressIndicator(color: Warna.blue));
    }

    final nama = _profil?.namaLengkap ?? 'Pengguna';
    final inisial = nama.trim().isEmpty ? '?' : nama.trim()[0].toUpperCase();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Warna.card,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: Warna.line),
          ),
          child: Column(
            children: [
              CircleAvatar(
                radius: 34,
                backgroundColor: Warna.blue,
                child: Text(
                  inisial,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                nama,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Warna.ink,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                Auth.email ?? 'Belum masuk',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Warna.muted, fontSize: 12.5),
              ),
              const SizedBox(height: 12),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (_jabatan != null && _jabatan!.isNotEmpty)
                    _Pil(teks: _jabatan!, latar: Warna.blue50, warna: Warna.blue700),
                  if (_divisi != null && _divisi!.isNotEmpty)
                    _Pil(
                      teks: Opsi.singkatDivisi(_divisi),
                      latar: Warna.surface,
                      warna: Warna.muted,
                    ),
                  if ((_profil?.roleAkses ?? '').isNotEmpty)
                    _Pil(
                      teks: 'Akses: ${_profil!.roleAkses}',
                      latar: Warna.amber50,
                      warna: Warna.amber800,
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            const Expanded(
              child: Text(
                'DATA PROFIL',
                style: TextStyle(
                  color: Warna.ink,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                ),
              ),
            ),
            TextButton(
              onPressed: () => setState(() => _ubah = !_ubah),
              child: Text(_ubah ? 'Batal' : 'Ubah'),
            ),
          ],
        ),
        if (_ubah) ...[
          FTextField(
            label: const Text('Nama lengkap'),
            control: FTextFieldControl.managed(controller: _nama),
          ),
          const SizedBox(height: 14),
          _PilihField(
            label: 'Divisi',
            nilai: _divisi,
            pilihan: Opsi.divisi,
            onUbah: (v) => setState(() => _divisi = v),
          ),
          const SizedBox(height: 14),
          _PilihField(
            label: 'Jabatan',
            nilai: _jabatan,
            pilihan: Opsi.jabatan,
            onUbah: (v) => setState(() => _jabatan = v),
          ),
          const SizedBox(height: 18),
          FButton(
            onPress: _menyimpan ? null : _simpan,
            child: Text(_menyimpan ? 'Menyimpan...' : 'Simpan profil'),
          ),
          const SizedBox(height: 24),
        ] else ...[
          _BarisInfo(ikon: Icons.badge_rounded, label: 'Jabatan', nilai: _jabatan),
          _BarisInfo(ikon: Icons.apartment_rounded, label: 'Divisi', nilai: _divisi),
          _BarisInfo(
            ikon: Icons.verified_user_rounded,
            label: 'Status akun',
            nilai: _profil?.statusAkun,
          ),
          const SizedBox(height: 24),
        ],
        FButton(
          variant: FButtonVariant.destructive,
          onPress: () async {
            await Auth.keluar();
            if (context.mounted) context.go('/masuk');
          },
          child: const Text('Keluar'),
        ),
      ],
    );
  }
}

class _Pil extends StatelessWidget {
  const _Pil({required this.teks, required this.latar, required this.warna});

  final String teks;
  final Color latar;
  final Color warna;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: latar,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        teks,
        style: TextStyle(color: warna, fontSize: 11.5, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _BarisInfo extends StatelessWidget {
  const _BarisInfo({required this.ikon, required this.label, required this.nilai});

  final IconData ikon;
  final String label;
  final String? nilai;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        color: Warna.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Warna.line),
      ),
      child: Row(
        children: [
          Icon(ikon, size: 18, color: Warna.muted),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(color: Warna.muted, fontSize: 13)),
          const Spacer(),
          Flexible(
            child: Text(
              (nilai == null || nilai!.isEmpty) ? '-' : nilai!,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: Warna.ink,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

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
