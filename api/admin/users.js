import { readBody, reply, requireAdmin } from '../lib/require-admin.js';
import { createClient } from '@supabase/supabase-js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_OPTIONS = ['Admin', 'User'];
const STATUS_OPTIONS = ['Aktif', 'Nonaktif'];
const MIN_PASSWORD_LENGTH = 6;

function cleanText(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(email);
}

async function countActiveAdmins(admin, excludeId = null) {
  let query = admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role_akses', 'Admin')
    .eq('status_akun', 'Aktif');
  if (excludeId) query = query.neq('id', excludeId);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function handleList(res, admin) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, nama_lengkap, email, divisi, jabatan, role_akses, status_akun, created_at')
    .order('created_at', { ascending: false });

  if (error) return reply(res, 500, { error: error.message });
  return reply(res, 200, { users: data ?? [] });
}

async function handleCreate(req, res, admin) {
  const body = readBody(req);
  const nama_lengkap = cleanText(body.nama_lengkap);
  const email = cleanText(body.email, 320).toLowerCase();
  const password = String(body.password ?? '');
  const divisi = cleanText(body.divisi, 200);
  const jabatan = cleanText(body.jabatan, 200);
  const role_akses = cleanText(body.role_akses, 20) || 'User';

  if (!nama_lengkap) return reply(res, 400, { error: 'Nama lengkap wajib diisi.' });
  if (!isValidEmail(email)) return reply(res, 400, { error: 'Email tidak valid.' });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return reply(res, 400, { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` });
  }
  if (!divisi) return reply(res, 400, { error: 'Divisi wajib diisi.' });
  if (!jabatan) return reply(res, 400, { error: 'Jabatan wajib diisi.' });
  if (!ROLE_OPTIONS.includes(role_akses)) {
    return reply(res, 400, { error: 'Role tidak valid.' });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nama_lengkap, divisi, jabatan },
  });

  if (createError) {
    const msg = createError.message || 'Gagal membuat pengguna.';
    if (msg.toLowerCase().includes('already been registered') || msg.toLowerCase().includes('already exists')) {
      return reply(res, 409, { error: 'Email sudah terdaftar.' });
    }
    return reply(res, 400, { error: msg });
  }

  const userId = created?.user?.id;
  if (!userId) return reply(res, 500, { error: 'User berhasil dibuat tetapi ID tidak ditemukan.' });

  const profileRow = {
    id: userId,
    nama_lengkap,
    email,
    divisi,
    jabatan,
    role_akses,
    status_akun: 'Aktif',
  };

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert(profileRow, { onConflict: 'id' })
    .select('id, nama_lengkap, email, divisi, jabatan, role_akses, status_akun, created_at')
    .single();

  if (profileError) {
    return reply(res, 500, {
      error: `User dibuat, tetapi gagal menyimpan profil: ${profileError.message}`,
    });
  }

  return reply(res, 200, { ok: true, user: profile });
}

async function handleUpdate(req, res, admin, actorId) {
  const body = readBody(req);
  const id = cleanText(body.id, 100);
  if (!id) return reply(res, 400, { error: 'ID pengguna wajib diisi.' });

  const { data: existing, error: existingError } = await admin
    .from('profiles')
    .select('id, nama_lengkap, email, divisi, jabatan, role_akses, status_akun')
    .eq('id', id)
    .maybeSingle();

  if (existingError) return reply(res, 500, { error: existingError.message });
  if (!existing) return reply(res, 404, { error: 'Pengguna tidak ditemukan.' });

  const next = {
    nama_lengkap: body.nama_lengkap !== undefined ? cleanText(body.nama_lengkap) : existing.nama_lengkap,
    divisi: body.divisi !== undefined ? cleanText(body.divisi, 200) : existing.divisi,
    jabatan: body.jabatan !== undefined ? cleanText(body.jabatan, 200) : existing.jabatan,
    role_akses: body.role_akses !== undefined ? cleanText(body.role_akses, 20) : existing.role_akses,
    status_akun: body.status_akun !== undefined ? cleanText(body.status_akun, 20) : existing.status_akun,
  };

  if (!next.nama_lengkap) return reply(res, 400, { error: 'Nama lengkap wajib diisi.' });
  if (!next.divisi) return reply(res, 400, { error: 'Divisi wajib diisi.' });
  if (!next.jabatan) return reply(res, 400, { error: 'Jabatan wajib diisi.' });
  if (!ROLE_OPTIONS.includes(next.role_akses)) return reply(res, 400, { error: 'Role tidak valid.' });
  if (!STATUS_OPTIONS.includes(next.status_akun)) return reply(res, 400, { error: 'Status tidak valid.' });

  const isSelf = id === actorId;
  if (isSelf) {
    if (next.role_akses !== 'Admin') {
      return reply(res, 400, { error: 'Anda tidak dapat menurunkan role akun sendiri.' });
    }
    if (next.status_akun !== 'Aktif') {
      return reply(res, 400, { error: 'Anda tidak dapat menonaktifkan akun sendiri.' });
    }
  }

  const demotingAdmin =
    existing.role_akses === 'Admin' &&
    existing.status_akun === 'Aktif' &&
    (next.role_akses !== 'Admin' || next.status_akun !== 'Aktif');

  if (demotingAdmin) {
    const remaining = await countActiveAdmins(admin, id);
    if (remaining < 1) {
      return reply(res, 400, { error: 'Minimal harus ada satu admin aktif.' });
    }
  }

  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update(next)
    .eq('id', id)
    .select('id, nama_lengkap, email, divisi, jabatan, role_akses, status_akun, created_at')
    .single();

  if (updateError) return reply(res, 500, { error: updateError.message });

  // Sinkronkan metadata auth agar konsisten
  await admin.auth.admin.updateUserById(id, {
    user_metadata: {
      nama_lengkap: next.nama_lengkap,
      divisi: next.divisi,
      jabatan: next.jabatan,
    },
  });

  return reply(res, 200, { ok: true, user: updated });
}

async function handleResetPassword(req, res, admin) {
  const body = readBody(req);
  const id = cleanText(body.id, 100);
  const redirectTo = cleanText(body.redirectTo, 500);

  if (!id) return reply(res, 400, { error: 'ID pengguna wajib diisi.' });
  if (!redirectTo) return reply(res, 400, { error: 'redirectTo wajib diisi.' });

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, nama_lengkap')
    .eq('id', id)
    .maybeSingle();

  if (profileError) return reply(res, 500, { error: profileError.message });
  if (!profile?.email) return reply(res, 404, { error: 'Pengguna atau email tidak ditemukan.' });

  const { error } = await admin.auth.resetPasswordForEmail(profile.email, { redirectTo });
  if (error) return reply(res, 400, { error: error.message || 'Gagal mengirim link reset password.' });

  return reply(res, 200, {
    ok: true,
    message: `Link reset password telah dikirim ke ${profile.email}.`,
  });
}

export default async function handler(req, res) {
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const { admin, user } = ctx;
  const url = new URL(req.url, 'http://localhost');
  const action = String(url.searchParams.get('action') || readBody(req).action || '').toLowerCase();

  try {
    if (req.method === 'GET' || action === 'list') {
      return await handleList(res, admin);
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return reply(res, 405, { error: 'Metode tidak diizinkan.' });
    }

    if (action === 'create') return await handleCreate(req, res, admin);
    if (action === 'update') return await handleUpdate(req, res, admin, user.id);
    if (action === 'reset-password') return await handleResetPassword(req, res, admin);

    return reply(res, 400, { error: 'Aksi tidak dikenal.' });
  } catch (error) {
    console.error('[admin/users]', error);
    return reply(res, 500, { error: error?.message || 'Kesalahan internal server.' });
  }
}