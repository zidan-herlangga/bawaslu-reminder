import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../komponen/lencana.dart';
import '../komponen/kosong.dart';
import '../konstanta/opsi.dart';
import '../layanan/auth.dart';
import '../layanan/jadwal_repo.dart';
import '../layanan/pengingat.dart';
import '../model/jadwal.dart';
import '../tema/kategori.dart';
import '../tema/warna.dart';
import '../util/slot.dart';
import '../util/waktu.dart';

/// Detail lengkap satu jadwal.
class LayarJadwalDetail extends StatefulWidget {
  const LayarJadwalDetail({super.key, required this.id});

  final String id;

  @override
  State<LayarJadwalDetail> createState() => _LayarJadwalDetailState();
}

class _LayarJadwalDetailState extends State<LayarJadwalDetail> {
  Jadwal? _jadwal;
  bool _memuat = true;
  String? _error;
  bool _hapusBusy = false;
  bool _ingatBusy = false;

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    setState(() {
      _memuat = true;
      _error = null;
    });
    try {
      final j = await JadwalRepo.ambilSatu(widget.id);
      if (!mounted) return;
      setState(() {
        _jadwal = j;
        _memuat = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _memuat = false;
      });
    }
  }

  Future<void> _konfirmasiHapus() async {
    final j = _jadwal;
    if (j == null) return;

    final setuju = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hapus jadwal?'),
        content: Text(
          '"${j.judul}" akan dihapus untuk semua staf. Tindakan ini tidak bisa dibatalkan.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: Warna.redSolid,
              foregroundColor: Colors.white,
            ),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
    if (setuju != true) return;

    setState(() => _hapusBusy = true);
    try {
      await JadwalRepo.hapus(j.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Jadwal dihapus.')),
      );
      context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal menghapus: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _hapusBusy = false);
    }
  }

  Future<void> _kirimPengingat() async {
    final j = _jadwal;
    if (j == null) return;
    setState(() => _ingatBusy = true);
    try {
      final pesan = await Pengingat.kirim(j.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(pesan)));
    } catch (e) {
      if (!mounted) return;
      final teks =
          e.toString().replaceFirst(RegExp(r'^(Exception|Bad state|StateError):\s*'), '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal mengirim pengingat: $teks')),
      );
    } finally {
      if (mounted) setState(() => _ingatBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FScaffold(
      header: FHeader.nested(
        title: const Text('Detail Jadwal'),
        prefixes: [
          FHeaderAction(
            icon: const Icon(FLucideIcons.arrowLeft),
            onPress: () => context.pop(),
          ),
        ],
      ),
      child: _memuat
          ? const Center(child: CircularProgressIndicator(color: Warna.blue))
          : _error != null
              ? Padding(
                  padding: const EdgeInsets.all(16),
                  child: Kosong(
                    ikon: Icons.cloud_off_rounded,
                    judul: 'Gagal memuat',
                    pesan: _error!,
                  ),
                )
              : _jadwal == null
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: Kosong(
                        ikon: Icons.search_off_rounded,
                        judul: 'Jadwal tidak ditemukan',
                        pesan: 'Jadwal ini mungkin sudah dihapus.',
                      ),
                    )
                  : _isi(_jadwal!),
    );
  }

  Widget _isi(Jadwal j) {
    final gaya = gayaKategori(j.kategori);
    final sesi = Slot.urut(j.sesi);
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final milikSaya = Auth.uid != null && j.pembuatId == Auth.uid;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        Container(
          decoration: BoxDecoration(
            color: Warna.card,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: Warna.line),
          ),
          clipBehavior: Clip.antiAlias,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(width: 5, color: gaya.aksen),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            Lencana(
                              teks: j.kategori,
                              latar: gaya.latar,
                              warna: gaya.teks,
                              garis: gaya.garis,
                              ikon: gaya.ikon,
                            ),
                            Lencana(
                              teks: j.targetDivisi == null
                                  ? 'Semua staf'
                                  : 'Khusus ${Opsi.singkatDivisi(j.targetDivisi)}',
                              latar: Warna.blue50,
                              warna: Warna.blue700,
                              garis: Warna.blue200,
                            ),
                            if (j.status != 'Aktif')
                              Lencana(
                                teks: j.status,
                                latar: Warna.red50,
                                warna: Warna.red,
                                garis: Warna.red100,
                              ),
                            if (sesi.length > 1) Lencana(teks: '${sesi.length} sesi'),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          j.judul,
                          style: const TextStyle(
                            color: Warna.ink,
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _Bagian(
          judul: 'Waktu',
          icon: Icons.schedule_rounded,
          child: Column(
            children: [
              for (var i = 0; i < sesi.length; i++) ...[
                if (i > 0) const Divider(height: 18, color: Warna.line),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            Waktu.jam(sesi[i].mulai) +
                                (sesi[i].selesai == null
                                    ? ''
                                    : ' - ${Waktu.jam(sesi[i].selesai)}'),
                            style: const TextStyle(
                              color: Warna.ink,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            Waktu.tanggalPanjang(sesi[i].mulai),
                            style: const TextStyle(color: Warna.muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    if (sesi.isEmpty) const SizedBox.shrink(),
                  ],
                ),
              ],
              if (sesi.isEmpty)
                const Text('Belum ada waktu.', style: TextStyle(color: Warna.muted)),
            ],
          ),
        ),
        if ((j.deskripsi ?? '').isNotEmpty) ...[
          const SizedBox(height: 14),
          _Bagian(
            judul: 'Keterangan',
            icon: Icons.notes_rounded,
            child: Text(
              j.deskripsi!,
              style: const TextStyle(color: Warna.ink2, fontSize: 13.5, height: 1.6),
            ),
          ),
        ],
        const SizedBox(height: 14),
        _Bagian(
          judul: 'Pembuat',
          icon: Icons.person_rounded,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                j.pembuatNama ?? '-',
                style: const TextStyle(
                  color: Warna.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                Opsi.singkatDivisi(j.pembuatDivisi),
                style: const TextStyle(color: Warna.muted, fontSize: 12.5),
              ),
              if (j.createdAt != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Dibuat ${Waktu.lengkap(j.createdAt)}',
                  style: const TextStyle(color: Warna.muted, fontSize: 11.5),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 24),
        if (milikSaya) ...[
          FilledButton.icon(
            onPressed: _ingatBusy ? null : _kirimPengingat,
            style: FilledButton.styleFrom(
              backgroundColor: Warna.blue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            icon: const Icon(Icons.notifications_active_rounded, size: 18),
            label: Text(_ingatBusy ? 'Mengirim...' : 'Kirim pengingat sekarang'),
          ),
          const SizedBox(height: 10),
          FButton(
            onPress: () => context.push('/jadwal/${j.id}/edit'),
            child: const Text('Ubah jadwal'),
          ),
          const SizedBox(height: 10),
          FButton(
            variant: FButtonVariant.destructive,
            onPress: _hapusBusy ? null : _konfirmasiHapus,
            child: Text(_hapusBusy ? 'Menghapus...' : 'Hapus jadwal'),
          ),
        ] else
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Warna.blue50,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Warna.blue200),
            ),
            child: const Text(
              'Hanya pembuat jadwal ini yang bisa mengubah atau menghapusnya.',
              style: TextStyle(color: Warna.blue700, fontSize: 12.5, height: 1.4),
            ),
          ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            Slot.jadwalSelesai(j, nowMs) ? 'Jadwal ini sudah selesai.' : '',
            style: const TextStyle(color: Warna.muted, fontSize: 11.5),
          ),
        ),
      ],
    );
  }
}

class _Bagian extends StatelessWidget {
  const _Bagian({required this.judul, required this.icon, required this.child});

  final String judul;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Warna.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Warna.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: Warna.blue),
              const SizedBox(width: 7),
              Text(
                judul.toUpperCase(),
                style: const TextStyle(
                  color: Warna.ink,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}
