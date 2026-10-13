import 'dart:async';

import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../komponen/kosong.dart';
import '../layanan/notifikasi_repo.dart';
import '../model/notifikasi_item.dart';
import '../tema/kategori.dart';
import '../tema/warna.dart';
import '../util/waktu.dart';

/// Kotak masuk notifikasi pengguna. Dibuka dari ikon lonceng di header.
///
/// Barisnya berasal dari tabel `notifications` (ditujukan ke pengguna ini), jadi
/// pengingat yang dikirim lewat web maupun APK muncul di sini. Menekan satu
/// baris menandainya sudah dibaca dan membuka detail jadwalnya.
class LayarNotifikasi extends StatefulWidget {
  const LayarNotifikasi({super.key});

  @override
  State<LayarNotifikasi> createState() => _LayarNotifikasiState();
}

class _LayarNotifikasiState extends State<LayarNotifikasi> {
  List<NotifikasiItem>? _items;
  String? _error;
  bool _sibukSemua = false;

  StreamSubscription<List<NotifikasiItem>>? _langganan;
  Timer? _realtimeTimer;

  @override
  void initState() {
    super.initState();
    _muat();
    _mulaiRealtime();
  }

  @override
  void dispose() {
    _langganan?.cancel();
    _realtimeTimer?.cancel();
    super.dispose();
  }

  /// Berlangganan realtime; bila gagal (mis. realtime mati) coba lagi berkala
  /// tanpa menyembunyikan data yang sudah tampil.
  void _mulaiRealtime() {
    _langganan?.cancel();
    _langganan = NotifikasiRepo.stream().listen(
      (data) {
        if (!mounted) return;
        setState(() {
          _items = data;
          _error = null;
        });
      },
      onError: (Object _) {
        _langganan?.cancel();
        if (!mounted) return;
        _muat();
        _realtimeTimer = Timer(const Duration(seconds: 8), _mulaiRealtime);
      },
    );
  }

  Future<void> _muat() async {
    try {
      final hasil = await NotifikasiRepo.ambil();
      if (!mounted) return;
      setState(() {
        _items = hasil;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  int get _belumDibaca => (_items ?? const []).where((n) => !n.dibaca).length;

  void _setDibacaLokal(String id) {
    final list = _items;
    if (list == null) return;
    setState(() {
      _items = [
        for (final n in list) n.id == id ? n.salinanDengan(dibaca: true) : n,
      ];
    });
  }

  Future<void> _buka(NotifikasiItem n) async {
    if (!n.dibaca) {
      _setDibacaLokal(n.id);
      unawaited(NotifikasiRepo.tandaiDibaca(n.id));
    }
    final id = n.jadwalId;
    if (id != null && id.isNotEmpty) {
      if (!mounted) return;
      context.push('/jadwal/$id');
    }
  }

  Future<void> _tandaiSemua() async {
    if (_belumDibaca == 0 || _sibukSemua) return;
    final sebelumnya = _items;
    setState(() {
      _sibukSemua = true;
      _items = [
        for (final n in _items ?? const <NotifikasiItem>[])
          n.salinanDengan(dibaca: true),
      ];
    });
    try {
      final ok = await NotifikasiRepo.tandaiSemuaDibaca();
      if (!ok && mounted) setState(() => _items = sebelumnya);
    } catch (_) {
      if (mounted) setState(() => _items = sebelumnya);
    } finally {
      if (mounted) setState(() => _sibukSemua = false);
    }
  }

  Future<void> _hapus(NotifikasiItem n) async {
    final sebelumnya = _items;
    setState(() {
      _items = [
        for (final item in _items ?? const <NotifikasiItem>[])
          if (item.id != n.id) item,
      ];
    });
    try {
      final ok = await NotifikasiRepo.hapus(n.id);
      if (!ok && mounted) setState(() => _items = sebelumnya);
    } catch (_) {
      if (mounted) setState(() => _items = sebelumnya);
    }
  }

  String _relatif(String? iso) {
    final d = DateTime.tryParse(iso ?? '');
    if (d == null) return '';
    final selisih = DateTime.now().difference(d);
    if (selisih.inMinutes < 1) return 'Baru saja';
    if (selisih.inMinutes < 60) return '${selisih.inMinutes} menit lalu';
    if (selisih.inHours < 24) return '${selisih.inHours} jam lalu';
    if (selisih.inDays < 7) return '${selisih.inDays} hari lalu';
    return Waktu.tanggalPendek(d);
  }

  @override
  Widget build(BuildContext context) {
    final memuat = _items == null && _error == null;
    final items = _items ?? const <NotifikasiItem>[];

    return FScaffold(
      header: FHeader.nested(
        title: const Text('Notifikasi'),
        prefixes: [
          FHeaderAction(
            icon: const Icon(FLucideIcons.arrowLeft),
            onPress: () => context.pop(),
          ),
        ],
        suffixes: [
          if (_belumDibaca > 0)
            FHeaderAction(
              icon: const Icon(Icons.done_all_rounded),
              onPress: _tandaiSemua,
            ),
        ],
      ),
      child: RefreshIndicator(
        color: Warna.blue,
        onRefresh: _muat,
        child: memuat
            ? const Center(child: CircularProgressIndicator(color: Warna.blue))
            : _error != null
            ? ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Kosong(
                    ikon: Icons.cloud_off_rounded,
                    judul: 'Gagal memuat notifikasi',
                    pesan: _error!,
                    aksi: FilledButton.icon(
                      onPressed: _muat,
                      style: FilledButton.styleFrom(
                        backgroundColor: Warna.blue,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.refresh_rounded, size: 16),
                      label: const Text(
                        'Coba lagi',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              )
            : items.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(16),
                children: const [
                  Kosong(
                    ikon: Icons.notifications_none_rounded,
                    judul: 'Belum ada notifikasi',
                    pesan:
                        'Pengingat jadwal yang ditujukan untuk Anda akan muncul di sini.',
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) => _kartu(items[i]),
              ),
      ),
    );
  }

  Widget _kartu(NotifikasiItem n) {
    final gaya = gayaKategori(n.kategori ?? '');
    final latar = n.dibaca ? Warna.card : Warna.blue50;
    final garis = n.dibaca ? Warna.line : Warna.blue200;

    return Dismissible(
      key: ValueKey(n.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: Warna.redSolid,
          borderRadius: BorderRadius.circular(18),
        ),
        child: const Icon(Icons.delete_outline_rounded, color: Colors.white),
      ),
      onDismissed: (_) => _hapus(n),
      child: Material(
        color: latar,
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => _buka(n),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: garis),
            ),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(width: 4, color: gaya.aksen),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(gaya.ikon, size: 16, color: gaya.teks),
                              const SizedBox(width: 7),
                              Expanded(
                                child: Text(
                                  n.judul,
                                  style: TextStyle(
                                    color: Warna.ink,
                                    fontSize: 14,
                                    fontWeight: n.dibaca
                                        ? FontWeight.w600
                                        : FontWeight.w800,
                                  ),
                                ),
                              ),
                              if (!n.dibaca)
                                Container(
                                  margin: const EdgeInsets.only(top: 3, left: 6),
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: Warna.blue,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            n.pesan,
                            style: TextStyle(
                              color: n.dibaca ? Warna.muted : Warna.ink2,
                              fontSize: 12.5,
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _relatif(n.createdAt),
                            style: const TextStyle(
                              color: Warna.muted,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
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
        ),
      ),
    );
  }
}
