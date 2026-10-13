import 'dart:async';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../komponen/chip_filter.dart';
import '../komponen/judul_bagian.dart';
import '../komponen/kartu_jadwal.dart';
import '../komponen/kosong.dart';
import '../komponen/waktu_sekarang.dart';
import '../konstanta/opsi.dart';
import '../layanan/auth.dart';
import '../layanan/jadwal_repo.dart';
import '../layanan/pengingat.dart';
import '../layanan/profil_repo.dart';
import '../model/jadwal.dart';
import '../model/profil.dart';
import '../tema/warna.dart';
import '../util/slot.dart';
import '../util/waktu.dart';

/// Layar Beranda: jam, jadwal berikutnya, sapaan, dan daftar jadwal per divisi.
class LayarBeranda extends StatefulWidget {
  const LayarBeranda({super.key});

  @override
  State<LayarBeranda> createState() => _LayarBerandaState();
}

class _LayarBerandaState extends State<LayarBeranda> {
  late Timer _tick;
  int _now = DateTime.now().millisecondsSinceEpoch;

  List<Jadwal>? _jadwal;
  Profil? _profil;
  String? _error;
  String _filterDivisi = '';
  StreamSubscription<List<Jadwal>>? _langganan;
  Timer? _realtimeTimer;
  String? _mengirimId;

  @override
  void initState() {
    super.initState();
    _muat();
    _mulaiRealtime();
    _tick = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!mounted) return;
      setState(() => _now = DateTime.now().millisecondsSinceEpoch);
      _segarkan();
    });
  }

  @override
  void dispose() {
    _langganan?.cancel();
    _realtimeTimer?.cancel();
    _tick.cancel();
    super.dispose();
  }

  /// Berlangganan realtime; bila gagal (mis. jaringan buruk) coba lagi tanpa
  /// menyembunyikan data yang sudah dimuat.
  void _mulaiRealtime() {
    _langganan?.cancel();
    _langganan = JadwalRepo.streamSemua().listen(
      (data) {
        if (!mounted) return;
        setState(() {
          _jadwal = data;
          _error = null;
        });
      },
      onError: (Object _) {
        _langganan?.cancel();
        if (mounted) {
          _realtimeTimer = Timer(const Duration(seconds: 6), _mulaiRealtime);
        }
      },
    );
  }

  /// Penyegaran senyap (tanpa memunculkan galat) sebagai cadangan bila realtime
  /// tidak tersedia.
  Future<void> _segarkan() async {
    try {
      final hasil = await JadwalRepo.ambilSemua();
      if (!mounted) return;
      setState(() {
        _jadwal = hasil;
        _error = null;
      });
    } catch (_) {
      // Diam: pertahankan data yang sudah tampil.
    }
  }

  Future<void> _muat() async {
    setState(() => _error = null);
    try {
      final hasil = await Future.wait([JadwalRepo.ambilSemua(), ProfilRepo.ambil()]);
      if (!mounted) return;
      setState(() {
        _jadwal = hasil[0] as List<Jadwal>;
        _profil = hasil[1] as Profil;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Widget _kartu(Jadwal j, String? aku) {
    final milik = j.pembuatId != null && j.pembuatId == aku;
    return KartuJadwal(
      jadwal: j,
      nowMs: _now,
      pemilik: milik,
      mengirim: _mengirimId == j.id,
      onIngatkan: milik ? () => _ingatkan(j) : null,
      onDetail: () => context.push('/jadwal/${j.id}'),
      onUbah: milik ? () => context.push('/jadwal/${j.id}/edit') : null,
    );
  }

  Future<void> _ingatkan(Jadwal j) async {
    setState(() => _mengirimId = j.id);
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
      if (mounted) setState(() => _mengirimId = null);
    }
  }

  List<Jadwal> get _tampil {
    final dasar = _filterDivisi.isEmpty
        ? (_jadwal ?? const <Jadwal>[])
        : (_jadwal ?? const <Jadwal>[]).where((j) => j.pembuatDivisi == _filterDivisi).toList();
    return Slot.sortByAgenda(dasar, _now);
  }

  ({Jadwal jadwal, int mulai})? get _berikutnya {
    ({Jadwal jadwal, int mulai})? terbaik;
    for (final j in _tampil) {
      if (j.status != 'Aktif') continue;
      if (Slot.kelasAgenda(j, _now) != Agenda.upcoming) continue;
      final next = Slot.nextStart(Slot.urut(j.sesi), _now);
      if (next == null) continue;
      if (terbaik == null || next < terbaik.mulai) terbaik = (jadwal: j, mulai: next);
    }
    return terbaik;
  }

  @override
  Widget build(BuildContext context) {
    final memuat = _jadwal == null && _error == null;
    final berikutnya = _berikutnya;
    final aku = Auth.uid;

    return RefreshIndicator(
      color: Warna.blue,
      onRefresh: _muat,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          const WaktuSekarang(),
          const SizedBox(height: 16),
          if (berikutnya != null) ...[
            _KartuBerikutnya(jadwal: berikutnya.jadwal, mulai: berikutnya.mulai, nowMs: _now),
            const SizedBox(height: 16),
          ],
          _KartuSapaan(
            profil: _profil,
            jumlahJadwal: (_jadwal ?? const []).length,
          ),
          const SizedBox(height: 20),
          JudulBagian(
            judul: 'Jadwal per Divisi',
            ikon: Icons.apartment_rounded,
            keterangan: '${_tampil.length} ditampilkan',
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                ChipFilter(
                  label: 'Semua Divisi',
                  aktif: _filterDivisi.isEmpty,
                  onTap: () => setState(() => _filterDivisi = ''),
                ),
                for (final d in Opsi.divisi) ...[
                  const SizedBox(width: 8),
                  ChipFilter(
                    label: Opsi.singkatDivisi(d),
                    aktif: _filterDivisi == d,
                    onTap: () => setState(() => _filterDivisi = d),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (memuat)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator(color: Warna.blue)),
            )
          else if (_error != null)
            _KartuGalat(pesan: _error!, onCoba: _muat)
          else if ((_jadwal ?? const []).isEmpty)
            Kosong(
              ikon: Icons.event_available_rounded,
              judul: 'Belum ada jadwal',
              pesan:
                  'Belum ada pengingat yang perlu dipantau. Buat yang pertama agar semua staf tahu waktunya.',
              aksi: FilledButton.icon(
                onPressed: () => context.push('/jadwal/baru'),
                style: FilledButton.styleFrom(
                  backgroundColor: Warna.blue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text(
                  'Buat pengingat pertama',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            )
          else if (_tampil.isEmpty)
            Kosong(
              ikon: Icons.filter_alt_off_rounded,
              judul: 'Tidak ada jadwal',
              pesan: 'Belum ada jadwal dari divisi yang dipilih.',
            )
          else
            for (final j in _tampil) ...[
              _kartu(j, aku),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }
}

class _KartuBerikutnya extends StatelessWidget {
  const _KartuBerikutnya({
    required this.jadwal,
    required this.mulai,
    required this.nowMs,
  });

  final Jadwal jadwal;
  final int mulai;
  final int nowMs;

  ({String angka, String satuan}) get _countdown {
    final diff = mulai - nowMs;
    if (diff <= 0) return (angka: '0', satuan: 'sekarang');
    final totalMenit = diff ~/ 60000;
    if (totalMenit >= 1440) {
      return (angka: '${totalMenit ~/ 1440}', satuan: 'hari lagi');
    }
    if (totalMenit >= 60) return (angka: '${totalMenit ~/ 60}', satuan: 'jam lagi');
    if (totalMenit >= 1) return (angka: '$totalMenit', satuan: 'menit lagi');
    return (angka: '<1', satuan: 'menit lagi');
  }

  @override
  Widget build(BuildContext context) {
    final cd = _countdown;
    final sesi = Slot.urut(jadwal.sesi);

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Warna.card, Warna.card, Warna.blue50],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Warna.blue200),
        boxShadow: const [
          BoxShadow(color: Color(0x141E1B18), blurRadius: 16, offset: Offset(0, 6)),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 4, color: Warna.blue),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'BERIKUTNYA',
                            style: TextStyle(
                              color: Warna.blue,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.6,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            jadwal.judul,
                            style: const TextStyle(
                              color: Warna.ink,
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              height: 1.3,
                            ),
                          ),
                          const SizedBox(height: 8),
                          if (sesi.isNotEmpty)
                            Text(
                              Waktu.jam(sesi.first.mulai) +
                                  (sesi.first.selesai == null
                                      ? ''
                                      : ' - ${Waktu.jam(sesi.first.selesai)}'),
                              style: const TextStyle(
                                color: Warna.ink,
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                fontFeatures: [FontFeature.tabularFigures()],
                              ),
                            ),
                          const SizedBox(height: 3),
                          Text(
                            Waktu.tanggalPendek(sesi.isEmpty ? null : sesi.first.mulai),
                            style: const TextStyle(color: Warna.muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          cd.angka,
                          style: const TextStyle(
                            color: Warna.blue,
                            fontSize: 40,
                            fontWeight: FontWeight.w800,
                            height: 1,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          cd.satuan,
                          style: const TextStyle(
                            color: Warna.muted,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KartuSapaan extends StatelessWidget {
  const _KartuSapaan({required this.profil, required this.jumlahJadwal});

  final Profil? profil;
  final int jumlahJadwal;

  @override
  Widget build(BuildContext context) {
    final nama = profil?.namaLengkap ?? 'Staf Bawaslu';
    final jabatan = profil?.jabatan;
    final divisi = Opsi.singkatDivisi(profil?.divisi);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Warna.card,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Warna.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _sapaanTeks(context),
            style: const TextStyle(
              color: Warna.muted,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            nama,
            style: const TextStyle(
              color: Warna.ink,
              fontSize: 20,
              fontWeight: FontWeight.w800,
              height: 1.25,
            ),
          ),
          if (jabatan != null || divisi.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              [jabatan, divisi].where((s) => s != null && s.isNotEmpty).join(' • '),
              style: const TextStyle(color: Warna.muted, fontSize: 12.5),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                decoration: BoxDecoration(
                  color: Warna.blue50,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Warna.blue,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '$jumlahJadwal jadwal aktif',
                      style: const TextStyle(
                        color: Warna.blue700,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: () => context.push('/jadwal/baru'),
                style: FilledButton.styleFrom(
                  backgroundColor: Warna.blue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.add_rounded, size: 17),
                label: const Text(
                  'Buat',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _sapaanTeks(BuildContext context) {
    final jam = DateTime.now().hour;
    if (jam < 11) return 'SELAMAT PAGI';
    if (jam < 15) return 'SELAMAT SIANG';
    if (jam < 18) return 'SELAMAT SORE';
    return 'SELAMAT MALAM';
  }
}

class _KartuGalat extends StatelessWidget {
  const _KartuGalat({required this.pesan, required this.onCoba});

  final String pesan;
  final VoidCallback onCoba;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Warna.red50,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Warna.red100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Jadwal tidak bisa dimuat.',
            style: TextStyle(color: Warna.red, fontWeight: FontWeight.w700, fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(pesan, style: const TextStyle(color: Warna.red, fontSize: 12)),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onCoba,
            style: FilledButton.styleFrom(
              backgroundColor: Warna.redSolid,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text('Coba lagi', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
