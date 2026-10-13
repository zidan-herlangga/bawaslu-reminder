import 'package:forui/forui.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/router.dart';
import 'config/env.dart';
import 'layanan/notifikasi.dart';
import 'tema/warna.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await initializeDateFormatting('id_ID');

  if (Env.adaSupabase) {
    await Supabase.initialize(url: Env.supabaseUrl, publishableKey: Env.supabaseAnonKey);
  }

  Notifikasi.saatDibuka = (lokasi) => RouterApp.router.go(lokasi);
  await Notifikasi.mulai();

  runApp(const App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    final tema = temaBawaslu();

    return MaterialApp.router(
      title: 'Bawaslu Jadwal',
      debugShowCheckedModeBanner: false,
      theme: tema.toApproximateMaterialTheme(),
      locale: const Locale('id'),
      localizationsDelegates: FLocalizations.localizationsDelegates,
      supportedLocales: FLocalizations.supportedLocales,
      builder: (context, child) => FTheme(
        data: tema,
        child: Material(
          type: MaterialType.transparency,
          child: child ?? const SizedBox.shrink(),
        ),
      ),
      routerConfig: RouterApp.router,
    );
  }
}
