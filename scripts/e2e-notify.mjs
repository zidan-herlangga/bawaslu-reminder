import { readFileSync } from 'node:fs';

// Path relatif terhadap berkas ini, bukan path absolut, supaya skrip bisa
// dijalankan dari repo mana pun.
const ROOT = new URL('..', import.meta.url);
const API =
  process.env.TEST_BASE_URL
    ? `${process.env.TEST_BASE_URL.replace(/\/$/, '')}/api/notify`
    : 'http://localhost:5173/api/notify';

function env(name) {
  const text = readFileSync(new URL('.env', ROOT), 'utf8');
  const match = text.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

const URL_SB = env('SUPABASE_URL');
const KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const rest = `${URL_SB}/rest/v1`;
const auth = `${URL_SB}/auth/v1`;

let pass = 0;
let fail = 0;

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  [PASS] ${label}${detail ? ` -> ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  [FAIL] ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

const svcHeaders = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

let userId = null;

async function cleanup() {
  if (!userId) return;
  const res = await fetch(`${auth}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: svcHeaders,
  });
  console.log(`  cleanup user -> HTTP ${res.status}`);
  userId = null;
}

async function main() {
  if (!URL_SB || !KEY) {
    console.log('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong di .env');
    process.exit(1);
  }

  console.log('1. Buat akun uji sementara');
  const email = `e2e-${Date.now()}@bawaslu.test`;
  const password = 'E2eTester!2345';
  const created = await fetch(`${auth}/admin/users`, {
    method: 'POST',
    headers: svcHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nama_lengkap: 'E2E Tester',
        divisi: 'Pencegahan, Partisipasi Masyarakat, dan Humas',
        jabatan: 'Staf Pendukung',
      },
    }),
  });
  const createdBody = await created.json();
  userId = createdBody.id ?? createdBody.user?.id ?? null;
  check('akun uji dibuat', created.ok && Boolean(userId), `HTTP ${created.status}`);
  if (!userId) return;

  try {
    console.log('2. Login untuk memperoleh access token');
    const login = await fetch(`${auth}/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await login.json();
    const token = loginBody.access_token;
    check('login sukses', login.ok && Boolean(token), `HTTP ${login.status}`);
    if (!token) return;

    console.log('3. Buat jadwal (tanpa target_divisi = semua staf)');
    const scheduleRes = await fetch(`${rest}/schedules`, {
      method: 'POST',
      headers: { ...svcHeaders, Prefer: 'return=representation' },
      body: JSON.stringify([
        {
          pembuat_id: userId,
          pembuat_nama: 'E2E Tester',
          pembuat_divisi: 'Pencegahan, Partisipasi Masyarakat, dan Humas',
          judul: 'Uji Blackbox Ingatkan',
          kategori: 'Rapat',
          waktu_mulai: new Date(Date.now() + 86400000).toISOString(),
          slots: [{ mulai: new Date(Date.now() + 86400000).toISOString(), selesai: null }],
        },
      ]),
    });
    const scheduleBody = await scheduleRes.json();
    const scheduleId = Array.isArray(scheduleBody) ? scheduleBody[0]?.id : null;
    check('jadwal dibuat', scheduleRes.ok && Boolean(scheduleId), `HTTP ${scheduleRes.status}`);
    if (!scheduleId) return;

    console.log('4. Panggil POST /api/notify (alur "Ingatkan")');
    const notifyRes = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ scheduleId }),
    });
    const notifyBody = await notifyRes.json().catch(() => ({}));
    check(
      'respons 200 (env + token + ownership lolos)',
      notifyRes.status === 200,
      `HTTP ${notifyRes.status} ${JSON.stringify(notifyBody)}`
    );
    const terkirim = notifyBody.terkirim ?? 0;
    check('ada penerima', terkirim > 0, `terkirim=${terkirim}, push=${notifyBody.push ?? 0}`);

    console.log('5. Verifikasi baris notifications benar-benar terbuat');
    const rowsRes = await fetch(
      `${rest}/notifications?select=id,penerima_id,jadwal_id&jadwal_id=eq.${scheduleId}`,
      { headers: svcHeaders }
    );
    const rows = await rowsRes.json().catch(() => []);
    check(
      'jumlah baris notifikasi = terkirim',
      rowsRes.ok && rows.length === terkirim,
      `rows=${rows.length}, terkirim=${terkirim}`
    );

    console.log('6. Setiap penerima harus punya baris profiles (nama tidak boleh kosong)');
    // Dulu dicek "profiles >= 2", tapi itu bergantung pada isi database dan
    // gagal saat database hanya berisi satu akun. Yang benar-benar penting:
    // semua penerima yang dapat notifikasi harus punya profil.
    const idsPenerima = [...new Set(rows.map((row) => row.penerima_id).filter(Boolean))];
    const profilesRes = await fetch(
      `${rest}/profiles?select=id,nama_lengkap&id=in.(${idsPenerima.join(',')})`,
      { headers: svcHeaders }
    );
    const profiles = await profilesRes.json().catch(() => []);
    const adaProfil = Array.isArray(profiles) ? profiles.length : 0;
    const adaNama = Array.isArray(profiles) && profiles.every((p) => Boolean(p.nama_lengkap));

    check(
      'semua penerima punya profil',
      profilesRes.ok && adaProfil === idsPenerima.length,
      `penerima=${idsPenerima.length}, profil=${adaProfil}`
    );
    check('setiap profil punya nama lengkap', adaNama);
  } catch (error) {
    fail += 1;
    console.log(`  [FAIL] exception -> ${error && error.message ? error.message : error}`);
  } finally {
    console.log('7. Bersihkan akun uji (jadwal & notifikasi ikut ter-cascade)');
    await cleanup();
  }
}

await main();

console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`);
process.exit(fail > 0 ? 1 : 0);