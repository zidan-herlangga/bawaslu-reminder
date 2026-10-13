import 'package:flutter_test/flutter_test.dart';

import 'package:staff_reminder/main.dart';

void main() {
  testWidgets('App membangun tanpa error', (WidgetTester tester) async {
    await tester.pumpWidget(const App());
    await tester.pumpAndSettle();

    expect(find.byType(App), findsOneWidget);
  });
}
