import 'dart:io';
import 'dart:typed_data';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'supabase.dart';

/// Penangan pesan saat aplikasi di latar belakang atau tertutup.
///
/// Harus fungsi top-level dan ditandai `vm:entry-point` supaya tidak dibuang
/// compiler. Untuk pesan bertipe `notification`, Android menampilkan sendiri
/// lewat sistem memakai `channel_id` dari payload, jadi di sini tidak perlu
/// menampilkan apa pun.
@pragma('vm:entry-point')
Future<void> pesanLatar(RemoteMessage pesan) async {}

/// Jembatan notifikasi push Firebase Cloud Messaging ke backend yang sudah ada.
///
/// Backend (`api/`) mengirim ke tabel `public.device_tokens`, jadi tugas sisi
/// aplikasi hanya tiga: menyalakan Firebase, mendaftarkan token perangkat milik
/// pengguna yang sedang masuk, dan menghapusnya saat keluar. Kanal notifikasi
/// disiapkan di sini karena backend memilih channel per kategori; kalau kanal
/// tidak ada, notifikasi Android 8+ akan diam-diam tidak tampil.
class Notifikasi {
  Notifikasi._();

  static final FlutterLocalNotificationsPlugin _lokal =
      FlutterLocalNotificationsPlugin();

  static bool _aktif = false;

  /// Dipasang dari `main.dart` supaya layanan ini tidak perlu tahu soal rute.
  /// Dipanggil dengan lokasi tujuan saat pengguna menekan notifikasi.
  static void Function(String lokasi)? saatDibuka;

  /// Identitas kanal versi 2. Versi dinaikkan supaya kanal lama (kanal "biasa"
  /// tanpa suara kustom) diganti yang baru dengan suara dan getaran per kategori;
  /// Android tidak bisa mengubah suara kanal yang sudah pernah dibuat.
  static const String _kanalBawaan = 'pengingat-jadwal-v2';

  static const Map<String, String> _namaKanal = {
    'pengingat-jadwal-v2': 'Pengingat jadwal',
    'pengingat-rapat-v2': 'Pengingat rapat',
    'pengingat-tugas-v2': 'Pengingat tugas',
    'pengingat-pengawasan-v2': 'Pengingat pengawasan',
  };

  /// Sama dengan KANAL_PER_KATEGORI di `api/lib/push-native.js`.
  static const Map<String, String> _kanalPerKategori = {
    'Rapat': 'pengingat-rapat-v2',
    'Tugas': 'pengingat-tugas-v2',
    'Pengawasan': 'pengingat-pengawasan-v2',
  };

  /// Suara kustom per kanal, dari `android/app/src/main/res/raw`.
  static const Map<String, String> _suaraKanal = {
    'pengingat-jadwal-v2': 'notification',
    'pengingat-rapat-v2': 'rapat',
    'pengingat-tugas-v2': 'tugas',
    'pengingat-pengawasan-v2': 'pengawasan',
  };

  /// Pola getaran per kanal, meniru GETARAN_PER_KATEGORI di `public/sw.js`.
  static const Map<String, List<int>> _getaranKanal = {
    'pengingat-jadwal-v2': [180, 90, 180],
    'pengingat-rapat-v2': [200, 80, 200],
    'pengingat-tugas-v2': [120, 60, 120, 60, 120],
    'pengingat-pengawasan-v2': [300, 100, 300],
  };

  /// Ikon warna per kategori dari `res/drawable`, untuk notifikasi yang tampil
  /// saat aplikasi terbuka (yang ditampilkan sistem ikonnya monokrom).
  static const Map<String, String> _ikonKategori = {
    'Rapat': 'icon_rapat',
    'Tugas': 'icon_tugas',
    'Pengawasan': 'icon_pengawasan',
  };

  static String _kanalUntuk(String? kategori) =>
      _kanalPerKategori[kategori?.trim()] ?? _kanalBawaan;

  /// Menyalakan seluruh alur notifikasi. Aman dipanggil walau konfigurasi
  /// Firebase belum lengkap: kegagalan di sini tidak boleh menghentikan app.
  static Future<void> mulai() async {
    if (!Platform.isAndroid && !Platform.isIOS) return;

    try {
      await Firebase.initializeApp();
    } catch (_) {
      // google-services.json belum ada / tidak cocok. App tetap jalan tanpa push.
      return;
    }

    _aktif = true;

    FirebaseMessaging.onBackgroundMessage(pesanLatar);

    await _siapkanLokal();
    await _mintaIzin();
    await _siapkanKanal();

    FirebaseMessaging.onMessage.listen(_tampilkanDiDepan);
    FirebaseMessaging.onMessageOpenedApp.listen(_bukaDariPesan);

    final pembuka = await FirebaseMessaging.instance.getInitialMessage();
    if (pembuka != null) _bukaDariPesan(pembuka);

    FirebaseMessaging.instance.onTokenRefresh.listen((_) => _kirimToken());

    _pantauSesi();
  }

  static Future<void> _siapkanLokal() async {
    const setelan = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    );

    await _lokal.initialize(
      settings: setelan,
      onDidReceiveNotificationResponse: (respon) => _bukaLokasi(respon.payload),
    );
  }

  static Future<void> _siapkanKanal() async {
    final android = _lokal
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (android == null) return;

    for (final kanal in _namaKanal.entries) {
      final suara = _suaraKanal[kanal.key] ?? 'notification';
      await android.createNotificationChannel(
        AndroidNotificationChannel(
          kanal.key,
          kanal.value,
          description: 'Notifikasi ${kanal.value.toLowerCase()}.',
          importance: Importance.high,
          playSound: true,
          sound: RawResourceAndroidNotificationSound(suara),
          enableVibration: true,
          vibrationPattern: Int64List.fromList(
            _getaranKanal[kanal.key] ?? _getaranKanal[_kanalBawaan]!,
          ),
          showBadge: true,
        ),
      );
    }
  }

  static Future<void> _mintaIzin() async {
    await FirebaseMessaging.instance.requestPermission();

    final android = _lokal
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await android?.requestNotificationsPermission();
  }

  /// Pesan yang masuk saat app sedang terbuka tidak ditampilkan sistem, jadi
  /// harus diangkat sendiri lewat notifikasi lokal.
  static Future<void> _tampilkanDiDepan(RemoteMessage pesan) async {
    final kabar = pesan.notification;
    final judul = kabar?.title ?? pesan.data['judul']?.toString() ?? '';
    final isi = kabar?.body ?? pesan.data['pesan']?.toString() ?? '';
    if (judul.isEmpty && isi.isEmpty) return;

    final kategori = pesan.data['kategori']?.toString();
    final kanal = _kanalUntuk(kategori);
    final suara = _suaraKanal[kanal] ?? 'notification';
    final ikonKategori = _ikonKategori[kategori?.trim()];

    await _lokal.show(
      id: DateTime.now().millisecondsSinceEpoch.remainder(0x7fffffff),
      title: judul,
      body: isi,
      payload: _lokasiUtama(pesan),
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          kanal,
          _namaKanal[kanal] ?? 'Pengingat',
          channelDescription: 'Pengingat jadwal Bawaslu.',
          importance: Importance.high,
          priority: Priority.high,
          sound: RawResourceAndroidNotificationSound(suara),
          enableVibration: true,
          vibrationPattern: Int64List.fromList(
            _getaranKanal[kanal] ?? _getaranKanal[_kanalBawaan]!,
          ),
          largeIcon: DrawableResourceAndroidBitmap(ikonKategori ?? 'icon_default'),
        ),
      ),
    );
  }

  static void _bukaDariPesan(RemoteMessage pesan) =>
      _bukaLokasi(_lokasiUtama(pesan));

  /// Lokasi tujuan dari data pesan: notifikasi tugas membuka tab Tugas,
  /// notifikasi jadwal membuka detail jadwal.
  static String? _lokasiUtama(RemoteMessage pesan) {
    final todoId = pesan.data['todo_id']?.toString();
    if (todoId != null && todoId.isNotEmpty) return 'todo:$todoId';
    final jadwalId = pesan.data['schedule_id']?.toString();
    if (jadwalId != null && jadwalId.isNotEmpty) return 'jadwal:$jadwalId';
    return null;
  }

  static void _bukaLokasi(String? lokasi) {
    if (lokasi == null || lokasi.isEmpty) return;
    if (lokasi == 'todo' || lokasi.startsWith('todo:')) {
      saatDibuka?.call('/todo');
      return;
    }
    final id = lokasi.startsWith('jadwal:')
        ? lokasi.substring('jadwal:'.length)
        : lokasi;
    if (id.isEmpty) return;
    saatDibuka?.call('/jadwal/$id');
  }

  /// Daun pantau perubahan sesi: token didaftarkan begitu ada pengguna masuk,
  /// dan dibersihkan saat keluar (lewat [Auth.keluar]).
  static void _pantauSesi() {
    final klien = supabase;
    if (klien == null) return;

    if (klien.auth.currentSession != null) _kirimToken();

    klien.auth.onAuthStateChange.listen((perubahan) {
      if (perubahan.event == AuthChangeEvent.signedIn) _kirimToken();
    });
  }

  static Future<void> _kirimToken() async {
    if (!_aktif) return;

    final klien = supabase;
    final pengguna = klien?.auth.currentUser;
    if (klien == null || pengguna == null) return;

    try {
      final perangkat = await _tokenPerangkat();
      if (perangkat == null) return;

      await klien.from('device_tokens').upsert(
        {
          'user_id': pengguna.id,
          'token': perangkat,
          'platform': Platform.isIOS ? 'ios' : 'android',
        },
        onConflict: 'token',
      );
    } catch (_) {
      // Jaringan/RLS bermasalah: pendaftaran token akan dicoba lagi saat
      // token disegarkan atau sesi berikutnya.
    }
  }

  /// Token yang dipakai server untuk mengirim push ke perangkat ini.
  ///
  /// Server mengirim Android lewat FCM dan iOS langsung ke APNs (lihat
  /// `api/lib/push-native.js`), jadi nilai yang disimpan pun berbeda: Android
  /// memakai FCM token, iOS memakai APNs device token. APNs token kadang belum
  /// siap tepat setelah aplikasi mulai, jadi dicoba beberapa kali dulu.
  static Future<String?> _tokenPerangkat() async {
    final fcm = FirebaseMessaging.instance;
    if (!Platform.isIOS) return fcm.getToken();

    for (var percobaan = 0; percobaan < 10; percobaan++) {
      final apns = await fcm.getAPNSToken();
      if (apns != null) return apns;
      await Future<void>.delayed(const Duration(milliseconds: 500));
    }
    return null;
  }

  /// Hapus token milik pengguna saat ini. Harus dipanggil SEBELUM `signOut()`
  /// karena policy RLS hanya mengizinkan penghapusan saat masih terautentikasi.
  static Future<void> hapusToken() async {
    if (!_aktif) return;

    final klien = supabase;
    if (klien == null) return;

    try {
      final perangkat = await _tokenPerangkat();
      if (perangkat == null) return;
      await klien.from('device_tokens').delete().eq('token', perangkat);
    } catch (_) {
      // Diamkan: batas terjauhnya token lama ikut dibersihkan saat gagal kirim.
    }
  }
}
