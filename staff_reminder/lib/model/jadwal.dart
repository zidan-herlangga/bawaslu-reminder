/// Satu sesi (slot waktu) pada sebuah jadwal.
class Sesi {
  const Sesi({required this.mulai, this.selesai});

  final String mulai;
  final String? selesai;

  DateTime? get mulaiDt => DateTime.tryParse(mulai);
  DateTime? get selesaiDt => selesai == null ? null : DateTime.tryParse(selesai!);

  factory Sesi.dariJson(Map<String, dynamic> json) {
    final rawSelesai = json['selesai'];
    return Sesi(
      mulai: (json['mulai'] ?? '').toString(),
      selesai: rawSelesai == null || rawSelesai.toString().isEmpty
          ? null
          : rawSelesai.toString(),
    );
  }

  Map<String, dynamic> keJson() => {'mulai': mulai, 'selesai': selesai};
}

/// Model jadwal (`schedules`). Mendukung format `slots` (jsonb) yang baru
/// sekaligus field lama `waktu_mulai`/`waktu_selesai`.
class Jadwal {
  const Jadwal({
    required this.id,
    required this.judul,
    required this.kategori,
    required this.status,
    this.deskripsi,
    this.targetDivisi,
    this.slots = const [],
    this.waktuMulai,
    this.waktuSelesai,
    this.pembuatId,
    this.pembuatNama,
    this.pembuatDivisi,
    this.createdAt,
  });

  final String id;
  final String judul;
  final String kategori;
  final String status;
  final String? deskripsi;
  final String? targetDivisi;
  final List<Sesi> slots;
  final String? waktuMulai;
  final String? waktuSelesai;
  final String? pembuatId;
  final String? pembuatNama;
  final String? pembuatDivisi;
  final String? createdAt;

  /// Sesi efektif: pakai `slots` bila ada, jika tidak pakai field lama.
  List<Sesi> get sesi {
    if (slots.isNotEmpty) {
      return slots.where((s) => s.mulai.isNotEmpty).toList();
    }
    if (waktuMulai != null && waktuMulai!.isNotEmpty) {
      return [Sesi(mulai: waktuMulai!, selesai: waktuSelesai)];
    }
    return const [];
  }

  factory Jadwal.dariJson(Map<String, dynamic> json) {
    final rawSlots = json['slots'];
    final slots = <Sesi>[];
    if (rawSlots is List) {
      for (final item in rawSlots) {
        if (item is Map) slots.add(Sesi.dariJson(Map<String, dynamic>.from(item)));
      }
    }

    return Jadwal(
      id: (json['id'] ?? '').toString(),
      judul: (json['judul'] ?? '').toString(),
      kategori: (json['kategori'] ?? 'Lainnya').toString(),
      status: (json['status'] ?? 'Aktif').toString(),
      deskripsi: json['deskripsi']?.toString(),
      targetDivisi: json['target_divisi']?.toString(),
      slots: slots,
      waktuMulai: json['waktu_mulai']?.toString(),
      waktuSelesai: json['waktu_selesai']?.toString(),
      pembuatId: json['pembuat_id']?.toString(),
      pembuatNama: json['pembuat_nama']?.toString(),
      pembuatDivisi: json['pembuat_divisi']?.toString(),
      createdAt: json['created_at']?.toString(),
    );
  }
}
