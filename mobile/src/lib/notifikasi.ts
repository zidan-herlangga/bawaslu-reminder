import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
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
const KANAL_TUGAS = 'tugas';

type ModulNotifikasi = typeof import('expo-notifications');

let modul: ModulNotifikasi | null = null;
let gagalMuat = false;

function pesanGalat(kesalahan: unknown): unknown {
  return kesalahan instanceof Error ? kesalahan.message : kesalahan;
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
        await Notifications.setNotificationChannelAsync(KANAL_REMINDER, {
          name: 'Pengingat jadwal',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0071e3',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync(KANAL_TUGAS, {
          name: 'Tugas',
          importance: Notifications.AndroidImportance.DEFAULT,
          lightColor: '#1f9d55',
          sound: 'default',
        });

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
 * Pola yang sama seperti yang sudah kita dealing di expo-notifications:
 * pesan teknis yang tidak menjelaskan apa pun ke pengguna.
 *
 * Mengembalikan false di sini bukan kesalahan. Pemanggil tidak perlu tahu
 * alasannya, dan tidak perlu mencoba lagi.
 */
export async function daftarTokenPush(userId: string): Promise<boolean> {
  // Web pakai jalur push-nya sendiri. Lihat catatan panjang di atas.
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;

  const Notifications = await muatModul();
  if (!Notifications) return false;

  try {
    await siapkanChannel();

    // Token perangkat hanya ada di development build. Di Expo Go, jalur ini
    // sudah berhenti di atas, jadi tidak perlu penanganan terpisah.
    const perangkat = await Notifications.getDevicePushTokenAsync();
    const token = perangkat.data;

    if (typeof token !== 'string' || !token) return false;

    const { error } = await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        diperbarui_pada: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );

    if (error) {
      console.warn('[notifikasi] gagal menyimpan token:', pesanGalat(error));
      return false;
    }

    return true;
  } catch (kesalahan) {
    console.warn('[notifikasi] gagal mengambil token:', pesanGalat(kesalahan));
    return false;
  }
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

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: pengingat.judul,
        body: pengingat.isi,
        data: { jadwal_id: pengingat.jadwalId },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: kapan,
        channelId: Platform.OS === 'android' ? KANAL_REMINDER : undefined,
      },
    });
    return true;
  } catch (kesalahan) {
    console.warn('[notifikasi] gagal menjadwalkan:', pesanGalat(kesalahan));
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