import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { hashPin } from '../api/lib/pin.js';

const txt = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
const env = {};
for (const line of txt.split(/\r?\n/)) {
  const l = line.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i < 0) continue;
  let k = l.slice(0, i).trim();
  let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[k] = v;
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: profiles, error } = await supabase
  .from('profiles')
  .select('id, nama_lengkap, email, divisi')
  .order('created_at');

if (error) {
  console.error('Gagal membaca profiles:', error.message);
  process.exit(1);
}

const hasil = [];

for (const profil of profiles) {
  const nip = profil.email.split('@')[0];
  // Hanya akun dengan email <nip>@bawaslu.local yang bisa memakai reset NIP+PIN.
  if (!/^\d{18}$/.test(nip)) {
    hasil.push({ nip, nama: profil.nama_lengkap, pin: '-', catatan: 'email bukan format NIP' });
    continue;
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profil.id);
  if (userError || !userData?.user) {
    hasil.push({ nip, nama: profil.nama_lengkap, pin: '-', catatan: 'user tidak ditemukan' });
    continue;
  }

  const pin = String(randomInt(0, 1000000)).padStart(6, '0');

  const { error: updateError } = await supabase.auth.admin.updateUserById(profil.id, {
    user_metadata: { ...userData.user.user_metadata, pin_hash: await hashPin(pin) },
  });

  hasil.push({
    nip,
    nama: profil.nama_lengkap,
    pin: updateError ? '-' : pin,
    catatan: updateError ? updateError.message : 'ok',
  });
}

console.table(hasil);
