import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

export function getMissingEnv() {
  return REQUIRED_ENV.filter((key) => !process.env[key]);
}

export function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function readBody(req) {
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

export function createAdminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin(req, res) {
  const missing = getMissingEnv();
  if (missing.length > 0) {
    const where = process.env.VERCEL
      ? 'Buka Vercel > Project > Settings > Environment Variables.'
      : 'Isi di file .env lalu restart dev server (npm run dev).';
    reply(res, 500, {
      error: 'Variabel environment belum diisi: ' + missing.join(', ') + '. ' + where,
    });
    return null;
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    reply(res, 401, { error: 'Token sesi tidak ditemukan.' });
    return null;
  }

  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    reply(res, 401, { error: 'Sesi tidak valid. Silakan keluar dan masuk kembali.' });
    return null;
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role_akses, status_akun')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    reply(res, 500, { error: profileError.message });
    return null;
  }

  if (!profile || profile.role_akses !== 'Admin' || profile.status_akun !== 'Aktif') {
    reply(res, 403, { error: 'Akses ditolak. Hanya admin aktif yang dapat mengelola pengguna.' });
    return null;
  }

  return { admin, user: userData.user, profile };
}