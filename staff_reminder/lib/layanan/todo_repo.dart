import '../model/todo.dart';
import 'auth.dart';
import 'supabase.dart';

/// Akses tabel `todos`. Bila Supabase belum dikonfigurasi, mengembalikan data
/// contoh.
class TodoRepo {
  const TodoRepo._();

  static Future<List<Todo>> ambil() async {
    final klien = supabase;
    if (klien == null) return _contoh();

    final data = await klien
        .from('todos')
        .select('id, teks, tanggal, selesai, created_at')
        .order('created_at', ascending: true);
    return (data as List)
        .map((e) => Todo.dariJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  /// Langganan realtime ke tabel `todos`: daftar tugas tetap sinkron di semua
  /// perangkat tanpa perlu memuat ulang manual.
  static Stream<List<Todo>> stream() {
    final klien = supabase;
    if (klien == null) return Stream.value(_contoh());

    return klien
        .from('todos')
        .stream(primaryKey: ['id'])
        .order('created_at', ascending: true)
        .map((rows) => rows.map(Todo.dariJson).toList());
  }

  static Future<void> tambah(String teks, String tanggal) async {
    final klien = supabase;
    final uid = Auth.uid;
    if (klien == null) return;
    if (uid == null) throw StateError('Sesi tidak ditemukan. Silakan masuk kembali.');
    await klien.from('todos').insert({
      'pemilik_id': uid,
      'teks': teks,
      'tanggal': tanggal,
    });
  }

  static Future<void> ubah(String id, {String? teks, String? tanggal}) async {
    final klien = supabase;
    if (klien == null) return;
    final nilai = <String, dynamic>{};
    if (teks != null && teks.trim().isNotEmpty) nilai['teks'] = teks.trim();
    if (tanggal != null && tanggal.isNotEmpty) nilai['tanggal'] = tanggal;
    if (nilai.isEmpty) return;
    await klien.from('todos').update(nilai).eq('id', id);
  }

  static Future<void> setSelesai(String id, bool selesai) async {
    final klien = supabase;
    if (klien == null) return;
    await klien.from('todos').update({'selesai': selesai}).eq('id', id);
  }

  static Future<void> hapus(String id) async {
    final klien = supabase;
    if (klien == null) return;
    await klien.from('todos').delete().eq('id', id);
  }

  static List<Todo> _contoh() {
    final hari = DateTime.now().toIso8601String().substring(0, 10);
    return [
      Todo(id: 't1', teks: 'Rekap absensi rapat koordinasi', selesai: true, tanggal: hari),
      Todo(id: 't2', teks: 'Kirim undangan rapat divisi', selesai: false, tanggal: hari),
      Todo(id: 't3', teks: 'Tindak lanjut temuan pengawasan lapangan', selesai: false, tanggal: hari),
    ];
  }
}
