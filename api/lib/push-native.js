import { createSign, createPrivateKey } from 'node:crypto';

// Pengiriman notifikasi ke aplikasi native.
//
// Modul ini mengirim langsung ke Firebase Cloud Messaging (Android) dan Apple
// Push Notification service (iOS). Tidak memakai Expo Push Service, supaya tidak
// ada data staf yang lewat pihak ketiga dan tidak ada ketergantungan pada
// layanan yang sewaktu-waktu bisa berubah.
//
// Bentuk payload sengaja dibuat sama dengan yang sudah dipakai web-push di
// api/notify.js: title, body, dan data. expo-notifications di sisi klien akan
// membacanya dengan bentuk yang sama.
//
// ------------------------------------ batasan yang harus diketahui
//
// Modul ini hanya terpakai kalau perangkat sudah terdaftar di device_tokens,
// dan pendaftaran token hanya bisa terjadi dari aplikasi yang sudah dibangun
// (development build atau build rilis). Push remote tidak jalan di Expo Go
// sejak SDK 53, jadi tahap awal aplikasi hanya bisa mengirim pengingat lokal.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const APNS_HOST = 'api.push.apple.com';

// Token JWT tidak berlaku lebih dari satu jam. Disimpan sedikit lebih pendek
// supaya tidak dipakaitepat di detik terakhir dan ditolak.
const UMUR_TOKEN_MS = 50 * 60 * 1000;

const cacheToken = {
  google: { token: null, kedaluwarsa: 0 },
  apple: { token: null, kedaluwarsa: 0 },
};

function wajib(nama) {
  const nilai = process.env[nama];
  if (!nilai) {
    throw new Error(
      `Variabel ${nama} belum diisi. Isi di .env lalu restart dev server.`
    );
  }
  return nilai;
}

/** Kunci privat dari .env datang dengan karakter newline ter-escape. */
function kunciDariLingkungan(nilai) {
  return nilai.replace(/\\n/g, '\n');
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ------------------------------------------------------------- Google FCM

async function tokenGoogle() {
  const sekarang = Date.now();
  const cache = cacheToken.google;
  if (cache.token && cache.kedaluwarsa > sekarang) return cache.token;

  const clientEmail = wajib('FCM_CLIENT_EMAIL');
  const privateKey = kunciDariLingkungan(wajib('FCM_PRIVATE_KEY'));

  const sekarangDetik = Math.floor(sekarang / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const klaim = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: sekarangDetik,
      exp: sekarangDetik + 3600,
    })
  );

  const penandatangan = createSign('RSA');
  penandatangan.update(`${header}.${klaim}`);
  penandatangan.end();
  const tanda = penandatangan.sign(createPrivateKey(privateKey));

  const respons = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${klaim}.${tanda.toString('base64url')}`,
    }).toString(),
  });

  if (!respons.ok) {
    throw new Error(`Token Google ditolak (${respons.status}): ${await respons.text()}`);
  }

  const data = await respons.json();
  cacheToken.google = {
    token: data.access_token,
    kedaluwarsa: sekarang + Number(data.expires_in ?? 3600) * 1000 - UMUR_TOKEN_MS / 4,
  };

  return cacheToken.google.token;
}

async function kirimFCM(tokenPerangkat, muatan) {
  const projectId = wajib('FCM_PROJECT_ID');
  const akses = await tokenGoogle();

  const respons = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${akses}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: tokenPerangkat,
          notification: { title: muatan.title, body: muatan.body },
          data: muatan.data ?? {},
          android: {
            priority: 'high',
            notification: {
              channelId: 'pengingat-jadwal',
              // Tag membuat notifikasi kategori yang sama saling menggantikan,
              // bukan menumpuk di panel.
              tag: muatan.tag,
            },
          },
        },
      }),
    }
  );

  if (respons.ok) return { ok: true };

  const teks = await respons.text();
  const kedaluwarsa = respons.status === 404 || respons.status === 400;

  return { ok: false, kedaluwarsa, alasan: `FCM ${respons.status}: ${teks}` };
}

// ------------------------------------------------------------------ APNs

async function tokenApple() {
  const sekarang = Date.now();
  const cache = cacheToken.apple;
  if (cache.token && cache.kedaluwarsa > sekarang) return cache.token;

  const keyId = wajib('APNS_KEY_ID');
  const teamId = wajib('APNS_TEAM_ID');
  const privateKey = kunciDariLingkungan(wajib('APNS_PRIVATE_KEY'));

  const sekarangDetik = Math.floor(sekarang / 1000);
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const klaim = base64url(JSON.stringify({ iss: teamId, iat: sekarangDetik }));

  // Apple hanya menerima tanda tangan ES256 raw, bukan JWT lengkap.
  const penandatangan = createSign('SHA256');
  penandatangan.update(`${header}.${klaim}`);
  penandatangan.end();
  const tanda = penandatangan
    .sign(createPrivateKey({ key: privateKey, dsaEncoding: 'ieee-p1363' }))
    .toString('base64url');

  cacheToken.apple = {
    token: `${header}.${klaim}.${tanda}`,
    kedaluwarsa: sekarang + UMUR_TOKEN_MS,
  };

  return cacheToken.apple.token;
}

async function kirimAPNs(tokenPerangkat, muatan) {
  const bundleId = wajib('APNS_BUNDLE_ID');
  const jwt = await tokenApple();

  const respons = await fetch(`https://${APNS_HOST}/3/device/${tokenPerangkat}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      // Notifikasi pengingat tidak boleh hilang diam-diam kalau perangkat
      // sedang offline; Apple limiting-nya ke satu jam.
      'apns-expiration': String(Math.floor((Date.now() + 3600 * 1000) / 1000)),
      'apns-collapse-id': muatan.tag,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: { title: muatan.title, body: muatan.body },
        sound: 'default',
        // Badge nol supaya badge lama tidak menggantung.
        badge: 0,
      },
      ...(muatan.data ?? {}),
    }),
  });

  if (respons.ok) return { ok: true };

  const teks = await respons.text();
  // 410 berarti token sudah tidak berlaku dan harus dihapus dari database.
  const kedaluwarsa = respons.status === 410 || respons.status === 400;

  return { ok: false, kedaluwarsa, alasan: `APNs ${respons.status}: ${teks}` };
}

// ------------------------------------------------------------------ publik

/**
 * Mengirim satu notifikasi ke banyak token, mencampur Android dan iOS.
 *
 * Token yang ditolak server dikembalikan sebagai `kedaluwarsa` supaya pemanggil
 * bisa membersihkannya dari database. Token yang gagal karena masalah jaringan
 * atau konfigurasi sengaja TIDAK ikut dihapus: menghapusnya karena satu
 * kesalahan konfigurasi akan mematikan notifikasi semua orang.
 */
export async function kirimKeNative(daftarToken, muatan) {
  const hasil = { terkirim: 0, gagal: 0, kedaluwarsa: [], alasan: [] };

  const hasilSemua = await Promise.allSettled(
    daftarToken.map(async (baris) => {
      if (baris.platform === 'ios') return kirimAPNs(baris.token, muatan);
      return kirimFCM(baris.token, muatan);
    })
  );

  hasilSemua.forEach((hasil, index) => {
    const baris = daftarToken[index];

    if (hasil.status === 'rejected') {
      hasil.gagal += 1;
      hasil.alasan.push(String(hasil.reason?.message ?? hasil.reason));
      return;
    }

    if (hasil.value.ok) {
      hasil.terkirim += 1;
      return;
    }

    hasil.gagal += 1;
    hasil.alasan.push(hasil.value.alasan);
    if (hasil.value.kedaluwarsa && baris?.token) {
      hasil.kedaluwarsa.push(baris.token);
    }
  });

  return hasil;
}

/**
 * True kalau kredensial push Android sudah lengkap. Dipakai api/notify.js
 * supaya endpoint tetap jalan untuk web walau kredensial native belum diisi.
 */
export function pushNativeSiap() {
  return Boolean(
    process.env.FCM_PROJECT_ID &&
      process.env.FCM_CLIENT_EMAIL &&
      process.env.FCM_PRIVATE_KEY
  );
}

/** True kalau hanya sisi Apple yang siap. */
export function apnsSiap() {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_PRIVATE_KEY &&
      process.env.APNS_BUNDLE_ID
  );
}
