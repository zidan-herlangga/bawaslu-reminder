import { createClient } from '@supabase/supabase-js';
import { kirimPengingat } from './lib/kirim-pengingat.js';

// Pengingat otomatis.
//
// Kenapa ini perlu ada: pengingat yang dijadwalkan di perangkat (Android lewat
// expo-notifications) dibatalkan begitu proses aplikasi berhenti, dan Android
// membatalkan semua alarm saat aplikasi dipaksa berhenti. Officer tidak akan
// membuka aplikasi tepat 15 menit sebelum rapat. Satu-satunya yang bisa menjaga
// pengingat tanpa bergantung pada aplikasi adalah server.
//
// Dipanggil setiap menit. Setelah dikirim, baris notifications tetap menjadi
// bukti pengingat sudah keluar, jadi aplikasi cukup membacanya seperti biasa.

/** Seberapa awal pengingat dikirim, dalam milidetik. */
const JENDALA_AWAL_MS = 15 * 60 * 1000;

/** Seberapa lama pengingat masih dikirim setelah waktunya lewat. */
const AMBANG_TELAT_MS = 15 * 60 * 1000;

/**
 * Seberapa jauh ke belakang jadwal ditinjau.
 *
 * Hanya untuk membatasi jumlah baris yang dibaca. Jadwal yang lewat jauh lebih
 * lama dari ini jelas tidak masih menunggu pengingat.
 */
const HORIZON_LAMPAU_MS = 7 * 24 * 60 * 60 * 1000;

/** Batas jumlah jadwal yang diproses sekali jalan. */
const MAKS_JADWAL = 200;

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/**
 * Semua waktu yang relevan untuk satu jadwal: slot bila ada, kalau tidak
 * waktu_mulai. Slot lebih dipercaya karena itulah yang dipakai aplikasi untuk
 * menjadwalkan alarm lokal.
 */
function semuaWaktu(jadwal) {
  const slot = Array.isArray(jadwal.slots) ? jadwal.slots : [];
  const dariSlot = slot
    .map((item) => new Date(item?.mulai).getTime())
    .filter((value) => Number.isFinite(value));

  if (dariSlot.length > 0) return dariSlot;

  const dasar = new Date(jadwal.waktu_mulai).getTime();
  return Number.isFinite(dasar) ? [dasar] : [];
}

/**
 * Waktu pertama dari satu jadwal yang jatuh di dalam jendela pengingat, atau
 * null kalau belum waktunya. Kalau beberapa slot masuk jendela bersamaan, yang
 * paling awal dipilih supaya kalimatnya menyebut sesi yang benar.
 */
export function waktuDalamJendela(jadwal, sekarang = Date.now()) {
  const bawah = sekarang - AMBANG_TELAT_MS;
  const atas = sekarang + JENDALA_AWAL_MS;

  const masuk = semuaWaktu(jadwal)
    .filter((value) => value >= bawah && value <= atas)
    .sort((a, b) => a - b);

  return masuk.length > 0 ? masuk[0] : null;
}

function sah(Token) {
  const rahasia = process.env.CRON_SECRET;
  // Tanpa CRON_SECRET, endpoint ini terbuka untuk siapa saja yang menebak URL-nya,
  // dan siapa saja bisa membuat server mengirim push ke seluruh staf.
  if (!rahasia) return false;
  if (!Token) return false;
  return Token === rahasia;
}

export default async function handler(req, res) {
  // Vercel Cron memakai GET, pg_net memakai POST. Keduanya dilayani.
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return reply(res, 405, { error: 'Metode tidak diizinkan.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!sah(token)) {
    return reply(res, 401, { error: 'Token cron tidak dikenali.' });
  }

  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    return reply(res, 500, {
      error: 'Variabel environment belum diisi: ' + missing.join(', ') + '.',
    });
  }

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sekarang = Date.now();
  const batasAtas = new Date(sekarang + JENDALA_AWAL_MS).toISOString();
  const batasBawah = new Date(sekarang - HORIZON_LAMPAU_MS).toISOString();

  // Ditinjau dengan batas waktu_mulai, lalu disaring ulang di memori untuk
  // jadwal yang waktu_sl-nya berbeda dari waktu_mulai. Menyaring JSONB di
  // PostgREST jauh lebih rapuh daripada menyaring angka yang sudah di sini.
  const { data: kandidat, error: jadwalError } = await admin
    .from('schedules')
    .select('id, judul, kategori, waktu_mulai, target_divisi, pembuat_id, slots')
    .eq('status', 'Aktif')
    .lte('waktu_mulai', batasAtas)
    .gte('waktu_mulai', batasBawah)
    .limit(MAKS_JADWAL);

  if (jadwalError) {
    return reply(res, 500, { error: jadwalError.message });
  }

  const due = (kandidat ?? [])
    .map((jadwal) => ({ jadwal, waktu: waktuDalamJendela(jadwal, sekarang) }))
    .filter((item) => item.waktu !== null);

  if (due.length === 0) {
    return reply(res, 200, { diproses: 0, terkirim: 0, push: 0, detail: [] });
  }

  const detail = [];

  for (const { jadwal, waktu } of due) {
    try {
      const hasil = await kirimPengingat(admin, {
        jadwal,
        pengirimId: jadwal.pembuat_id,
        waktu,
        lewatiSudahDikirim: true,
      });

      detail.push({
        jadwal: jadwal.judul,
        slot: new Date(waktu).toISOString(),
        terkirim: hasil.terkirim,
        push: hasil.push,
        catatan: hasil.catatan,
      });
    } catch (galat) {
      // Satu jadwal yang rusak tidak boleh menghentikan sisa antrean.
      console.error('[pengingat-terjadwal] gagal mengirim:', jadwal.judul, galat);
      detail.push({ jadwal: jadwal.judul, galat: galat.message });
    }
  }

  return reply(res, 200, {
    diproses: due.length,
    terkirim: detail.reduce((n, item) => n + (item.terkirim ?? 0), 0),
    push: detail.reduce((n, item) => n + (item.push ?? 0), 0),
    detail,
  });
}