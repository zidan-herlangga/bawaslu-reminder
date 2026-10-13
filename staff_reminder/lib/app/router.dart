import 'package:go_router/go_router.dart';

import '../config/env.dart';
import '../layar/akun.dart';
import '../layar/beranda.dart';
import '../layar/daftar.dart';
import '../layar/jadwal_baru.dart';
import '../layar/jadwal_detail.dart';
import '../layar/kalender.dart';
import '../layar/masuk.dart';
import '../layar/notifikasi.dart';
import '../layar/todo.dart';
import '../layanan/auth.dart';
import 'kerangka_tab.dart';

/// Konfigurasi rute aplikasi.
///
/// Struktur: satu layar masuk, satu shell ber-tab (Beranda/Kalender/Tugas/
/// Akun), lalu layar jadwal baru, ubah, dan detail di atasnya. Redirect
/// menjaga sesi: bila Supabase dikonfigurasi dan belum ada sesi, arahkan ke
/// `/masuk`.
final class RouterApp {
  const RouterApp._();

  static final GoRouter router = GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      if (!Env.adaSupabase) return null;
      final lokasi = state.matchedLocation;
      // Rute yang boleh dibuka tanpa sesi: masuk dan daftar.
      final rutePublik = lokasi == '/masuk' || lokasi == '/daftar';
      if (!Auth.sudahMasuk && !rutePublik) return '/masuk';
      if (Auth.sudahMasuk && rutePublik) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/masuk', builder: (context, state) => const LayarMasuk()),
      GoRoute(path: '/daftar', builder: (context, state) => const LayarDaftar()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => KerangkaTab(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/', builder: (context, state) => const LayarBeranda())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/kalender', builder: (context, state) => const LayarKalender())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/todo', builder: (context, state) => const LayarTodo())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/akun', builder: (context, state) => const LayarAkun())],
          ),
        ],
      ),
      GoRoute(path: '/jadwal/baru', builder: (context, state) => const LayarJadwalBaru()),
      GoRoute(path: '/notifikasi', builder: (context, state) => const LayarNotifikasi()),
      GoRoute(
        path: '/jadwal/:id/edit',
        builder: (context, state) => LayarJadwalBaru(id: state.pathParameters['id']),
      ),
      GoRoute(
        path: '/jadwal/:id',
        builder: (context, state) => LayarJadwalDetail(id: state.pathParameters['id'] ?? ''),
      ),
    ],
  );
}
