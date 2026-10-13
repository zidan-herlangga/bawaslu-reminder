import 'dart:async';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../data/hari_libur.dart';
import '../komponen/judul_bagian.dart';
import '../komponen/kartu_jadwal.dart';
import '../komponen/kosong.dart';
import '../layanan/auth.dart';
import '../layanan/jadwal_repo.dart';
import '../layanan/pengingat.dart';
import '../model/jadwal.dart';
import '../tema/warna.dart';
import '../util/slot.dart';
import '../util/waktu.dart';

/// Layar Kalender: kisi bulan, penanda hari libur, dan daftar jadwal pada
/// tanggal yang dipilih.
class LayarKalender extends StatefulWidget {
  const LayarKalender({super.key});

  @override
  State<LayarKalender> createState() => _LayarKalenderState();
}

class _LayarKalenderState extends State<LayarKalender> {
  static const _namaHari = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  late Timer _tick;
  int _now = DateTime.now().millisecondsSinceEpoch;

  List<Jadwal>? _jadwal;
  String? _error;
  late DateTime _view;
  late String _selected;
  StreamSubscription<List<Jadwal>>? _langganan;
  Timer? _realtimeTimer;
  String? _mengirimId;

  @override
  void initState() {
    super.initState();
    final hariIni = DateTime.now();
    _view = DateTime(hariIni.year, hariIni.month, 1);
    _selected = Waktu.hari(hariIni);
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
      final hasil = await JadwalRepo.ambilSemua();
      if (!mounted) return;
      setState(() => _jadwal = hasil);
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

  /// Peta `YYYY-MM-DD` -> daftar (jadwal, sesi) pada hari itu.
  Map<String, List<({Jadwal jadwal, Sesi sesi})>> get _perHari {
    final map = <String, List<({Jadwal jadwal, Sesi sesi})>>{};
    for (final j in _jadwal ?? const <Jadwal>[]) {
      for (final s in Slot.urut(j.sesi)) {
        final key = Waktu.hariKey(s.mulai);
        if (key.isEmpty) continue;
        map.putIfAbsent(key, () => []).add((jadwal: j, sesi: s));
      }
    }
    return map;
  }

  List<DateTime?> get _sel {
    final pertama = DateTime(_view.year, _view.month, 1);
    final jumlahHari = DateTime(_view.year, _view.month + 1, 0).day;
    final leading = (pertama.weekday - 1) % 7; // Senin = 0
    final sel = <DateTime?>[];
    for (var i = 0; i < leading; i++) {
      sel.add(null);
    }
    for (var h = 1; h <= jumlahHari; h++) {
      sel.add(DateTime(_view.year, _view.month, h));
    }
    while (sel.length % 7 != 0) {
      sel.add(null);
    }
    return sel;
  }

  List<HariLibur> get _liburBulan {
    final jumlahHari = DateTime(_view.year, _view.month + 1, 0).day;
    final hasil = <HariLibur>[];
    for (var h = 1; h <= jumlahHari; h++) {
      final key = Waktu.hari(DateTime(_view.year, _view.month, h));
      final libur = HariLibur.pada(key);
      if (libur != null) hasil.add(libur);
    }
    return hasil;
  }

  int get _jumlahJadwalBulan {
    final prefix =
        '${_view.year}-${_view.month.toString().padLeft(2, '0')}';
    final ids = <String>{};
    for (final j in _jadwal ?? const <Jadwal>[]) {
      for (final s in j.sesi) {
        if (Waktu.hariKey(s.mulai).startsWith(prefix)) ids.add(j.id);
      }
    }
    return ids.length;
  }

  void _geserBulan(int delta) {
    setState(() {
      _view = DateTime(_view.year, _view.month + delta, 1);
      final hariKe = int.parse(_selected.substring(8, 10));
      final hariTerakhir = DateTime(_view.year, _view.month + 1, 0).day;
      final baru = hariKe > hariTerakhir ? hariTerakhir : hariKe;
      _selected = Waktu.hari(DateTime(_view.year, _view.month, baru));
    });
  }

  void _keHariIni() {
    final hariIni = DateTime.now();
    setState(() {
      _view = DateTime(hariIni.year, hariIni.month, 1);
      _selected = Waktu.hari(hariIni);
    });
  }

  @override
  Widget build(BuildContext context) {
    final perHari = _perHari;
    final hariIniKey = Waktu.hari(DateTime.now());
    final liburSelected = HariLibur.pada(_selected);
    final items = perHari[_selected] ?? const <({Jadwal jadwal, Sesi sesi})>[];
    final terurut = [...items]..sort((a, b) {
      final ta = a.sesi.mulaiDt?.millisecondsSinceEpoch ?? 0;
      final tb = b.sesi.mulaiDt?.millisecondsSinceEpoch ?? 0;
      return ta.compareTo(tb);
    });
    final aku = Auth.uid;

    return RefreshIndicator(
      color: Warna.blue,
      onRefresh: _muat,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _KartuKalender(
            view: _view,
            selected: _selected,
            nowKey: hariIniKey,
            sel: _sel,
            perHari: perHari,
            namaHari: _namaHari,
            jumlahBulan: _jumlahJadwalBulan,
            liburBulan: _liburBulan,
            onPilih: (key) => setState(() => _selected = key),
            onMundur: () => _geserBulan(-1),
            onMaju: () => _geserBulan(1),
            onHariIni: _keHariIni,
          ),
          const SizedBox(height: 20),
          JudulBagian(
            judul: Waktu.tanggalPanjang(_selected),
            ikon: Icons.event_note_rounded,
            keterangan: '${terurut.length} jadwal',
          ),
          const SizedBox(height: 12),
          if (liburSelected != null) ...[
            _KartuLibur(libur: liburSelected),
            const SizedBox(height: 12),
          ],
          if (_jahrKosongDanError() && _error != null)
            _GalatKecil(pesan: _error!, onCoba: _muat)
          else if (_jadwal == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator(color: Warna.blue)),
            )
          else if (terurut.isEmpty)
            const Kosong(
              ikon: Icons.event_busy_rounded,
              judul: 'Tidak ada jadwal',
              pesan: 'Belum ada jadwal pada tanggal ini.',
            )
          else
            for (final row in terurut) ...[
              _kartu(row.jadwal, aku),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }

  bool _jahrKosongDanError() => _jadwal == null && _error != null;
}

class _KartuKalender extends StatelessWidget {
  const _KartuKalender({
    required this.view,
    required this.selected,
    required this.nowKey,
    required this.sel,
    required this.perHari,
    required this.namaHari,
    required this.jumlahBulan,
    required this.liburBulan,
    required this.onPilih,
    required this.onMundur,
    required this.onMaju,
    required this.onHariIni,
  });

  final DateTime view;
  final String selected;
  final String nowKey;
  final List<DateTime?> sel;
  final Map<String, List<({Jadwal jadwal, Sesi sesi})>> perHari;
  final List<String> namaHari;
  final int jumlahBulan;
  final List<HariLibur> liburBulan;
  final ValueChanged<String> onPilih;
  final VoidCallback onMundur;
  final VoidCallback onMaju;
  final VoidCallback onHariIni;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Warna.card,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Warna.line),
      ),
      child: Column(
        children: [
          Row(
            children: [
              _TombolPanah(arahKiri: true, onTap: onMundur),
              Expanded(
                child: Column(
                  children: [
                    Text(
                      Waktu.bulanTahun(view),
                      style: const TextStyle(
                        color: Warna.ink,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      '$jumlahBulan jadwal bulan ini',
                      style: const TextStyle(color: Warna.muted, fontSize: 11.5),
                    ),
                  ],
                ),
              ),
              _TombolPanah(arahKiri: false, onTap: onMaju),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              for (final h in namaHari)
                Expanded(
                  child: Text(
                    h,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: h == 'Min' ? Warna.red : Warna.muted,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
            children: [
              for (final cell in sel)
                cell == null
                    ? const SizedBox.shrink()
                    : _SelHari(
                        tanggal: cell,
                        keyHari: Waktu.hari(cell),
                        selected: selected,
                        nowKey: nowKey,
                        jumlah: perHari[Waktu.hari(cell)]?.length ?? 0,
                        libur: HariLibur.pada(Waktu.hari(cell)) != null,
                        onTap: onPilih,
                      ),
            ],
          ),
          const SizedBox(height: 12),
          Container(height: 1, color: Warna.line),
          const SizedBox(height: 10),
          Row(
            children: [
              const _TitikLegenda(warna: Warna.blue, teks: 'Hari ini'),
              const SizedBox(width: 14),
              _TitikLegenda(warna: Warna.line, teks: 'Ada jadwal'),
              const Spacer(),
              GestureDetector(
                onTap: onHariIni,
                child: const Text(
                  'Hari ini',
                  style: TextStyle(
                    color: Warna.blue,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          if (liburBulan.isNotEmpty) ...[
            const SizedBox(height: 10),
            for (final item in liburBulan)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 18,
                      height: 18,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: item.cuti ? Warna.blue50 : Warna.red50,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _hariDari(item),
                        style: TextStyle(
                          color: item.cuti ? Warna.blue700 : Warna.red,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: RichText(
                        text: TextSpan(
                          style: const TextStyle(color: Warna.muted, fontSize: 11.5),
                          children: [
                            TextSpan(
                              text: item.nama,
                              style: const TextStyle(
                                color: Warna.ink,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            TextSpan(text: ' - ${HariLibur.labelJenis(item.jenis)}'),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }

  String _hariDari(HariLibur item) {
    for (var h = 1; h <= 31; h++) {
      final key = Waktu.hari(DateTime(view.year, view.month, h));
      if (identical(HariLibur.pada(key), item)) return '$h';
    }
    return '';
  }
}

class _SelHari extends StatelessWidget {
  const _SelHari({
    required this.tanggal,
    required this.keyHari,
    required this.selected,
    required this.nowKey,
    required this.jumlah,
    required this.libur,
    required this.onTap,
  });

  final DateTime tanggal;
  final String keyHari;
  final String selected;
  final String nowKey;
  final int jumlah;
  final bool libur;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final isToday = keyHari == nowKey;
    final isSelected = keyHari == selected;
    final isMinggu = tanggal.weekday == DateTime.sunday;

    Color bg = Colors.transparent;
    Color fg = Warna.ink;
    Color border = Colors.transparent;

    if (isMinggu) fg = Warna.red;
    if (libur) {
      bg = Warna.red50;
      fg = Warna.red;
    }
    if (isSelected) {
      bg = Warna.blue50;
      fg = Warna.blue700;
      border = Warna.blue;
    }
    if (isToday) {
      bg = Warna.blue;
      fg = Colors.white;
      border = Warna.blue;
    }

    return GestureDetector(
      onTap: () => onTap(keyHari),
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${tanggal.day}',
              style: TextStyle(
                color: fg,
                fontSize: 13,
                fontWeight: (isToday || isSelected || libur)
                    ? FontWeight.w800
                    : FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(
                color: jumlah == 0
                    ? Colors.transparent
                    : (isToday ? Colors.white : Warna.red),
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TombolPanah extends StatelessWidget {
  const _TombolPanah({required this.arahKiri, required this.onTap});

  final bool arahKiri;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Warna.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Warna.line),
        ),
        child: Icon(
          arahKiri ? Icons.chevron_left_rounded : Icons.chevron_right_rounded,
          color: Warna.muted,
        ),
      ),
    );
  }
}

class _TitikLegenda extends StatelessWidget {
  const _TitikLegenda({required this.warna, required this.teks});

  final Color warna;
  final String teks;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: warna, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(teks, style: const TextStyle(color: Warna.muted, fontSize: 11)),
      ],
    );
  }
}

class _KartuLibur extends StatelessWidget {
  const _KartuLibur({required this.libur});

  final HariLibur libur;

  @override
  Widget build(BuildContext context) {
    final cuti = libur.cuti;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cuti ? Warna.amber50 : Warna.red50,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: cuti ? Warna.amber200 : Warna.red100),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.event_available_rounded, size: 18, color: cuti ? Warna.amber800 : Warna.red),
          const SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(color: cuti ? Warna.amber800 : Warna.red, fontSize: 12.5),
                children: [
                  TextSpan(
                    text: libur.nama,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  TextSpan(text: ' - ${HariLibur.labelJenis(libur.jenis)} di Indonesia'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GalatKecil extends StatelessWidget {
  const _GalatKecil({required this.pesan, required this.onCoba});

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
