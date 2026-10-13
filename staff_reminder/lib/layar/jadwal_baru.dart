import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../komponen/chip_filter.dart';
import '../konstanta/opsi.dart';
import '../layanan/jadwal_repo.dart';
import '../layanan/profil_repo.dart';
import '../layanan/supabase.dart';
import '../model/profil.dart';
import '../tema/warna.dart';
import '../util/waktu.dart';

/// Ubah exception teknis menjadi pesan yang enak dibaca di form.
String _pesanGalat(Object e) {
  if (e is PostgrestException) return e.message;
  final teks = e.toString();
  for (final p in const ['Exception: ', 'Bad state: ', 'StateError: ']) {
    if (teks.startsWith(p)) return teks.substring(p.length);
  }
  return teks;
}

/// Bentuk satu sesi dalam form. Tanggal dan waktu dipisah agar ramah sentuh.
class _SesiForm {
  _SesiForm({DateTime? tanggal, this.mulai, this.selesai})
      : tanggal = tanggal ?? DateTime.now();

  DateTime tanggal;
  TimeOfDay? mulai;
  TimeOfDay? selesai;
}

/// Form membuat atau mengubah jadwal. Bila [id] diisi, form berjalan dalam
/// mode ubah.
class LayarJadwalBaru extends StatefulWidget {
  const LayarJadwalBaru({super.key, this.id});

  final String? id;

  @override
  State<LayarJadwalBaru> createState() => _LayarJadwalBaruState();
}

class _LayarJadwalBaruState extends State<LayarJadwalBaru> {
  final _judul = TextEditingController();
  final _deskripsi = TextEditingController();

  String _kategori = 'Rapat';
  String _targetMode = 'semua';
  String? _targetDivisi;
  List<_SesiForm> _slots = [_SesiForm()];

  Profil? _profil;
  bool _memuat = true;
  bool _menyimpan = false;
  String? _galat;

  bool get _ubah => widget.id != null;

  @override
  void initState() {
    super.initState();
    _siapkan();
  }

  @override
  void dispose() {
    _judul.dispose();
    _deskripsi.dispose();
    super.dispose();
  }

  Future<void> _siapkan() async {
    _profil = await ProfilRepo.ambil();

    if (_ubah) {
      try {
        final j = await JadwalRepo.ambilSatu(widget.id!);
        if (j != null && mounted) {
          _judul.text = j.judul;
          _deskripsi.text = j.deskripsi ?? '';
          _kategori = Opsi.kategori.contains(j.kategori) ? j.kategori : 'Lainnya';
          if (j.targetDivisi != null && j.targetDivisi!.isNotEmpty) {
            _targetMode = 'divisi';
            _targetDivisi = j.targetDivisi;
          }
          final sesi = j.sesi;
          if (sesi.isNotEmpty) {
            _slots = sesi.map((s) {
              final mulai = s.mulaiDt;
              final selesai = s.selesaiDt;
              return _SesiForm(
                tanggal: mulai ?? DateTime.now(),
                mulai: mulai == null ? null : TimeOfDay.fromDateTime(mulai),
                selesai: selesai == null ? null : TimeOfDay.fromDateTime(selesai),
              );
            }).toList();
          }
        }
      } catch (e) {
        _galat = _pesanGalat(e);
      }
    }

    if (mounted) setState(() => _memuat = false);
  }

  String? _isoDari(DateTime tanggal, TimeOfDay jam) {
    return DateTime(tanggal.year, tanggal.month, tanggal.day, jam.hour, jam.minute)
        .toIso8601String();
  }

  Future<void> _simpan() async {
    final judul = _judul.text.trim();
    if (judul.isEmpty) {
      setState(() => _galat = 'Judul jadwal wajib diisi.');
      return;
    }
    if (_targetMode == 'divisi' && (_targetDivisi == null || _targetDivisi!.isEmpty)) {
      setState(() => _galat = 'Pilih divisi tujuan.');
      return;
    }

    final slotJson = <Map<String, dynamic>>[];
    for (final s in _slots) {
      if (s.mulai == null) continue;
      slotJson.add({
        'mulai': _isoDari(s.tanggal, s.mulai!),
        'selesai': s.selesai == null ? null : _isoDari(s.tanggal, s.selesai!),
      });
    }
    if (slotJson.isEmpty) {
      setState(() => _galat = 'Isi minimal satu waktu mulai.');
      return;
    }

    setState(() {
      _menyimpan = true;
      _galat = null;
    });

    try {
      final pengguna = supabase?.auth.currentUser;
      final nilai = <String, dynamic>{
        'judul': judul,
        'kategori': _kategori,
        'deskripsi': _deskripsi.text.trim(),
        'status': 'Aktif',
        'target_divisi': _targetMode == 'divisi' ? _targetDivisi : null,
        'slots': slotJson,
        'waktu_mulai': slotJson.first['mulai'],
        'waktu_selesai': slotJson.first['selesai'],
      };

      if (!_ubah) {
        // `pembuat_nama` dan `pembuat_divisi` NOT NULL di skema, jadi jangan
        // pernah mengirim string kosong: pakai cadangan yang pasti terisi.
        final nama = (_profil?.namaLengkap ?? '').trim();
        final divisi = (_profil?.divisi ?? '').trim();
        nilai['pembuat_id'] = pengguna?.id;
        nilai['pembuat_nama'] =
            nama.isNotEmpty ? nama : (pengguna?.email ?? 'Staf Bawaslu');
        nilai['pembuat_divisi'] = divisi.isNotEmpty ? divisi : 'Belum diatur';
      }

      await JadwalRepo.simpan(nilai, id: widget.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_ubah ? 'Jadwal diperbarui.' : 'Jadwal dibuat.')),
      );
      context.pop();
    } catch (e) {
      if (mounted) setState(() => _galat = _pesanGalat(e));
    } finally {
      if (mounted) setState(() => _menyimpan = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FScaffold(
      header: FHeader.nested(
        title: Text(_ubah ? 'Ubah Jadwal' : 'Jadwal Baru'),
        prefixes: [
          FHeaderAction(
            icon: const Icon(FLucideIcons.arrowLeft),
            onPress: () => context.pop(),
          ),
        ],
      ),
      child: _memuat
          ? const Center(child: CircularProgressIndicator(color: Warna.blue))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
              children: [
                FTextField(
                  label: const Text('Judul'),
                  hint: 'Mis. Rapat koordinasi pengawasan',
                  control: FTextFieldControl.managed(controller: _judul),
                ),
                const SizedBox(height: 16),
                const _Label('Kategori'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final k in Opsi.kategori)
                      ChipFilter(
                        label: k,
                        aktif: _kategori == k,
                        onTap: () => setState(() => _kategori = k),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                const _Label('Ditujukan untuk'),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: ChipFilter(
                        label: 'Semua staf',
                        aktif: _targetMode == 'semua',
                        onTap: () => setState(() => _targetMode = 'semua'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ChipFilter(
                        label: 'Divisi tertentu',
                        aktif: _targetMode == 'divisi',
                        onTap: () => setState(() => _targetMode = 'divisi'),
                      ),
                    ),
                  ],
                ),
                if (_targetMode == 'divisi') ...[
                  const SizedBox(height: 12),
                  _PilihDivisi(
                    nilai: _targetDivisi,
                    onUbah: (v) => setState(() => _targetDivisi = v),
                  ),
                ],
                const SizedBox(height: 20),
                Row(
                  children: [
                    const _Label('Waktu'),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () => setState(() => _slots.add(_SesiForm())),
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Sesi'),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                for (var i = 0; i < _slots.length; i++) ...[
                  _KartuSesi(
                    sesi: _slots[i],
                    bisaHapus: _slots.length > 1,
                    onUbah: () => setState(() {}),
                    onHapus: () => setState(() => _slots.removeAt(i)),
                  ),
                  const SizedBox(height: 12),
                ],
                const SizedBox(height: 4),
                FTextField(
                  label: const Text('Keterangan'),
                  hint: 'Opsional',
                  maxLines: 3,
                  control: FTextFieldControl.managed(controller: _deskripsi),
                ),
                if (_galat != null) ...[
                  const SizedBox(height: 16),
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
                  onPress: _menyimpan ? null : _simpan,
                  child: Text(_menyimpan
                      ? 'Menyimpan...'
                      : (_ubah ? 'Simpan perubahan' : 'Buat jadwal')),
                ),
              ],
            ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.teks);

  final String teks;

  @override
  Widget build(BuildContext context) {
    return Text(
      teks,
      style: const TextStyle(
        color: Warna.ink,
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _KartuSesi extends StatelessWidget {
  const _KartuSesi({
    required this.sesi,
    required this.bisaHapus,
    required this.onUbah,
    required this.onHapus,
  });

  final _SesiForm sesi;
  final bool bisaHapus;
  final VoidCallback onUbah;
  final VoidCallback onHapus;

  Future<void> _pilihTanggal(BuildContext context) async {
    final hasil = await showDatePicker(
      context: context,
      initialDate: sesi.tanggal,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (hasil != null) {
      sesi.tanggal = hasil;
      onUbah();
    }
  }

  Future<void> _pilihJam(BuildContext context, bool mulai) async {
    final awal = (mulai ? sesi.mulai : sesi.selesai) ??
        TimeOfDay(hour: mulai ? 8 : 9, minute: 0);
    final hasil = await showTimePicker(context: context, initialTime: awal);
    if (hasil != null) {
      if (mulai) {
        sesi.mulai = hasil;
      } else {
        sesi.selesai = hasil;
      }
      onUbah();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Warna.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Warna.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.event_rounded, size: 16, color: Warna.muted),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  Waktu.tanggalPanjang(sesi.tanggal.toIso8601String()),
                  style: const TextStyle(
                    color: Warna.ink,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (bisaHapus)
                IconButton(
                  onPressed: onHapus,
                  icon: const Icon(Icons.close_rounded, size: 18),
                  color: Warna.red,
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Hapus sesi',
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _TombolWaktu(
                  label: 'Mulai',
                  nilai: sesi.mulai,
                  onTap: () => _pilihJam(context, true),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _TombolWaktu(
                  label: 'Selesai',
                  nilai: sesi.selesai,
                  onTap: () => _pilihJam(context, false),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _pilihTanggal(context),
              style: OutlinedButton.styleFrom(
                foregroundColor: Warna.blue,
                side: const BorderSide(color: Warna.line),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.calendar_month_rounded, size: 17),
              label: const Text('Ubah tanggal', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}

class _TombolWaktu extends StatelessWidget {
  const _TombolWaktu({required this.label, required this.nilai, required this.onTap});

  final String label;
  final TimeOfDay? nilai;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final teks = nilai == null
        ? '--:--'
        : '${nilai!.hour.toString().padLeft(2, '0')}:${nilai!.minute.toString().padLeft(2, '0')}';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Warna.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Warna.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: Warna.muted, fontSize: 11)),
            const SizedBox(height: 2),
            Text(
              teks,
              style: const TextStyle(
                color: Warna.ink,
                fontSize: 15,
                fontWeight: FontWeight.w800,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PilihDivisi extends StatelessWidget {
  const _PilihDivisi({required this.nilai, required this.onUbah});

  final String? nilai;
  final ValueChanged<String?> onUbah;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(
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
          value: nilai,
          hint: const Text('Pilih divisi', style: TextStyle(color: Warna.muted, fontSize: 14)),
          icon: const Icon(Icons.expand_more_rounded, color: Warna.muted),
          items: [
            for (final d in Opsi.divisi)
              DropdownMenuItem<String>(
                value: d,
                child: Text(
                  Opsi.singkatDivisi(d),
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
