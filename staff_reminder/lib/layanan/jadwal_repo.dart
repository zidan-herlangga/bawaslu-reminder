import '../model/jadwal.dart';
import 'supabase.dart';

/// Akses tabel `schedules`. Bila Supabase belum dikonfigurasi, mengembalikan
/// data contoh supaya tampilan tetap bisa dipratinjau.
class JadwalRepo {
  const JadwalRepo._();

  static const _kolom =
      'id, judul, kategori, status, deskripsi, target_divisi, slots, '
      'waktu_mulai, waktu_selesai, pembuat_id, pembuat_nama, pembuat_divisi, created_at';

  static Future<List<Jadwal>> ambilSemua() async {
    final klien = supabase;
    if (klien == null) return _contoh();

    final data = await klien
        .from('schedules')
        .select(_kolom)
        .order('created_at', ascending: false);
    return (data as List)
        .map((e) => Jadwal.dariJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  /// Langganan realtime ke tabel `schedules`: memancarkan daftar terbaru setiap
  /// ada INSERT/UPDATE/DELETE, jadi semua layar tetap sinkron tanpa refresh.
  static Stream<List<Jadwal>> streamSemua() {
    final klien = supabase;
    if (klien == null) return Stream.value(_contoh());

    return klien
        .from('schedules')
        .stream(primaryKey: ['id'])
        .order('created_at', ascending: false)
        .map((rows) => rows.map(Jadwal.dariJson).toList());
  }

  static Future<Jadwal?> ambilSatu(String id) async {
    final klien = supabase;
    if (klien == null) {
      for (final j in _contoh()) {
        if (j.id == id) return j;
      }
      return null;
    }

    final data = await klien.from('schedules').select(_kolom).eq('id', id).maybeSingle();
    if (data == null) return null;
    return Jadwal.dariJson(Map<String, dynamic>.from(data));
  }

  static Future<void> hapus(String id) async {
    final klien = supabase;
    if (klien == null) return;
    await klien.from('schedules').delete().eq('id', id);
  }

  static Future<void> simpan(Map<String, dynamic> nilai, {String? id}) async {
    final klien = supabase;
    if (klien == null) {
      throw StateError('Backend belum dikonfigurasi, jadwal tidak bisa disimpan.');
    }
    if (id == null) {
      await klien.from('schedules').insert(nilai);
    } else {
      // Deteksi perubahan yang tidak tersimpan: RLS hanya mengizinkan pemilik
      // mengubah jadwalnya, dan update tanpa izin menghasilkan 0 baris tanpa
      // error. Tanpa pemeriksaan ini, UI akan salah melaporkan "diperbarui".
      final hasil = await klien
          .from('schedules')
          .update(nilai)
          .eq('id', id)
          .select('id');
      if ((hasil as List).isEmpty) {
        throw Exception(
          'Jadwal tidak tersimpan. Anda hanya bisa mengubah jadwal yang Anda buat sendiri.',
        );
      }
    }
  }

  static List<Jadwal> _contoh() {
    final sekarang = DateTime.now();
    String iso(DateTime t) => t.toIso8601String();
    return [
      Jadwal(
        id: 'contoh-1',
        judul: 'Rapat Koordinasi Pengawasan Pemilu',
        kategori: 'Rapat',
        status: 'Aktif',
        deskripsi: 'Koordinasi mingguan seluruh divisi di ruang rapat utama.',
        pembuatNama: 'Admin Bawaslu',
        pembuatDivisi: 'Pencegahan, Partisipasi Masyarakat, dan Humas',
        slots: [
          Sesi(
            mulai: iso(DateTime(sekarang.year, sekarang.month, sekarang.day, 9)),
            selesai: iso(DateTime(sekarang.year, sekarang.month, sekarang.day, 11)),
          ),
        ],
      ),
      Jadwal(
        id: 'contoh-2',
        judul: 'Pengawasan Verifikasi Faktual',
        kategori: 'Pengawasan',
        status: 'Aktif',
        deskripsi: 'Pemantauan verifikasi data pemilih di lapangan.',
        targetDivisi: 'Penanganan Pelanggaran dan Data Informasi',
        pembuatNama: 'Admin Bawaslu',
        pembuatDivisi: 'Penanganan Pelanggaran dan Data Informasi',
        slots: [
          Sesi(
            mulai: iso(DateTime(sekarang.year, sekarang.month, sekarang.day + 1, 13, 30)),
            selesai: iso(DateTime(sekarang.year, sekarang.month, sekarang.day + 1, 16)),
          ),
        ],
      ),
      Jadwal(
        id: 'contoh-3',
        judul: 'Penyusunan Laporan Bulanan',
        kategori: 'Tugas',
        status: 'Aktif',
        deskripsi: 'Menyusun dan mengunggah laporan kinerja bulan ini.',
        pembuatNama: 'Admin Bawaslu',
        pembuatDivisi: 'Sumber Daya Manusia, Organisasi, Diklat, dan Fasilitasi',
        slots: [
          Sesi(
            mulai: iso(DateTime(sekarang.year, sekarang.month, sekarang.day, 15)),
            selesai: iso(DateTime(sekarang.year, sekarang.month, sekarang.day, 16, 30)),
          ),
        ],
      ),
    ];
  }
}
