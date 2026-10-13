import { createClient } from '@supabase/supabase-js';
import { kirimKePenerima } from './lib/kirim-pengingat.js';

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
];

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

// Notifikasi untuk tugas yang baru dibuat di web: dikirim ke SEMUA perangkat
// pemilik tugas (langganan web + token FCM/APNs), supaya yang masih pakai
// aplikasi seluler tetap tahu walau tugas dibuat lewat browser.
//
// Tugas sifatnya pribadi (tabel todos), jadi penerimanya selalu pembuatnya
// sendiri, bukan semua staf seperti pengingat jadwal.
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
  const todoId = readBody(req).todoId;
  if (!todoId) return reply(res, 400, { error: 'todoId wajib diisi.' });

  const { data: todo, error: todoError } = await admin
    .from('todos')
    .select('id, teks, tanggal, pemilik_id')
    .eq('id', todoId)
    .maybeSingle();

  if (todoError) return reply(res, 500, { error: todoError.message });
  if (!todo) return reply(res, 404, { error: 'Tugas tidak ditemukan.' });
  if (todo.pemilik_id !== sender.id) {
    return reply(res, 403, { error: 'Tugas ini bukan milik Anda.' });
  }

  const judul = 'Tugas baru';
  const pesan = todo.tanggal ? `${todo.teks} — ${todo.tanggal}` : todo.teks;

  // Catat di lonceng supaya muncul juga di kotak masuk web/APK, konsisten
  // dengan pengingat jadwal. jadwal_id sengaja kosong karena ini bukan jadwal.
  const { data: kotak, error: kotakError } = await admin
    .from('notifications')
    .insert({
      jadwal_id: null,
      pengirim_id: sender.id,
      penerima_id: sender.id,
      judul,
      pesan,
      target_divisi: null,
    })
    .select('id')
    .maybeSingle();

  if (kotakError) {
    console.warn('[notify-tugas] gagal mencatat notifikasi:', kotakError.message);
  }

  try {
    const hasil = await kirimKePenerima(admin, {
      penerimaId: sender.id,
      judul,
      pesan,
      kategori: 'Tugas',
      kotakId: kotak?.id ?? null,
      data: { todo_id: todo.id },
    });

    return reply(res, 200, {
      terkirim: hasil.terkirim,
      push: hasil.terkirim,
      pushWeb: hasil.pushWeb,
      pushNative: hasil.pushNative,
      pesan,
      catatan: hasil.alasan.join(' '),
    });
  } catch (galat) {
    return reply(res, 500, { error: galat.message });
  }
}