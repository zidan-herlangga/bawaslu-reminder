import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:material_ui/material_ui.dart';

import 'package:staff_reminder/layar/akun.dart';
import 'package:staff_reminder/layar/jadwal_baru.dart';
import 'package:staff_reminder/layar/todo.dart';
import 'package:staff_reminder/tema/warna.dart';

/// Meniru `MaterialApp.builder` di `main.dart`, termasuk penyedia `Material`
/// transparan yang membuat widget Material (DropdownButton, InputDecorator,
/// TextField, dll.) bekerja di bawah `FScaffold`.
Widget _harness(Widget child) => MaterialApp(
  localizationsDelegates: FLocalizations.localizationsDelegates,
  supportedLocales: FLocalizations.supportedLocales,
  builder: (context, c) => FTheme(
    data: temaBawaslu(),
    child: Material(
      type: MaterialType.transparency,
      child: c ?? const SizedBox.shrink(),
    ),
  ),
  home: FScaffold(child: child),
);

void main() {
  testWidgets('tab Akun: klik Ubah menampilkan form tanpa error', (tester) async {
    await tester.pumpWidget(_harness(const LayarAkun()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ubah'));
    await tester.pumpAndSettle();

    expect(find.text('Simpan profil'), findsOneWidget);
  });

  testWidgets('tab Tugas: membangun tanpa error', (tester) async {
    await tester.pumpWidget(_harness(const LayarTodo()));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('Jadwal baru: form membangun tanpa error', (tester) async {
    await tester.pumpWidget(_harness(const LayarJadwalBaru()));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Judul'), findsOneWidget);
  });
}
