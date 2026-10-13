import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';

/// Klien Supabase global.
///
/// Mengembalikan `null` kalau `SUPABASE_URL`/`SUPABASE_ANON_KEY` belum diisi
/// lewat dart-define, supaya UI tetap bisa dibuka (mode tanpa backend) saat
/// pengembangan tampilan.
SupabaseClient? get supabase => Env.adaSupabase ? Supabase.instance.client : null;
