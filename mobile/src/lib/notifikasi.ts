import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Notifikasi di aplikasi native.
//
// Catatan penting soal batasan, karena ini sering disalahpahami:
//
// - Notifikasi LOKAL (dijadwalkan dari dalam aplikasi) tetap jalan di Expo Go.
//   Ini dipakai untuk pengingat yang dibuat di perangkat itu sendiri
// - Notifikasi REMOTE (dikirim dari server) TIDAK jalan di Expo Go sejak SDK 53.
//   Membutuhkannya development build plus kredensial push
//
// Jadi untuk tahap sekarang, yang bisa diuji tanpa kredensial apa pun adalah
// notifikasi lokal. Pengiriman dari server menyusul setelah ada development
// build.
//
// Channel Android dibuat lebih awal supaya pengingat yang masuk tidak
// fingernal dengan suara default sistem saat aplikasi belum pernah dibuka
// sebelumnya.

function pesanGalat(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

const KANAL_REMINDER = 'pengingat-jadwal';
const KANAL_TUGAS = 'tugas';

let channelSiap: Promise<void> | null = null;

/** Membuat channel Android. Di iOS tidak ada channel, notifikasi selalu tampil. */
export function siapkanChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (channelSiap) return channelSiap;

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
  })().catch((error) => {
    console.warn('[notifikasi] gagal membuat channel:', pesanGalat(error));
  });

  return channelSiap;
}

export type IzinNotifikasi = 'belum' | 'ya' | 'tidak';

export async function cekIzinNotifikasi(): Promise<IzinNotifikasi> {
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
export async function mintaIzinNotifikasi(): Promise<IzinNotifikasi> {
  try {
    const sekarang = await Notifications.getPermissionsAsync();

    if (sekarang.granted) return 'ya';

    const hasil = await Notifications.requestPermissionsAsync();
    if (hasil.granted) {
      await siapkanChannel();
      return 'ya';
    }

    return hasil.canAskAgain ? 'belum' : 'tidak';
  } catch (error) {
    console.warn('[notifikasi] gagal meminta izin:', pesanGalat(error));
    return 'belum';
  }
}

export interface JadwalPengingat {
  judul: string;
  isi: string;
  /** ISO waktu mulai jadwal yang dao-ingatkan. */
  mulaiIso: string;
  selesaiIso?: string | null;
  jadwalId: string;
}

/**
 * Menampilkan pengingat sebagai notifikasi lokal.
 *
 * Hanya dipakai untuk menguji alur notifikasi tanpa server. Pengiriman sungguhan
 * ke semua staf dilakukan lewat endpoint push yang sudah ada di aplikasi web.
 */
export async function ingatkanSekarang(pengingat: JadwalPengingat): Promise<void> {
  await siapkanChannel();

  const mulai = new Date(pengingat.mulaiIso).getTime();
  const selesai = pengingat.selesaiIso
    ? new Date(pengingat.selesaiIso).getTime()
    : null;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: pengingat.judul,
      body: pengingat.isi,
      data: { jadwal_id: pengingat.jadwalId },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Math.min(mulai, Date.now() + 1000)),
      channelId: Platform.OS === 'android' ? KANAL_REMINDER : undefined,
    },
  });

  // Android 12 ke atas memakai exacta alarm untuk notifikasi yang perlu tepat
  // waktu. Izin ini hanya diminta kalau pengingat dijadwalkan ke masa depan.
  if (Platform.OS === 'android' && mulai > Date.now()) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Segera',
          body: pengingat.isi,
          data: { jadwal_id: pengingat.jadwalId },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(mulai),
          channelId: KANAL_REMINDER,
        },
      });
    } catch (error) {
      console.warn('[notifikasi] jadwal ulang gagal:', pesanGalat(error));
    }
  }

  void selesai;
}

/** Membatalkan semua pengingat yang terjadwal, dipakai saat keluar dari akun. */
export async function batalkanSemua(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn('[notifikasi] gagal membatalkan pengingat:', pesanGalat(error));
  }
}
