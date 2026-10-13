// Fans-out pengingat ke seluruh penerima, lalu mengirim lewat web push dan FCM/APNs.
//
// Logika ini dulu tertanam di dalam api/notify.js. Sekarang dipisah ke modul
// sendiri karena ada dua pemanggil yang membutuhkannya: tombol "Ingatkan" yang
// ditekan manusia, dan api/pengingat-terjadwal.js yang dipanggil cron. Satu
// salinan berarti hanya ada satu tempat yang bisa salah.
//
// Semua pengiriman memakai service role, jadi RLS dilewati sepenuhnya di sini.
// Daftar penerima dihitung ulang dari schedules.target_divisi, bukan dari sesi.
// Kalau suatu saat RLS berubah, pengiriman cron tidak ikut berubah diam-diam.

import webpush from 'web-push';
import { apnsSiap, kirimKeNative, pushNativeSiap } from './push-native.js';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

// Tiap kategori memakai judul notifikasi sendiri supaya penerima langsung
// tahu jenis pengingat dari notifikasi, bukan harus membuka aplikasi dulu.
// Nilai `tag` juga dibedakan supaya notifikasi kategori berbeda tidak saling
// menggantikan di panel notifikasi perangkat.
const NOTIFIKASI_PER_KATEGORI = {
  Rapat: { judul: 'Pengingat Rapat', tag: 'bRi-rapat' },
  Tugas: { judul: 'Pengingat Tugas', tag: 'bRi-tugas' },
  Pengawasan: { judul: 'Pengawasan Jadwal', tag: 'bRi-pengawasan' },
};

const DEFAULT_NOTIFIKASI = { judul: 'Pengingat Jadwal', tag: 'bRi-jadwal' };

export function notifikasiUntuk(kategori) {
  return NOTIFIKASI_PER_KATEGORI[kategori] ?? DEFAULT_NOTIFIKASI;
}

export function jamWIB(iso) {
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${HARI[wib.getUTCDay()]}, ${wib.getUTCDate()} ${BULAN[wib.getUTCMonth()]} ` +
    `${wib.getUTCFullYear()}, ${pad(wib.getUTCHours())}.${pad(wib.getUTCMinutes())} WIB`
  );
}

/**
 * Slot yang paling dekat di satu jadwal.
 *
 * Satu jadwal bisa punya beberapa slot. Pengingat otomatis harus menyebut slot
 * yang sedang mendekati, bukan jadwal pertamanya, karena itulah yang pengikutnya
 * tunggu. Kalau tidak, pengingat untuk slot sore akan menyebut jam pagi.
 */
export function slotTerdekat(jadwal, sekarang = Date.now()) {
  const slot = Array.isArray(jadwal?.slots) ? jadwal.slots : [];
  const waktu = slot
    .map((item) => new Date(item?.mulai).getTime())
    .filter((value) => Number.isFinite(value));
  return waktu.length > 0 ? Math.min(...waktu) : null;
}

/**
 * Susun kalimat pesan.
 *
 * Dipisah agar pengingat otomatis bisa memeriksa duplikat dengan membandingkan
 * kalimat yang sama persis, bukan hanya membandingkan id jadwal.
 */
export function susunPesan(jadwal, waktu) {
  const target = jadwal.target_divisi ?? 'semua staf';
  return `${jadwal.judul} - ${jamWIB(waktu)}. Ditujukan untuk ${target}.`;
}

/**
 * Penerima untuk satu jadwal: profil yang divisinya cocok, kecuali bila
 * target_divisi kosong berarti semua staf, dan tanpa pembuat jadwal itu sendiri.
 */
async function cariPenerima(admin, jadwal, pengirimId) {
  let query = admin.from('profiles').select('id, divisi');
  if (jadwal.target_divisi) query = query.eq('divisi', jadwal.target_divisi);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).filter((item) => item.id !== pengirimId);
}

/**
 * Penerima yang sudah menerima kalimat pesan ini.
 *
 * Dipisah dari akses database supaya aturannya bisa diuji tanpa server.
 */
export function penerimaSudahDiberiTahu(rows, pesan) {
  return new Set(
    (rows ?? []).filter((row) => row.pesan === pesan).map((row) => row.penerima_id)
  );
}

/**
 * Penerima yang belum diberi tahu untuk pesan ini dalam 30 menit terakhir.
 *
 * Cron berjalan setiap menit dan jendela pengingat lasts 15 menit,
 * jadi tanpa ini satu jadwal akan menghasilkan tiga sampai empat notifikasi
 * untuk orang yang sama.
 *
 * Pencocokan memakai kalimat pesan, bukan hanya jadwal_id, karena satu jadwal
 * bisa punya beberapa slot yang masing-masing perlu pengingat sendiri.
 */
async function tanpaPengingatBaru(admin, jadwalId, pesan) {
  const sejak = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from('notifications')
    .select('penerima_id, pesan')
    .eq('jadwal_id', jadwalId)
    .gte('created_at', sejak);

  if (error) throw new Error(error.message);

  return penerimaSudahDiberiTahu(data, pesan);
}

/**
 * Kirim pengingat untuk satu jadwal pada satu waktu.
 *
 * admin harus client service role. Pengirim dipakai hanya sebagai kolom
 * pengirim_id; penerima tetap dihitung dari seluruh staf yang relevan.
 */
export async function kirimPengingat(admin, { jadwal, pengirimId, waktu, lewatiSudahDikirim = false }) {
  const waktuTampil = waktu ?? jadwal.waktu_mulai;
  const label = notifikasiUntuk(jadwal.kategori);
  const pesan = susunPesan(jadwal, waktuTampil);

  let penerima = await cariPenerima(admin, jadwal, pengirimId);

  if (lewatiSudahDikirim) {
    const sudah = await tanpaPengingatBaru(admin, jadwal.id, pesan);
    if (sudah.size > 0) {
      penerima = penerima.filter((item) => !sudah.has(item.id));
    }
  }

  if (penerima.length === 0) {
    return { terkirim: 0, push: 0, pushWeb: 0, pushNative: 0, pesan, catatan: 'Tidak ada penerima yang perlu diberi tahu.' };
  }

  const rows = penerima.map((item) => ({
    jadwal_id: jadwal.id,
    pengirim_id: pengirimId,
    penerima_id: item.id,
    judul: label.judul,
    pesan,
    target_divisi: jadwal.target_divisi,
  }));

  const { data: inserted, error: insertError } = await admin
    .from('notifications')
    .insert(rows)
    .select('id, penerima_id');

  if (insertError) throw new Error(insertError.message);

  const idByUser = new Map((inserted ?? []).map((row) => [row.penerima_id, row.id]));
  const recipientIds = penerima.map((item) => item.id);

  const { data: subscriptions, error: subError } = await admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', recipientIds);

  if (subError) {
    return {
      terkirim: penerima.length,
      push: 0,
      pushWeb: 0,
      pushNative: 0,
      pesan,
      catatan: `Notifikasi tersimpan, tetapi langganan push gagal dibaca: ${subError.message}`,
    };
  }

  const daftarWeb = subscriptions ?? [];

  // Perangkat native dilampirkan pada pengiriman yang sama. Satu endpoint untuk
  // web dan native, supaya aplikasi tidak perlu memilih jalurnya sendiri dan
  // tidak ada dua tempat yang bisa gagal diam-diam.
  const { data: deviceTokens, error: deviceError } = await admin
    .from('device_tokens')
    .select('user_id, token, platform')
    .in('user_id', recipientIds);

  if (deviceError) {
    console.warn('[pengingat] gagal membaca token perangkat:', deviceError.message);
  }

  const daftarPerangkat = deviceTokens ?? [];

  if (daftarWeb.length === 0 && daftarPerangkat.length === 0) {
    return {
      terkirim: penerima.length,
      push: 0,
      pushWeb: 0,
      pushNative: 0,
      pesan,
      catatan: 'Belum ada penerima yang mengaktifkan notifikasi.',
    };
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@bawaslu.go.id',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const expired = [];
  const results = daftarWeb.length
    ? await Promise.allSettled(
        daftarWeb.map((item) => {
          const payload = JSON.stringify({
            title: label.judul,
            body: pesan,
            url: '/',
            id: idByUser.get(item.user_id) ?? null,
            kategori: jadwal.kategori ?? null,
            tag: `${label.tag}-${idByUser.get(item.user_id) ?? item.user_id}`,
          });

          return webpush
            .sendNotification(
              {
                endpoint: item.endpoint,
                keys: { p256dh: item.p256dh, auth: item.auth },
              },
              payload
            )
            .catch((error) => {
              const status = error?.statusCode;
              if (status === 404 || status === 410) expired.push(item.endpoint);
              throw error;
            });
        })
      )
    : [];

  if (expired.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', expired);
  }

  const pushWeb = results.filter((item) => item.status === 'fulfilled').length;

  // Native dikirim terpisah dan tidak boleh menggagalkan hasil web. Kalau
  // kredensial push native belum diisi, tahap ini dilewati diam-diam supaya
  // notifikasi ke pengguna web tetap jalan.
  let pushNative = 0;
  let nativeKedaluwarsa = 0;
  const catatanNative = [];

  const siapAndroid = pushNativeSiap();
  const siapApple = apnsSiap();
  const adaAndroid = daftarPerangkat.some((item) => item.platform === 'android');
  const adaIos = daftarPerangkat.some((item) => item.platform === 'ios');

  const perluAndroid = adaAndroid && siapAndroid;
  const perluIos = adaIos && siapApple;

  if (daftarPerangkat.length > 0 && (perluAndroid || perluIos)) {
    const yangDikirim = daftarPerangkat.filter((item) =>
      item.platform === 'ios' ? perluIos : perluAndroid
    );

    const hasilNative = await kirimKeNative(yangDikirim, {
      title: label.judul,
      body: pesan,
      tag: `${label.tag}-${jadwal.id}`,
      data: {
        schedule_id: jadwal.id,
        kategori: jadwal.kategori ?? null,
      },
    });

    pushNative = hasilNative.terkirim;

    nativeKedaluwarsa = hasilNative.kedaluwarsa.length;
    if (hasilNative.kedaluwarsa.length > 0) {
      await admin.from('device_tokens').delete().in('token', hasilNative.kedaluwarsa);
    }

    if (hasilNative.alasan.length > 0) {
      catatanNative.push(`${hasilNative.alasan.length} perangkat gagal: ${hasilNative.alasan[0]}`);
    }
  } else if (daftarPerangkat.length > 0) {
    catatanNative.push(
      siapAndroid || siapApple
        ? 'Token perangkat ada, tetapi tidak ada kredensial push yang cocok dengan platformnya.'
        : 'Kredensial push native belum diisi di server.'
    );
  }

  const totalPerangkat = daftarWeb.length + daftarPerangkat.length;
  const totalTerkirim = pushWeb + pushNative;
  const jumlahDibersihkan = expired.length + nativeKedaluwarsa;
  const catatan = [
    totalTerkirim < totalPerangkat
      ? `${totalPerangkat - totalTerkirim} perangkat tidak bisa dijangkau.`
      : '',
    jumlahDibersihkan > 0 ? `${jumlahDibersihkan} token mati sudah dibersihkan.` : '',
    ...catatanNative,
  ]
    .filter(Boolean)
    .join(' ');

  return { terkirim: penerima.length, push: totalTerkirim, pushWeb, pushNative, pesan, catatan };
}

/**
 * Kirim notifikasi ke SELURUH perangkat satu penerima (langganan web + token
 * native), lalu bersihkan token/endpoint yang sudah mati.
 *
 * Dipakai untuk hal yang tidak punya jadwal, misalnya "Tugas baru" yang dibuat
 * di web untuk mengingatkan pemiliknya di perangkat lain. Jangan dipakai yang
 * butuh banyak penerima; pakai kirimPengingat().
 */
export async function kirimKePenerima(
  admin,
  { penerimaId, judul, pesan, kategori, kotakId = null, data = {} }
) {
  const hasil = { terkirim: 0, pushWeb: 0, pushNative: 0, alasan: [] };
  const label = notifikasiUntuk(kategori);
  const tag = `${label.tag}-${kotakId ?? penerimaId}`;

  const { data: subscriptions, error: subError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', penerimaId);
  if (subError) {
    hasil.alasan.push(`Langganan push gagal dibaca: ${subError.message}`);
  }
  const daftarWeb = subscriptions ?? [];

  const { data: devices, error: deviceError } = await admin
    .from('device_tokens')
    .select('token, platform')
    .eq('user_id', penerimaId);
  if (deviceError) {
    hasil.alasan.push(`Token perangkat gagal dibaca: ${deviceError.message}`);
  }
  const daftarPerangkat = devices ?? [];

  if (daftarWeb.length === 0 && daftarPerangkat.length === 0) {
    hasil.alasan.push('Belum ada perangkat yang terdaftar untuk akun ini.');
    return hasil;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@bawaslu.go.id',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const expiredWeb = [];
  const results = daftarWeb.length
    ? await Promise.allSettled(
        daftarWeb.map((item) => {
          const payload = JSON.stringify({
            title: judul,
            body: pesan,
            url: '/',
            id: kotakId,
            kategori,
            tag,
          });

          return webpush
            .sendNotification(
              {
                endpoint: item.endpoint,
                keys: { p256dh: item.p256dh, auth: item.auth },
              },
              payload
            )
            .catch((error) => {
              const status = error?.statusCode;
              if (status === 404 || status === 410) expiredWeb.push(item.endpoint);
              throw error;
            });
        })
      )
    : [];

  if (expiredWeb.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', expiredWeb);
  }

  hasil.pushWeb = results.filter((item) => item.status === 'fulfilled').length;

  const siapAndroid = pushNativeSiap();
  const siapApple = apnsSiap();
  const adaAndroid = daftarPerangkat.some((item) => item.platform === 'android');
  const adaIos = daftarPerangkat.some((item) => item.platform === 'ios');
  const perluAndroid = adaAndroid && siapAndroid;
  const perluIos = adaIos && siapApple;

  if (daftarPerangkat.length > 0 && (perluAndroid || perluIos)) {
    const yangDikirim = daftarPerangkat.filter((item) =>
      item.platform === 'ios' ? perluIos : perluAndroid
    );

    const hasilNative = await kirimKeNative(yangDikirim, {
      title: judul,
      body: pesan,
      tag,
      data: { ...data, kategori },
    });

    hasil.pushNative = hasilNative.terkirim;

    if (hasilNative.kedaluwarsa.length > 0) {
      await admin.from('device_tokens').delete().in('token', hasilNative.kedaluwarsa);
    }

    if (hasilNative.alasan.length > 0) {
      hasil.alasan.push(...hasilNative.alasan);
    }
  } else if (daftarPerangkat.length > 0) {
    hasil.alasan.push(
      siapAndroid || siapApple
        ? 'Token perangkat ada, tetapi tidak ada kredensial push yang cocok dengan platformnya.'
        : 'Kredensial push native belum diisi di server.'
    );
  }

  hasil.terkirim = hasil.pushWeb + hasil.pushNative;
  return hasil;
}