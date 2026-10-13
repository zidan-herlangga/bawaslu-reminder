import 'package:material_ui/material_ui.dart';

import '../konstanta/opsi.dart';
import '../model/jadwal.dart';
import '../tema/kategori.dart';
import '../tema/warna.dart';
import '../util/slot.dart';
import '../util/waktu.dart';
import 'lencana.dart';

/// Kartu jadwal bergaya Bawaslu: garis aksen kategori di kiri, lencana,
/// daftar sesi, deskripsi, dan aksi pemilik.
class KartuJadwal extends StatelessWidget {
  const KartuJadwal({
    super.key,
    required this.jadwal,
    required this.nowMs,
    this.pemilik = false,
    this.onDetail,
    this.onUbah,
    this.onHapus,
    this.onIngatkan,
    this.mengirim = false,
  });

  final Jadwal jadwal;
  final int nowMs;
  final bool pemilik;
  final VoidCallback? onDetail;
  final VoidCallback? onUbah;
  final VoidCallback? onHapus;
  final VoidCallback? onIngatkan;
  final bool mengirim;

  @override
  Widget build(BuildContext context) {
    final gaya = gayaKategori(jadwal.kategori);
    final sesi = Slot.urut(jadwal.sesi);
    final selesai = Slot.jadwalSelesai(jadwal, nowMs);
    final agenda = Slot.kelasAgenda(jadwal, nowMs);

    final String statusTeks;
    if (jadwal.status != 'Aktif') {
      statusTeks = jadwal.status;
    } else if (selesai) {
      statusTeks = 'Selesai';
    } else if (agenda == Agenda.ongoing) {
      statusTeks = 'Sedang berlangsung';
    } else {
      final next = Slot.nextStart(sesi, nowMs);
      statusTeks = next == null ? 'Akan datang' : Waktu.sisa(next, nowMs);
    }

    return Opacity(
      opacity: selesai ? 0.72 : 1,
      child: Container(
        decoration: BoxDecoration(
          color: Warna.card,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: Warna.line),
          boxShadow: const [
            BoxShadow(color: Color(0x0F1E1B18), blurRadius: 14, offset: Offset(0, 5)),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: gaya.aksen),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: [
                                    Lencana(
                                      teks: jadwal.kategori,
                                      latar: gaya.latar,
                                      warna: gaya.teks,
                                      garis: gaya.garis,
                                    ),
                                    Lencana(
                                      teks: jadwal.targetDivisi == null
                                          ? 'Semua staf'
                                          : 'Khusus ${Opsi.singkatDivisi(jadwal.targetDivisi)}',
                                      latar: Warna.blue50,
                                      warna: Warna.blue700,
                                      garis: Warna.blue200,
                                    ),
                                    if (jadwal.status != 'Aktif')
                                      Lencana(
                                        teks: jadwal.status,
                                        latar: Warna.red50,
                                        warna: Warna.red,
                                        garis: Warna.red100,
                                      ),
                                    if (sesi.length > 1)
                                      Lencana(teks: '${sesi.length} sesi'),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              _StatusChip(teks: statusTeks, selesai: selesai),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            jadwal.judul,
                            style: const TextStyle(
                              color: Warna.ink,
                              fontSize: 15.5,
                              fontWeight: FontWeight.w800,
                              height: 1.3,
                            ),
                          ),
                          if (sesi.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Container(
                              decoration: BoxDecoration(
                                color: Warna.surface,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Column(
                                children: [
                                  for (var i = 0; i < sesi.length; i++) ...[
                                    if (i > 0)
                                      const Divider(height: 1, color: Warna.line),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 9),
                                      child: Row(
                                        children: [
                                          Text(
                                            Waktu.jam(sesi[i].mulai) +
                                                (sesi[i].selesai == null
                                                    ? ''
                                                    : ' - ${Waktu.jam(sesi[i].selesai)}'),
                                            style: const TextStyle(
                                              color: Warna.ink,
                                              fontSize: 14.5,
                                              fontWeight: FontWeight.w800,
                                              fontFeatures: [FontFeature.tabularFigures()],
                                            ),
                                          ),
                                          const Spacer(),
                                          Text(
                                            Waktu.tanggalPendek(sesi[i].mulai),
                                            style: const TextStyle(
                                              color: Warna.muted,
                                              fontSize: 11.5,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                          if ((jadwal.deskripsi ?? '').isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Text(
                              jadwal.deskripsi!,
                              style: const TextStyle(
                                color: Warna.muted,
                                fontSize: 12.5,
                                height: 1.5,
                              ),
                            ),
                          ],
                          if (pemilik && (onIngatkan != null || onUbah != null || onHapus != null)) ...[
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                if (onIngatkan != null)
                                  FilledButton.icon(
                                    onPressed: mengirim ? null : onIngatkan,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: Warna.blue,
                                      foregroundColor: Colors.white,
                                      elevation: 0,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 9,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    icon: const Icon(Icons.notifications_active_rounded, size: 16),
                                    label: Text(
                                      mengirim ? 'Mengirim...' : 'Ingatkan',
                                      style: const TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                if (onUbah != null)
                                  _TombolKecil(
                                    ikon: Icons.edit_rounded,
                                    label: 'Ubah',
                                    onTap: onUbah!,
                                  ),
                                if (onHapus != null)
                                  _TombolKecil(
                                    ikon: Icons.delete_rounded,
                                    label: 'Hapus',
                                    warna: Warna.red,
                                    onTap: onHapus!,
                                  ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    Container(
                      decoration: const BoxDecoration(
                        color: Color(0xB3F6F1EA),
                        border: Border(top: BorderSide(color: Warna.line)),
                      ),
                      padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${jadwal.pembuatNama ?? '-'} • '
                              '${Opsi.singkatDivisi(jadwal.pembuatDivisi)}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Warna.muted, fontSize: 11.5),
                            ),
                          ),
                          if (onDetail != null)
                            TextButton(
                              onPressed: onDetail,
                              style: TextButton.styleFrom(
                                foregroundColor: Warna.blue700,
                                backgroundColor: Warna.blue50,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 4,
                                ),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(999),
                                ),
                              ),
                              child: const Text(
                                'Detail',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.teks, required this.selesai});

  final String teks;
  final bool selesai;

  @override
  Widget build(BuildContext context) {
    if (selesai) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: Warna.surface,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.check_rounded, size: 13, color: Warna.muted),
            SizedBox(width: 3),
            Text(
              'Selesai',
              style: TextStyle(color: Warna.muted, fontSize: 11.5, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      );
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 96),
      child: Text(
        teks,
        textAlign: TextAlign.right,
        style: const TextStyle(color: Warna.blue, fontSize: 11.5, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _TombolKecil extends StatelessWidget {
  const _TombolKecil({
    required this.ikon,
    required this.label,
    required this.onTap,
    this.warna = Warna.muted,
  });

  final IconData ikon;
  final String label;
  final VoidCallback onTap;
  final Color warna;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: warna,
        side: const BorderSide(color: Warna.line),
        backgroundColor: Warna.card,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        minimumSize: Size.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      icon: Icon(ikon, size: 15),
      label: Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
    );
  }
}
