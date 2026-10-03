import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  alasanTidakDidukung,
  notifikasiDidukung,
} from '../shared/dukunganNotifikasi';

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
    console.warn(
      '[notifikasi] modul tidak bisa dimuat:',
      kesalahan instanceof Error ? kesalahan.message : kesalahan
    );
    return null;
  }
}

let channelSiap: Promise<void> | null = null;

/** Membuat channel Android. Di iOS tidak ada channel. */
export async function siapkanChannel(): Promise<boolean> {
  const Notifications = await muatModul();
  if (!Notifications) return false;

  if (Platform.OS !== 'android') return true;
  if (channelSiap) {
    await channelSiap;
    return true;
  }

  channelSiap = (async () => {
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
  })().catch((kesalahan) => {
    channelSiap = null;
    console.warn(
      '[notifikasi] gagal membuat channel:',
      kesalahan instanceof Error ? kesalahan.message : kesalahan
    );
  });

  await channelSiap;
  return true;
}

/**
 * Status izin notifikasi. `ekspo-go` berarti lingkungan ini memang tidak
 * mendukung notifikasi, bukan bahwa izinnya ditolak.
 */
export async function cekIzinNotifikasi(): Promise<StatusNotifikasi> {
  if (!notifikasiBisaDipakai()) return 'ekspo-go';

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
  if (!notifikasiBisaDipakai()) return 'ekspo-go';

  const Notifications = await muatModul();
  if (!Notifications) return 'ekspo-go';

  try {
    const sekarang = await Notifications.getPermissionsAsync();
    if (sekarang.granted) return 'ya';

    const hasil = await Notifications.requestPermissionsAsync();
    if (hasil.granted) {
      await siapkanChannel();
      return 'ya';
    }

    return hasil.canAskAgain ? 'belum' : 'tidak';
  } catch (kesalahan) {
    console.warn(
      '[notifikasi] gagal meminta izin:',
      kesalahan instanceof Error ? kesalahan.message : kesalahan
    );
    return 'belum';
  }
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
 * Dipakai untuk menguji alur notifikasi tanpa server. Kalau lingkungannya
 * tidak mendukung, mengembalikan false supaya pemanggil bisa memberi tahu
 * pengguna alih-alih diam saja.
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
    console.warn(
      '[notifikasi] gagal menjadwalkan:',
      kesalahan instanceof Error ? kesalahan.message : kesalahan
    );
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
    console.warn(
      '[notifikasi] gagal membatalkan pengingat:',
      kesalahan instanceof Error ? kesalahan.message : kesalahan
    );
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
    default:
      return 'Belum diminta';
  }
}
