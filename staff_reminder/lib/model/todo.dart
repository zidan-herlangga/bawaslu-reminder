/// Model tugas (`todos`).
class Todo {
  const Todo({
    required this.id,
    required this.teks,
    required this.selesai,
    required this.tanggal,
    this.createdAt,
  });

  final String id;
  final String teks;
  final bool selesai;
  final String tanggal;
  final String? createdAt;

  factory Todo.dariJson(Map<String, dynamic> json) {
    final rawSelesai = json['selesai'];
    return Todo(
      id: (json['id'] ?? '').toString(),
      teks: (json['teks'] ?? '').toString(),
      selesai: rawSelesai == true || rawSelesai == 'true',
      tanggal: (json['tanggal'] ?? '').toString(),
      createdAt: json['created_at']?.toString(),
    );
  }

  Todo salin({bool? selesai, String? teks, String? tanggal}) {
    return Todo(
      id: id,
      teks: teks ?? this.teks,
      selesai: selesai ?? this.selesai,
      tanggal: tanggal ?? this.tanggal,
      createdAt: createdAt,
    );
  }
}
