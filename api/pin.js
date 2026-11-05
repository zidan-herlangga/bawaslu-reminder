import { createClient } from '@supabase/supabase-js';
import {
  catatBerhasil,
  catatGagal,
  emailDariNip,
  hashPin,
  isPinValid,
  nipTerkunci,
  verifyPin,
} from './lib/pin.js';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

// Kode minimal 6 karakter, samakan dengan MIN_PASSWORD_LENGTH di sisi klien.
const MIN_PASSWORD_LENGTH = 6;

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

function pesanTerkunci(sisaMs) {
  const menit = Math.max(1, Math.ceil(sisaMs / 60000));
  return `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.`;
}

// Satu endpoint untuk dua pekerjaan:
//
//   action=reset  -> dipakai halaman Lupa Password. NIP + PIN + password baru.
//                    Tidak butuh sesi, karena justru dipakai orang yang tidak
//                    bisa masuk lagi.
//   action=set    -> dipakai halaman Akun. Butuh sesi login, hanya mengganti PIN
//                    milik sendiri.
//
// PIN tidak pernah dikirim balik ke klien dan tidak pernah disimpan mentah.
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
      error: 'Variabel environment belum diisi: ' + missing.join(', ') + '. ' + where,
    });
  }

  const body = readBody(req);
  const action = String(body.action || 'reset');
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === 'set') {
    return aturPin(req, res, admin, body);
  }

  if (action !== 'reset') {
    return reply(res, 400, { error: 'Aksi tidak dikenal.' });
  }

  return resetDenganPin(res, admin, body);
}

async function resetDenganPin(res, admin, body) {
  const nip = String(body.nip || '').trim();
  const pin = String(body.pin || '');
  const password = String(body.password || '');
  const emailKonfirmasi = String(body.email || body.gmail || '').trim().toLowerCase();

  if (!/^\d{18}$/.test(nip)) {
    return reply(res, 400, { error: 'NIP harus 18 digit angka.' });
  }
  if (!emailKonfirmasi || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKonfirmasi)) {
    return reply(res, 400, { error: 'Email/Gmail terdaftar wajib diisi dengan benar.' });
  }
  if (!isPinValid(pin)) {
    return reply(res, 400, { error: 'PIN harus 6 digit angka.' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return reply(res, 400, { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` });
  }

  const terkunci = nipTerkunci(nip);
  if (terkunci > 0) return reply(res, 429, { error: pesanTerkunci(terkunci) });

  let profil = null;
  const { data: profilByNip } = await admin
    .from('profiles')
    .select('id, email, nip')
    .eq('nip', nip)
    .maybeSingle();

  if (profilByNip) {
    profil = profilByNip;
  } else {
    const emailAuth = emailDariNip(nip);
    const { data: profilByEmailAuth } = await admin
      .from('profiles')
      .select('id, email, nip')
      .eq('email', emailAuth)
      .maybeSingle();
    profil = profilByEmailAuth;
  }

  if (profil?.nip && profil.nip !== nip) {
    profil = null;
  }

  // Pesan sengaja sama untuk NIP/Email/PIN salah, supaya tidak bisa
  // dipakai menebak NIP mana yang terdaftar.
  const pesanSalah = 'NIP, Email/Gmail, atau PIN salah.';
  if (!profil) {
    catatGagal(nip);
    return reply(res, 401, { error: pesanSalah });
  }

  const emailProfil = String(profil.email || '').trim().toLowerCase();
  if (!emailProfil || emailProfil !== emailKonfirmasi) {
    catatGagal(nip);
    return reply(res, 401, { error: pesanSalah });
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profil.id);
  if (userError || !userData?.user) {
    catatGagal(nip);
    return reply(res, 401, { error: pesanSalah });
  }

  const pinHash = userData.user.user_metadata?.pin_hash;
  if (!(await verifyPin(pin, pinHash))) {
    catatGagal(nip);
    return reply(res, 401, { error: pesanSalah });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(profil.id, {
    password,
  });

  if (updateError) {
    return reply(res, 500, { error: 'Gagal menyimpan password baru. Coba lagi nanti.' });
  }

  catatBerhasil(nip);
  return reply(res, 200, {
    ok: true,
    message: 'Password berhasil diganti. Silakan masuk dengan password baru.',
  });
}

async function aturPin(req, res, admin, body) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(res, 401, { error: 'Sesi tidak valid. Silakan masuk ulang.' });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return reply(res, 401, { error: 'Sesi tidak valid. Silakan masuk ulang.' });
  }

  const pin = String(body.pin || '');
  if (!isPinValid(pin)) {
    return reply(res, 400, { error: 'PIN harus 6 digit angka.' });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userData.user.id, {
    user_metadata: {
      ...userData.user.user_metadata,
      pin_hash: await hashPin(pin),
    },
  });

  if (updateError) {
    return reply(res, 500, { error: 'Gagal menyimpan PIN. Coba lagi nanti.' });
  }

  return reply(res, 200, { ok: true, message: 'PIN pemulihan berhasil disimpan.' });
}
