import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envPath =
  process.argv[2] ||
  'C:/Users/advan/AppData/Local/Temp/opencode/vercel.env';

for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) {
    process.env[m[1]] = m[2]
      .trim()
      .replace(/^\s*"|"\s*$/g, '')
      .replace(/\\n/g, '\n');
  }
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const target = process.argv[3] || 'c0451442-1e7d-462b-9c04-cb5193e004ad';
const { data: tokens, error } = await admin
  .from('device_tokens')
  .select('token, platform, id')
  .eq('user_id', target);

if (error) {
  console.log('GAGAL BACA TOKEN:', error.message);
  process.exit(1);
}

console.log('Token target:', JSON.stringify(tokens));

const { kirimKeNative } = await import('../api/lib/push-native.js');

const hasil = await kirimKeNative(tokens ?? [], {
  title: 'Uji FCM (debug)',
  body: 'Pengujian jalur FCM langsung ke perangkat.',
  tag: `bRi-uji-${Date.now()}`,
  data: { kategori: 'Tugas', todo_id: 'uji' },
});

console.log('\n=== HASIL KIRIM KE NATIVE ===');
console.log(JSON.stringify(hasil, null, 2));