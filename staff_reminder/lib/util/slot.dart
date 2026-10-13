import '../model/jadwal.dart';

/// Keadaan agenda sebuah jadwal relatif terhadap waktu sekarang.
enum Agenda { ongoing, upcoming, done }

/// Cermin dari `src/lib/slots.js` (web).
class Slot {
  const Slot._();

  static List<Sesi> urut(List<Sesi> slots) {
    final salinan = [...slots];
    salinan.sort((a, b) {
      final ta = a.mulaiDt?.millisecondsSinceEpoch ?? 1 << 62;
      final tb = b.mulaiDt?.millisecondsSinceEpoch ?? 1 << 62;
      return ta.compareTo(tb);
    });
    return salinan;
  }

  /// Apakah satu sesi sudah lewat waktunya. Sesi tanpa waktu selesai dianggap
  /// selesai begitu waktu mulainya lewat.
  static bool sesiSelesai(Sesi slot, int nowMs) {
    final mulai = slot.mulaiDt?.millisecondsSinceEpoch;
    if (mulai == null || mulai > nowMs) return false;
    final selesai = slot.selesaiDt?.millisecondsSinceEpoch;
    if (slot.selesai == null || selesai == null) return true;
    return selesai <= nowMs;
  }

  static bool jadwalSelesai(Jadwal jadwal, int nowMs) {
    final slots = jadwal.sesi;
    if (slots.isEmpty) return false;
    return slots.every((s) => sesiSelesai(s, nowMs));
  }

  static Agenda kelasAgenda(Jadwal jadwal, int nowMs) {
    final slots = urut(jadwal.sesi);
    if (slots.isEmpty) return Agenda.done;
    if (slots.every((s) => sesiSelesai(s, nowMs))) return Agenda.done;

    final sedang = slots.any((s) {
      final mulai = s.mulaiDt?.millisecondsSinceEpoch;
      return mulai != null && mulai <= nowMs;
    });
    return sedang ? Agenda.ongoing : Agenda.upcoming;
  }

  /// Waktu mulai berikutnya (untuk agenda yang akan datang), atau null.
  static int? nextStart(List<Sesi> slots, int nowMs) {
    for (final s in urut(slots)) {
      final mulai = s.mulaiDt?.millisecondsSinceEpoch;
      if (mulai != null && mulai > nowMs) return mulai;
    }
    return null;
  }

  /// Apakah ada sesi yang sedang berlangsung.
  static bool sedangBerlangsung(List<Sesi> slots, int nowMs) {
    for (final s in urut(slots)) {
      final mulai = s.mulaiDt?.millisecondsSinceEpoch;
      if (mulai == null || mulai > nowMs) continue;
      final selesai = s.selesaiDt?.millisecondsSinceEpoch;
      if (s.selesai == null || selesai == null || selesai >= nowMs) return true;
    }
    return false;
  }

  static const Map<Agenda, int> urutanAgenda = {
    Agenda.ongoing: 0,
    Agenda.upcoming: 1,
    Agenda.done: 2,
  };

  /// Mengurutkan jadwal: sedang berlangsung, akan datang, lalu yang lewat.
  static List<Jadwal> sortByAgenda(List<Jadwal> daftar, int nowMs) {
    final salinan = [...daftar];
    salinan.sort((a, b) {
      final ka = kelasAgenda(a, nowMs);
      final kb = kelasAgenda(b, nowMs);
      if (ka != kb) {
        return (urutanAgenda[ka] ?? 9).compareTo(urutanAgenda[kb] ?? 9);
      }
      final sa = urut(a.sesi);
      final sb = urut(b.sesi);
      final ma = sa.isEmpty ? (1 << 62) : (sa.first.mulaiDt?.millisecondsSinceEpoch ?? (1 << 62));
      final mb = sb.isEmpty ? (1 << 62) : (sb.first.mulaiDt?.millisecondsSinceEpoch ?? (1 << 62));
      return ma.compareTo(mb);
    });
    return salinan;
  }
}
