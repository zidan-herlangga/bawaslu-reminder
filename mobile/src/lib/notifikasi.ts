import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import {
  AMBANG_TELAT_MS,
  kalimatPengingat,
  sesiMasukJendela,
  type BarisJadwal,
} from '../shared/pengingat';
import {
  alasanTidakDidukung,
  notifikasiDidukung,
} from '../shared/dukunganNotifikasi';
import { supabase } from './supabase';

// Notifikasi di aplikasi native.
//
// -------------------------------- batasan yang harus diketahui
//
// Dua jenis notifikasi ada, dan bedanya menentukan seluruh isi berkas ini:
//
// - Notifikasi LOKAL (dijadwalkan di perangkat sendiri)
// - Notifikasi REMOTE (dikirim dari server)
//
// Keduanya hilang di Expo Go Android, dan itu bukan pilihan desain:
// paket expo-notifications melempar galat tepat saat modulnya dimuat. Di dalam
// paket itu begini:
//
//   if (isRunningInExpoGo() && !didWarn) {
//     if (Platform.OS === 'android') throw new Error(...);
//     else if (__DEV__) console.warn(...);
//   }
//
// Pemanggilnya ada di lingkup modul, lewat DevicePushTokenAutoRegistration.
// Jadi bukan hanya push yang mati: begitu `expo-notifications` diimpor di
// Expo Go Android, modul itu meledak sebelum satu pun API-nya sempat dipanggil.
//
// Di iOS Expo Go hanya muncul peringatan, jadi notifikasi lokal masih jalan.
//
// Karena itu modul ini TIDAK pernah diimpor secara statis. Impor statis akan
// menjalankan modul begitu berkas ini sendiri diimpor, dan itu cukup untuk
// membuat seluruh aplikasi gagal. Impor-nya dilakukan malas, di dalam fungsi,
// dan hanya kalau lingkungan ini memang mengizinkan.
//
// Setelah ini, remote push tetap butuh development build. Itu tidak bisa
// dihindari dari sisi kode.
//
// Catatan Android 13+: dialog izin notifikasi hanya muncul kalau minimal satu
// channel sudah ada. Karena itu channel dibuat SEBELUM izin diminta, bukan
// sesudahnya.

// 'storeClient' berarti aplikasi dijalankan dari Expo Go.
function diExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

/**
 * True kalau notifikasi boleh dipakai di lingkungan sekarang. Aturannya
 * diambil dari shared/dukunganNotifikasi supaya bisa diuji tanpa perangkat,
 * dan tidak ada dua versi kebenaran.
 */
export function notifikasiBisaDipakai(): boolean {
  return notifikasiDidukung(Platform.OS, diExpoGo());
}

/** Penjelasan singkat kalau lingkungan ini memang tidak mendukung. */
export function alasanTidakBisaDipakai(): string | null {
  return alasanTidakDidukung(Platform.OS, diExpoGo());
}

export type StatusNotifikasi = 'siap' | 'ekspo-go' | 'belum' | 'ya' | 'tidak';

const KANAL_REMINDER = 'pengingat-jadwal';

// Suara per kategori, disalin dari web (src/lib/sound.js): Rapat, Tugas, dan
// Pengawasan punya nada sendiri, kategori lain jatuh balik ke notification.wav.
// Berkas .wav dibundel ke res/raw Android lewat opsi "sounds" plugin
// expo-notifications di app.json, dan disalin manual ke
// android/app/src/main/res/raw saat build gradle langsung.
interface KanalKategori {
  /** Id channel Android. */
  id: string;
  /** Nama resource raw untuk suara (tanpa ekstensi .wav). */
  suara: string;
  warna: string;
}

const KANAL_PER_KATEGORI: Record<string, KanalKategori> = {
  Rapat: { id: 'pengingat-rapat', suara: 'rapat', warna: '#E02401' },
  Tugas: { id: 'pengingat-tugas', suara: 'tugas', warna: '#1f9d55' },
  Pengawasan: { id: 'pengingat-pengawasan', suara: 'pengawasan', warna: '#EBA83A' },
};

const KANAL_LAIN: KanalKategori = {
  id: KANAL_REMINDER,
  suara: 'notification',
  warna: '#E02401',
};

/** Channel dan suara untuk sebuah kategori. Kategori asing memakai bawaan. */
function kanalUntukKategori(kategori: string | null | undefined): KanalKategori {
  return KANAL_PER_KATEGORI[String(kategori ?? '').trim()] ?? KANAL_LAIN;
}

type ModulNotifikasi = typeof import('expo-notifications');

let modul: ModulNotifikasi | null = null;
let gagalMuat = false;
let gagalTerakhirDaftar: string | null = null;

/**
 * Alasan kegagalan pendaftaran push yang terakhir, untuk ditampilkan di layar.
 *
 * Pendaftaran ini gagal diam-diam: tidak ada galat yang dilempar, dan satu
 * kegagalan cukup untuk membuat perangkat tidak pernah menerima push. Alasan
 * ini disimpan supaya staf (dan orang yang memperbaiki aplikasi ini) bisa
 * melihat kegagalannya tanpa menyambungkan debugger.
 */
export function alasanGagalDaftarPush(): string | null {
  return gagalTerakhirDaftar;
}

function pesanGalat(kesalahan: unknown): string {
  if (kesalahan instanceof Error) return kesalahan.message;

  if (kesalahan && typeof kesalahan === 'object') {
    // Galat dari PostgREST datang sebagai objek { message, code, details, hint },
    // bukan Error. Tanpa penguraian ini templatenya menghasilkan "[object Object]"
    // dan penyebab kegagalan hilang.
    const e = kesalahan as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const bagian = [
      typeof e.message === 'string' && e.message ? e.message : null,
      typeof e.code === 'string' && e.code ? e.code : null,
      typeof e.details === 'string' && e.details ? e.details : null,
      typeof e.hint === 'string' && e.hint ? e.hint : null,
    ].filter((nilai): nilai is string => nilai !== null);
    if (bagian.length > 0) return bagian.join(' — ');
    try {
      return JSON.stringify(kesalahan);
    } catch {
      return '[galat tanpa pesan]';
    }
  }

  return String(kesalahan);
}

/**
 * Memuat expo-notifications secara malas.
 *
 * Mengembalikan null kalau lingkungan ini tidak mendukungnya, sehingga
 * pemanggil bisa melewatkannya tanpa try/catch di setiap tempat.
 */
async function muatModul(): Promise<ModulNotifikasi | null> {
  if (!notifikasiBisaDipakai()) return null;
  if (modul) return modul;
  if (gagalMuat) return null;

  try {
    modul = await import('expo-notifications');
    modul.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    return modul;
  } catch (kesalahan) {
    gagalMuat = true;
    console.warn('[notifikasi] modul tidak bisa dimuat:', pesanGalat(kesalahan));
    return null;
  }
}

let channelSiap: Promise<boolean> | null = null;

/**
 * Membuat channel Android. Di iOS tidak ada channel.
 *
 * Mengembalikan true kalau channel siap dipakai (atau tidak diperlukan, di
 * iOS), false kalau lingkungan tidak mendukung atau pembuatannya gagal.
 */
export async function siapkanChannel(): Promise<boolean> {
  const Notifications = await muatModul();
  if (!Notifications) return false;

  if (Platform.OS !== 'android') return true;

  if (!channelSiap) {
    channelSiap = (async () => {
      try {
        await Notifications.setNotificationChannelAsync(KANAL_LAIN.id, {
          name: 'Pengingat jadwal',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: KANAL_LAIN.warna,
          sound: KANAL_LAIN.suara,
        });

        // Satu channel per kategori supaya nada sistemnya berbeda-beda. Android
        // tidak mengubah suara channel yang sudah dibuat, jadi channel baru ini
        // bergantung pada installer yang baru: daftar dibuat saat aplikasi
        // pertama kali dibuka (dan setNotificationChannelAsync idempotent).
        for (const [nama, kanal] of Object.entries(KANAL_PER_KATEGORI)) {
          await Notifications.setNotificationChannelAsync(kanal.id, {
            name: `Pengingat ${nama}`,
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: kanal.warna,
            sound: kanal.suara,
          });
        }

        return true;
      } catch (kesalahan) {
        // Dikosongkan supaya panggilan berikutnya boleh mencoba lagi.
        channelSiap = null;
        console.warn('[notifikasi] gagal membuat channel:', pesanGalat(kesalahan));
        return false;
      }
    })();
  }

  return channelSiap;
}

/**
 * Status izin notifikasi. `ekspo-go` berarti lingkungan ini memang tidak
 * mendukung notifikasi, bukan bahwa izinnya ditolak.
 */
export async function cekIzinNotifikasi(): Promise<StatusNotifikasi> {
  const Notifications = await muatModul();
  if (!Notifications) return 'ekspo-go';

  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'ya';
    return canAskAgain ? 'belum' : 'tidak';
  } catch {
    return 'belum';
  }
}

/**
 * Meminta izin notifikasi. Harus dipanggil dari gestur pengguna, misalnya
 * saat tombol ditekan: di Android, permintaan di luar gestur tidak akan
 * menampilkan dialog.
 */
export async function mintaIzinNotifikasi(): Promise<StatusNotifikasi> {
  const Notifications = await muatModul();
  if (!Notifications) return 'ekspo-go';

  try {
    // Channel harus ada lebih dulu, kalau tidak dialog izin di Android 13+
    // tidak akan muncul.
    await siapkanChannel();

    const sekarang = await Notifications.getPermissionsAsync();
    if (sekarang.granted) return 'ya';

    const hasil = await Notifications.requestPermissionsAsync();
    if (hasil.granted) return 'ya';

    return hasil.canAskAgain ? 'belum' : 'tidak';
  } catch (kesalahan) {
    console.warn('[notifikasi] gagal meminta izin:', pesanGalat(kesalahan));
    return 'belum';
  }
}

/** Membuka pengaturan sistem untuk aplikasi ini. Dipakai saat izin sudah
 * ditolak dan tidak bisa diminta lagi dari dalam aplikasi.
 */
export async function bukaPengaturanSistem(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (kesalahan) {
    console.warn('[notifikasi] gagal membuka pengaturan:', pesanGalat(kesalahan));
  }
}

/**
 * Mendaftarkan perangkat ini ke tabel device_tokens supaya server bisa
 * mengirim push lewat FCM atau APNs.
 *
 * Hanya untuk native. Di web, push ditangani PWA sendiri lewat service
 * worker dan tabel push_subscriptions, dan token yang dipakai adalah token
 * browser, bukan FCM atau APNs. Menuliskan token browser ke device_tokens
 * akan menghasilkan baris yang tidak pernah bisa dikirimi.
 *
 * Penjaga di notifikasiBisaDipakai() tidak bisa dipakai di sini: dia
 * mengembalikan true di web, karena notifikasi lokal di web memang tidak
 * salah apa pun. Tapi getDevicePushTokenAsync di web melempar galat
 *
 *   You must provide `notification.vapidPublicKey` in `app.json`
 *
 * Pola yang sama seperti pesan teknis lain dari expo-notifications:
 * pesan yang tidak menjelaskan apa pun ke pengguna.
 *
 * Mengembalikan false di sini bukan kesalahan. Pemanggil tidak perlu tahu
 * alasannya, dan tidak perlu mencoba lagi.
 */
export async function daftarTokenPush(userId: string): Promise<boolean> {
  // Web pakai jalur push-nya sendiri. Lihat catatan panjang di atas.
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;

  const Notifications = await muatModul();
  if (!Notifications) {
    gagalTerakhirDaftar =
      'Modul notifikasi tidak tersedia di build ini (Expo Go Android tidak didukung).';
    return false;
  }

  try {
    await siapkanChannel();

    // Token perangkat hanya ada di development build. Di Expo Go, jalur ini
    // sudah berhenti di atas, jadi tidak perlu penanganan terpisah.
    const perangkat = await Notifications.getDevicePushTokenAsync();
    const token = perangkat.data;

    if (typeof token !== 'string' || !token) {
      gagalTerakhirDaftar =
        'Token dari perangkat kosong. Firebase belum memberi token — cek paket ' +
        'google-services.json dan akun Google pada HP.';
      return false;
    }

    // onConflict harus menunjuk sebuah batasan unique yang benar-benar ada.
    // device_tokens punya unique(token), bukan unique(user_id, token), jadi
    // menunjuk kolom yang salah membuat PostgREST menolak seluruh upsert. Satu
    // token milik satu perangkat, jadi token sudah cukup untuk mengenali
    // perangkat yang sama setelah reinstall atau ganti akun.
    const { error } = await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      },
      { onConflict: 'token' }
    );

    if (error) {
      gagalTerakhirDaftar = `Menyimpan token ditolak server: ${pesanGalat(error)}`;
      console.warn('[notifikasi] gagal menyimpan token:', pesanGalat(error));
      return false;
    }

    gagalTerakhirDaftar = null;
    return true;
  } catch (kesalahan) {
    gagalTerakhirDaftar = `Mengambil token perangkat melempar galat: ${pesanGalat(kesalahan)}`;
    console.warn('[notifikasi] gagal mengambil token:', pesanGalat(kesalahan));
    return false;
  }
}

/**
 * Mendaftarkan token dengan beberapa kali percobaan.
 *
 * Pendaftaran token cukup satu kali gagal untuk membuat perangkat ini tidak
 * pernah menerima push: server tidak tahu token-nya ada, dan tidak ada proses
 * lain yang akan mencoba lagi sampai staf menutup lalu membuka aplikasinya.
 *
 * Penyebab kegagalan sementara itu nyata dan sering: jaringan seluler belum siap
 * saat aplikasi dibuka, Supabase belum menjawab, atau modul native belum selesai
 * diinisialisasi. Semuanya akan berhasil pada percobaan berikutnya.
 *
 * Karena itu percobaan diulang dengan jeda yang makin panjang. Kalau seluruh
 * percobaan gagal, hasilnya tetap hanya false, tetapi logging menyebutkan
 * jumlahnya, supaya masalahnya bisa dicari dari log dan bukan dari tebakan.
 */
export async function daftarTokenPushDenganUlang(
  userId: string,
  percobaanMaks = 3,
  jedaDasarMs = 1500
): Promise<boolean> {
  for (let ke = 1; ke <= percobaanMaks; ke += 1) {
    const berhasil = await daftarTokenPush(userId);
    if (berhasil) return true;

    if (ke >= percobaanMaks) break;

    const jeda = jedaDasarMs * 2 ** (ke - 1);
    console.warn(
      `[notifikasi] pendaftaran token gagal, mengulang dalam ${jeda} ms ` +
        `(percobaan ${ke} dari ${percobaanMaks})`
    );
    await new Promise((selesai) => setTimeout(selesai, jeda));
  }

  console.warn(
    `[notifikasi] pendaftaran token gagal ${percobaanMaks} kali. ` +
      'Push dari server tidak akan sampai ke perangkat ini sampai aplikasi ' +
      'dibuka lagi.'
  );
  return false;
}

/**
 * Menjadwalkan pengingat untuk setiap sesi pada satu jadwal.
 *
 * Satu jadwal bisa punya beberapa sesi, jadi semuanya dijadwalkan. Sesi yang
 * waktunya sudah lewat tidak dijadwalkan, karena notifikasi untuk waktu yang
 * sudah pergi hanya akan muncul telat dan membingungkan.
 */
export async function jadwalkanPengingatJadwal(
  jadwal: JadwalPengingat[],
  now: number = Date.now()
): Promise<number> {
  let dijadwalkan = 0;

  for (const pengingat of jadwal) {
    const mulai = new Date(pengingat.mulaiIso).getTime();
    if (Number.isNaN(mulai) || mulai <= now) continue;

    const berhasil = await ingatkanSekarang(pengingat);
    if (berhasil) dijadwalkan += 1;
  }

  return dijadwalkan;
}

export interface JadwalPengingat {
  judul: string;
  isi: string;
  /** ISO waktu mulai yang akan diingatkan. */
  mulaiIso: string;
  jadwalId: string;
  /** Kategori jadwal, untuk memilih nada notifikasi yang sesuai. */
  kategori?: string | null;
}

/**
 * Menjalankan penjadwalan otomatis untuk semua sesi yang akan datang.
 *
 * Dipanggil dari pemanggil yang melihat daftar jadwal berubah, supaya pengguna
 * tidak perlu menekan apa pun. Android membatalkan semua notifikasi terjadwal
 * begitu aplikasi ditutup, jadi penjadwalan ulang setiap kali daftar jadwal
 * berubah adalah satu-satunya cara agar pengingat tetap hidup.
 *
 * Divisi yang sedang login dipakai untuk menyaring: jadwal yang menyasar
 * divisi lain tidak boleh berbunyi di ponsel staf ini. Tanpa penyaringan, satu
 * jadwal yang disasar ke seluruh divisi akan membunyikan ponsel semua staf, dan
 * cepat atau lambat mereka akan mematikan notifikasinya.
 *
 * Mengembalikan jumlah sesi yang benar-benar dijadwalkan. Tidak melempar galat:
 * kegagalan menjadwalkan satu sesi tidak boleh menghentikan penggiliran yang
 * lain, dan pengguna tidak bisa memperbaiki apa pun dari dalam aplikasi.
 */
export async function jadwalkanOtomatis(
  baris: readonly BarisJadwal[],
  now: number = Date.now(),
  divisi: string | null = null
): Promise<number> {
  const Notifications = await muatModul();
  if (!Notifications) return 0;

  const siap = await siapkanChannel();
  if (!siap) return 0;

  // Izin belum diberikan berarti Android akan membuang notifikasi yang
  // dijadwalkan, jadi tidak ada gunanya menjadwalkan apa pun.
  const izin = await cekIzinNotifikasi();
  if (izin !== 'ya') return 0;

  const kandidat = sesiMasukJendela(
    baris as BarisJadwal[],
    now,
    // Jendela dijaga lebih luas dari banner supaya sesi yang masih beberapa jam
    // ke depan ikut dijadwalkan. Notifikasi sistem tidak perlu aplikasi terbuka,
    // jadi pengguna bisa diperingatkan jauh-jauh hari.
    24 * 60 * 60 * 1000,
    AMBANG_TELAT_MS,
    divisi
  );

  let dijadwalkan = 0;
  const kategoriById = new Map(
    baris
      .filter((item): item is BarisJadwal => Boolean(item.id))
      .map((item) => [item.id, item.kategori ?? null])
  );

  for (const item of kandidat) {
    // Sesi yang sudah lewat tidak dijadwalkan: notifikasi untuk waktu yang
    // sudah pergi hanya muncul telat dan membingungkan.
    if (item.mulai <= now) continue;

    const kanal = kanalUntukKategori(kategoriById.get(item.jadwalId) ?? null);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.judul,
          body: kalimatPengingat(item),
          data: { jadwal_id: item.jadwalId },
          sound: kanal.suara,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(item.mulai),
          channelId: kanal.id,
        },
      });
      dijadwalkan += 1;
    } catch (kesalahan) {
      console.warn('[notifikasi] gagal menjadwalkan sesi:', pesanGalat(kesalahan));
    }
  }

  return dijadwalkan;
}

/**
 * Menjadwalkan pengingat sebagai notifikasi lokal.
 *
 * Dipakai untuk menguji alur notifikasi tanpa server. Kalau waktu mulai sudah
 * lewat, notifikasi muncul satu detik dari sekarang. Kalau lingkungannya tidak
 * mendukung, mengembalikan false supaya pemanggil bisa memberi tahu pengguna
 * alih-alih diam saja.
 */
export async function ingatkanSekarang(
  pengingat: JadwalPengingat
): Promise<boolean> {
  const Notifications = await muatModul();
  if (!Notifications) return false;

  const siap = await siapkanChannel();
  if (!siap) return false;

  const mulai = new Date(pengingat.mulaiIso).getTime();
  const kapan = new Date(mulai > Date.now() ? mulai : Date.now() + 1000);
  const kanal = kanalUntukKategori(pengingat.kategori);

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: pengingat.judul,
        body: pengingat.isi,
        data: { jadwal_id: pengingat.jadwalId },
        sound: kanal.suara,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: kapan,
        channelId: Platform.OS === 'android' ? kanal.id : undefined,
      },
    });
    return true;
  } catch (kesalahan) {
    console.warn('[notifikasi] gagal menjadwalkan:', pesanGalat(kesalahan));
    return false;
  }
}

/**
 * Menampilkan notifikasi seketika, tanpa menunggu.
 *
 * Dipakai untuk notifikasi yang baru masuk ke kotak masuk selagi aplikasi
 * sedang terbuka. Tanpa ini, notifikasi cuma menambah angka di badge, dan
 * angka itu tidak menaikkan kepala staf yang sedang mengerjakan hal lain.
 *
 * Kenapa memakai notifikasi sistem dan bukan memutar file suara sendiri:
 * - Suara, heads-up, dan getaran sudah ditangani sistem, sesuai pengaturan
 *   perangkat masing-masing staf.
 * - Tidak perlu dependensi pemutar audio dan tidak perlu menyalin file .wav
 *   ke dalam aplikasi.
 * - Tidak ada AudioContext yang harus tetap hidup supaya suara tidak terpotong.
 *
 * Peringatan: kalau notifikasi remote (FCM) aktif nanti, baris yang sama bisa
 * sampai dua kali, karena push dari server dan pemuatan lokal keduanya akan
 * menampilkannya. Saat itu pemanggil harus menandai id yang sudah lewat suara
 * agar tidak mempresentasikan dua kali, seperti yang dilakukan web dengan
 * silencedRef.
 */
export async function tampilkanSekarang(item: {
  judul: string;
  pesan: string;
  jadwalId: string | null;
  kategori?: string | null;
}): Promise<boolean> {
  const Notifications = await muatModul();
  if (!Notifications) return false;

  const siap = await siapkanChannel();
  if (!siap) return false;

  // Android membuang notifikasi yang terjadwal maupun yang seketika kalau izinnya
  // belum ada, jadi presenting tanpa izin hanya kerja sia-sia.
  const izin = await cekIzinNotifikasi();
  if (izin !== 'ya') return false;

  const kanal = kanalUntukKategori(item.kategori);

  try {
    // Channel yang dipakai harus disebutkan supaya nada sistem mengikuti
    // kategori. trigger: null tidak bisa membawa channelId, jadi di Android
    // notifikasi dijadwalkan beberapa milidetik ke depan melalui kanal yang
    // tepat; hasilnya tetap seketika bagi pengguna.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.judul,
        body: item.pesan,
        data: item.jadwalId ? { jadwal_id: item.jadwalId } : undefined,
        sound: kanal.suara,
      },
      trigger:
        Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(Date.now() + 250),
              channelId: kanal.id,
            }
          : null,
    });
    return true;
  } catch (kesalahan) {
    console.warn('[notifikasi] gagal menampilkan:', pesanGalat(kesalahan));
    return false;
  }
}

/** Membatalkan semua pengingat yang terjadwal. */
export async function batalkanSemua(): Promise<void> {
  const Notifications = await muatModul();
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (kesalahan) {
    console.warn('[notifikasi] gagal membatalkan pengingat:', pesanGalat(kesalahan));
  }
}

/** Pesan yang jujur untuk ditampilkan di layar Akun. */
export function pesanStatus(status: StatusNotifikasi): string {
  switch (status) {
    case 'ya':
      return 'Diizinkan';
    case 'tidak':
      return 'Ditolak';
    case 'ekspo-go':
      return 'Tidak tersedia di Expo Go';
    case 'siap':
      return 'Siap digunakan';
    default:
      return 'Belum diminta';
  }
}