import { readFileSync } from 'node:fs';
import handler from '../api/notify.js';

// Memeriksa lapis paling depan api/notify.js tanpa menyentuh jaringan sungguhan:
// penolakan metode, env kosong, token kosong, dan bentuk body dari Vercel.
function envFromFile(name) {
  try {
    const text = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const match = text.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

const URL_SUPABASE = envFromFile('SUPABASE_URL');

function mockRes() {
  const res = { headers: {}, statusCode: 0, body: null };
  res.setHeader = (k, v) => {
    res.headers[k] = v;
    return res;
  };
  res.end = (chunk) => {
    res.body = typeof chunk === 'string' ? chunk : String(chunk);
  };
  return res;
}

async function call(name, req) {
  const res = mockRes();
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('WAKTU HABIS 15 dtk')), 15000)
  );
  try {
    await Promise.race([handler(req, res), timeout]);
    let parsed = res.body;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      /* biarkan mentah */
    }
    console.log(
      `${res.statusCode === 200 ? 'OK  ' : '    '} [${name}] status=${res.statusCode} body=${JSON.stringify(parsed)}`
    );
    return res;
  } catch (error) {
    console.log(`GAGAL [${name}] melempar ${error.message}`);
    return res;
  }
}

let lulus = 0;
let gagal = 0;
function cek(nama, ok, info = '') {
  if (ok) {
    lulus += 1;
    console.log(`  [PASS] ${nama}${info ? ' -> ' + info : ''}`);
  } else {
    gagal += 1;
    console.log(`  [FAIL] ${nama}${info ? ' -> ' + info : ''}`);
  }
}

console.log('1. Metode selain POST harus ditolak');
{
  const res = await call('GET', { method: 'GET', headers: {}, body: {} });
  cek('status 405', res.statusCode === 405, `status=${res.statusCode}`);
}

console.log('\n2. Env server kosong harus ditolak');
{
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  const res = await call('POST tanpa env', {
    method: 'POST',
    headers: {},
    body: { scheduleId: 'x' },
  });
  cek('status 500', res.statusCode === 500, `status=${res.statusCode}`);
}

console.log('\n3. Env terisi, tanpa token');
{
  process.env.SUPABASE_URL = URL_SUPABASE || 'https://contoh.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_dummy';
  process.env.VAPID_PUBLIC_KEY = 'BPdummy';
  process.env.VAPID_PRIVATE_KEY = 'dummy';
  const res = await call('POST tanpa token', {
    method: 'POST',
    headers: {},
    body: { scheduleId: 'x' },
  });
  cek('status 401', res.statusCode === 401, `status=${res.statusCode}`);
}

console.log('\n4. Body berbentuk string (Vercel kadang tidak mem-parsing)');
{
  const res = await call('POST body string', {
    method: 'POST',
    headers: { authorization: 'Bearer abc' },
    body: '{"scheduleId":""}',
  });
  cek('ditolak 401, bukan galat server', res.statusCode === 401, `status=${res.statusCode}`);
}

console.log('\n5. Token tidak valid');
{
  const res = await call('POST token rusak', {
    method: 'POST',
    headers: { authorization: 'Bearer not-a-jwt' },
    body: { scheduleId: 'x' },
  });
  cek('status 401', res.statusCode === 401, `status=${res.statusCode}`);
}

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal > 0 ? 1 : 0);