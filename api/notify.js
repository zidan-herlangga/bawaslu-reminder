import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { apnsSiap, kirimKeNative, pushNativeSiap } from './lib/push-native.js';

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
];

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

function notifikasiUntuk(kategori) {
  return NOTIFIKASI_PER_KATEGORI[kategori] ?? DEFAULT_NOTIFIKASI;
}

function jamWIB(iso) {
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${HARI[wib.getUTCDay()]}, ${wib.getUTCDate()} ${BULAN[wib.getUTCMonth()]} ` +
    `${wib.getUTCFullYear()}, ${pad(wib.getUTCHours())}.${pad(wib.getUTCMinutes())} WIB`
  );
}

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  res.setHeader('Allow', 'POST');

  if (req.method !== 'POST') {
    return reply(res, 405, { error: 'Metode tidak diizinkan.' });
  }

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const where = process.env.VERCEL
      ? 'Buka Vercel > Project > Settings > Environment Variables.'
      : 'Isi di file .env lalu restart dev server (npm run dev).';
    return reply(res, 500, {
      error:
        'Variabel environment belum diisi: ' + missing.join(', ') + '. ' + where,
    });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(res, 401, { error: 'Token sesi tidak ditemukan.' });

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return reply(res, 401, { error: 'Sesi tidak valid. Silakan keluar dan masuk kembali.' });
  }

  const sender = userData.user;
  const scheduleId = readBody(req).scheduleId;
  if (!scheduleId) return reply(res, 400, { error: 'scheduleId wajib diisi.' });

  const { data: schedule, error: scheduleError } = await admin
    .from('schedules')
    .select('id, judul, kategori, waktu_mulai, target_divisi, pembuat_id')
    .eq('id', scheduleId)
    .maybeSingle();

  if (scheduleError) return reply(res, 500, { error: scheduleError.message });
  if (!schedule) return reply(res, 404, { error: 'Jadwal tidak ditemukan.' });
  if (schedule.pembuat_id !== sender.id) {
    return reply(res, 403, { error: 'Hanya pembuat jadwal yang boleh mengirim pengingat.' });
  }

  let profileQuery = admin.from('profiles').select('id, divisi');
  if (schedule.target_divisi) profileQuery = profileQuery.eq('divisi', schedule.target_divisi);

  const { data: profiles, error: profileError } = await profileQuery;
  if (profileError) return reply(res, 500, { error: profileError.message });

  const recipients = (profiles ?? []).filter((item) => item.id !== sender.id);
  const targetLabel = schedule.target_divisi ?? 'semua staf';
  const label = notifikasiUntuk(schedule.kategori);
  const pesan =
    `${schedule.judul} - ${jamWIB(schedule.waktu_mulai)}. ` +
    `Ditujukan untuk ${targetLabel}.`;

  if (recipients.length === 0) {
    return reply(res, 200, { terkirim: 0, push: 0, pesan, catatan: 'Tidak ada penerima.' });
  }

  const rows = recipients.map((item) => ({
    jadwal_id: schedule.id,
    pengirim_id: sender.id,
    penerima_id: item.id,
    judul: label.judul,
    pesan,
    target_divisi: schedule.target_divisi,
  }));

  const { data: inserted, error: insertError } = await admin
    .from('notifications')
    .insert(rows)
    .select('id, penerima_id');
  if (insertError) return reply(res, 500, { error: insertError.message });

  const idByUser = new Map((inserted ?? []).map((row) => [row.penerima_id, row.id]));

  const recipientIds = recipients.map((item) => item.id);
  const { data: subscriptions, error: subError } = await admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', recipientIds);

  if (subError) {
    return reply(res, 200, {
      terkirim: recipients.length,
      push: 0,
      pesan,
      catatan: `Notifikasi tersimpan, tetapi langganan push gagal dibaca: ${subError.message}`,
    });
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
    console.warn('[notify] gagal membaca token perangkat:', deviceError.message);
  }

  const daftarPerangkat = deviceTokens ?? [];

  if (daftarWeb.length === 0 && daftarPerangkat.length === 0) {
    return reply(res, 200, {
      terkirim: recipients.length,
      push: 0,
      pesan,
      catatan: 'Belum ada penerima yang mengaktifkan notifikasi.',
    });
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
            kategori: schedule.kategori ?? null,
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
      tag: `${label.tag}-${schedule.id}`,
      data: {
        schedule_id: schedule.id,
        kategori: schedule.kategori ?? null,
      },
    });

    pushNative = hasilNative.terkirim;

    if (hasilNative.kedaluwarsa.length > 0) {
      await admin.from('device_tokens').delete().in('token', hasilNative.kedaluwarsa);
    }

    if (hasilNative.alasan.length > 0) {
      catatanNative.push(`${hasilNative.alasan.length} perangkat gagal: ${hasilNative.alasan[0]}`);
    }
  } else if (daftarPerangkat.length > 0) {
    catatanNative.push(
      'Token perangkat sudah terdaftar, tetapi kredensial push native belum diisi.'
    );
  }

  const totalPerangkat = daftarWeb.length + daftarPerangkat.length;
  const totalTerkirim = pushWeb + pushNative;
  const catatan = [
    totalTerkirim < totalPerangkat
      ? `${totalPerangkat - totalTerkirim} perangkat tidak bisa dijangkau dan sudah dibersihkan.`
      : '',
    ...catatanNative,
  ]
    .filter(Boolean)
    .join(' ');

  return reply(res, 200, {
    terkirim: recipients.length,
    push: totalTerkirim,
    pushWeb,
    pushNative,
    pesan,
    catatan,
  });
}
