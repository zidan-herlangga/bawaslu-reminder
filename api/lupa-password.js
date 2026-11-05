import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

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

function emailAuthDariNip(nip) {
  return `${String(nip).trim()}@bawaslu.local`;
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
      error: 'Variabel environment belum diisi: ' + missing.join(', ') + '. ' + where,
    });
  }

  const body = readBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const redirectTo = String(body.redirectTo || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply(res, 400, { error: 'Gmail terdaftar wajib diisi dengan benar.' });
  }
  if (!redirectTo) {
    return reply(res, 400, { error: 'redirectTo wajib diisi.' });
  }

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Cek apakah email terdaftar di profiles
  const { data: profil } = await admin
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (!profil) {
    return reply(res, 400, { error: 'Gmail tidak terdaftar.' });
  }

  const emailProfil = String(profil.email || '').trim().toLowerCase();

  // Kirim reset password ke Gmail terdaftar
  const { error: resetError } = await admin.auth.resetPasswordForEmail(emailProfil, {
    redirectTo,
  });

  if (resetError) {
    const msg = resetError.message || '';
    if (msg.includes('only request this after')) {
      return reply(res, 429, { error: 'Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat.' });
    }
    return reply(res, 400, { error: msg || 'Gagal mengirim link reset password.' });
  }

  return reply(res, 200, {
    ok: true,
    message: `Link reset password telah dikirim ke ${emailProfil}. Silakan cek Gmail Anda.`,
  });
}
