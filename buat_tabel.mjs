import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const txt = fs.readFileSync('.env', 'utf8');
const env = {};
for (const l of txt.split(/\r?\n/)) {
  const s = l.trim();
  if (!s || s.startsWith('#')) continue;
  const i = s.indexOf('=');
  if (i < 0) continue;
  let k = s.slice(0, i).trim();
  let v = s.slice(i + 1).trim();
  if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) v = v.slice(1, -1);
  env[k] = v;
}
const s = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await s.rpc('exec_sql', { query: `
create table if not exists public.hari_libur (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null unique,
  keterangan text not null,
  jenis text not null check (jenis in ('libur_nasional','cuti_bersama')),
  tahun int not null,
  created_at timestamptz not null default now()
);
alter table public.hari_libur enable row level security;
drop policy if exists "hari_libur_select_authenticated" on public.hari_libur;
create policy "hari_libur_select_authenticated" on public.hari_libur for select using (auth.uid() is not null);
drop policy if exists "hari_libur_insert_authenticated" on public.hari_libur;
create policy "hari_libur_insert_authenticated" on public.hari_libur for insert with check (auth.uid() is not null);
drop policy if exists "hari_libur_update_authenticated" on public.hari_libur;
create policy "hari_libur_update_authenticated" on public.hari_libur for update using (auth.uid() is not null);
` });
console.log(error?.message);
