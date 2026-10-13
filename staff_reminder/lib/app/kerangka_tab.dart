import 'dart:async';

import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../komponen/strip_info.dart';
import '../layanan/notifikasi_repo.dart';
import '../model/notifikasi_item.dart';
import '../tema/warna.dart';

/// Kerangka shell ber-tab: strip identitas + header berlogo + navigasi bawah.
class KerangkaTab extends StatefulWidget {
  const KerangkaTab({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  State<KerangkaTab> createState() => _KerangkaTabState();
}

class _KerangkaTabState extends State<KerangkaTab> {
  // Peta indeks navigasi (5 item) ke cabang StatefulShell (4 cabang). Item
  // "Buat Jadwal" bukan cabang, melainkan rute yang didorong.
  static const _navKeCabang = [0, 1, -1, 2, 3];
  static const _cabangKeNav = [0, 1, 3, 4];

  static const _ikon = <IconData>[
    FLucideIcons.house,
    FLucideIcons.calendar,
    FLucideIcons.plus,
    FLucideIcons.listChecks,
    FLucideIcons.circleUser,
  ];
  static const _label = ['Beranda', 'Kalender', 'Buat', 'Tugas', 'Akun'];

  StreamSubscription<List<NotifikasiItem>>? _langganan;
  Timer? _realtimeTimer;
  int _belumDibaca = 0;

  @override
  void initState() {
    super.initState();
    _muatJumlah();
    _mulaiRealtime();
  }

  @override
  void dispose() {
    _langganan?.cancel();
    _realtimeTimer?.cancel();
    super.dispose();
  }

  /// Cadangan tanpa realtime: hitung sekali dari tabel, dipakai saat kanal
  /// realtime gagal dibuka.
  Future<void> _muatJumlah() async {
    try {
      final data = await NotifikasiRepo.ambil();
      if (!mounted) return;
      setState(() => _belumDibaca = data.where((n) => !n.dibaca).length);
    } catch (_) {
      // Diam: lencana tetap memakai angka terakhir yang diketahui.
    }
  }

  /// Pantau jumlah notifikasi yang belum dibaca lewat realtime; bila gagal,
  /// coba lagi berkala. Angka pada lonceng mengikuti hasilnya.
  void _mulaiRealtime() {
    _langganan?.cancel();
    _langganan = NotifikasiRepo.stream(batas: 50).listen(
      (data) {
        if (!mounted) return;
        setState(() => _belumDibaca = data.where((n) => !n.dibaca).length);
      },
      onError: (Object _) {
        _langganan?.cancel();
        if (!mounted) return;
        _muatJumlah();
        _realtimeTimer = Timer(const Duration(seconds: 15), _mulaiRealtime);
      },
    );
  }

  Future<void> _bukaNotifikasi() async {
    await context.push('/notifikasi');
  }

  @override
  Widget build(BuildContext context) {
    final navIndex = _cabangKeNav[widget.shell.currentIndex];

    return Column(
      children: [
        SafeArea(bottom: false, child: const StripInfo()),
        Expanded(
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: FScaffold(
              header: FHeader(
                title: const _JudulHeader(),
                suffixes: [
                  FHeaderAction(
                    icon: _IkonLonceng(jumlah: _belumDibaca),
                    onPress: _bukaNotifikasi,
                  ),
                ],
              ),
              footer: FBottomNavigationBar(
                index: navIndex,
                onChange: (i) {
                  final cabang = _navKeCabang[i];
                  if (cabang < 0) {
                    context.push('/jadwal/baru');
                    return;
                  }
                  widget.shell.goBranch(
                    cabang,
                    initialLocation: cabang == widget.shell.currentIndex,
                  );
                },
                children: [
                  for (var i = 0; i < _label.length; i++)
                    FBottomNavigationBarItem(
                      icon: Icon(_ikon[i]),
                      label: Text(_label[i]),
                    ),
                ],
              ),
              child: widget.shell,
            ),
          ),
        ),
      ],
    );
  }
}

/// Ikon lonceng dengan lencana angka merah saat ada notifikasi belum dibaca.
class _IkonLonceng extends StatelessWidget {
  const _IkonLonceng({required this.jumlah});

  final int jumlah;

  @override
  Widget build(BuildContext context) {
    if (jumlah <= 0) return const Icon(FLucideIcons.bell);

    final teks = jumlah > 9 ? '9+' : '$jumlah';
    return Stack(
      clipBehavior: Clip.none,
      children: [
        const Icon(FLucideIcons.bell),
        Positioned(
          top: -6,
          right: -8,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            constraints: const BoxConstraints(minWidth: 16),
            decoration: BoxDecoration(
              color: Warna.blue,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: Warna.card, width: 1.5),
            ),
            child: Text(
              teks,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                height: 1.2,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _JudulHeader extends StatelessWidget {
  const _JudulHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Image.asset('assets/logo-mark.png', height: 34, fit: BoxFit.contain),
        const SizedBox(width: 10),
        const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pengingat Jadwal',
              style: TextStyle(
                color: Warna.ink,
                fontSize: 15,
                fontWeight: FontWeight.w800,
                height: 1.1,
                letterSpacing: -0.2,
              ),
            ),
            Text(
              'Bawaslu Bekasi Kota',
              style: TextStyle(
                color: Warna.muted,
                fontSize: 11,
                fontWeight: FontWeight.w500,
                height: 1.2,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
