import '../model/notifikasi_item.dart';
import 'auth.dart';
import 'supabase.dart';

/// Akses tabel `notifications` untuk kotak masuk notifikasi pengguna.
///
/// Setiap baris ditujukan ke satu penerima (`penerima_id`), jadi semua query
/// selalu disaring ke pengguna yang sedang masuk. Bila Supabase belum
/// dikonfigurasi, semua metode mengembalikan hasil kosong dengan aman.
class NotifikasiRepo {
  const NotifikasiRepo._();

  static const _kolom =
      'id, judul, pesan, dibaca, jadwal_id, created_at, schedules(kategori)';

  /// Ambil notifikasi terbaru milik pengguna yang sedang masuk.
  static Future<List<NotifikasiItem>> ambil({int batas = 50}) async {
    final klien = supabase;
    final uid = Auth.uid;
    if (klien == null || uid == null) return const [];

    final data = await klien
        .from('notifications')
        .select(_kolom)
        .eq('penerima_id', uid)
        .order('created_at', ascending: false)
        .limit(batas);

    return (data as List)
        .map((e) => NotifikasiItem.dariJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  /// Langganan realtime ke notifikasi pengguna: memancarkan daftar terbaru
  /// setiap ada INSERT/UPDATE/DELETE, sehingga lonceng dan layar Notifikasi
  /// selalu sinkron tanpa perlu menarik ulang.
  static Stream<List<NotifikasiItem>> stream({int batas = 50}) {
    final klien = supabase;
    final uid = Auth.uid;
    if (klien == null || uid == null) return const Stream.empty();

    return klien
        .from('notifications')
        .stream(primaryKey: ['id'])
        .eq('penerima_id', uid)
        .order('created_at', ascending: false)
        .limit(batas)
        .map(
          (rows) => rows
              .map((e) => NotifikasiItem.dariJson(Map<String, dynamic>.from(e)))
              .toList(),
        );
  }

  /// Tandai satu notifikasi sudah dibaca. Mengembalikan `false` bila tidak ada
  /// baris yang berubah (mis. karena RLS).
  static Future<bool> tandaiDibaca(String id) async {
    final klien = supabase;
    if (klien == null) return false;
    final hasil = await klien
        .from('notifications')
        .update({'dibaca': true})
        .eq('id', id)
        .select('id');
    return (hasil as List).isNotEmpty;
  }

  /// Tandai semua notifikasi pengguna sudah dibaca.
  static Future<bool> tandaiSemuaDibaca() async {
    final klien = supabase;
    final uid = Auth.uid;
    if (klien == null || uid == null) return false;
    final hasil = await klien
        .from('notifications')
        .update({'dibaca': true})
        .eq('penerima_id', uid)
        .eq('dibaca', false)
        .select('id');
    return (hasil as List).isNotEmpty;
  }

  /// Hapus satu notifikasi milik pengguna.
  static Future<bool> hapus(String id) async {
    final klien = supabase;
    if (klien == null) return false;
    final hasil = await klien
        .from('notifications')
        .delete()
        .eq('id', id)
        .select('id');
    return (hasil as List).isNotEmpty;
  }
}
