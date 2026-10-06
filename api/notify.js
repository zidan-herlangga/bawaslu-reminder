import { createClient } from '@supabase/supabase-js';
import { kirimPengingat } from './lib/kirim-pengingat.js';

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

// Endpoint ini adalah tombol "Ingatkan" yang ditekan manusia: jadwal sudah ada,
// seseorang memintakan supaya staf diberi tahu sekarang.
//
// Pengingat otomatis ada di api/pengingat-terjadwal.js. Keduanya memanggil
// api/lib/kirim-pengingat.js supaya logika pengiriman hanya ada di satu tempat.
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

  try {
    const hasil = await kirimPengingat(admin, {
      jadwal: schedule,
      pengirimId: sender.id,
    });
    return reply(res, 200, hasil);
  } catch (galat) {
    return reply(res, 500, { error: galat.message });
  }
}