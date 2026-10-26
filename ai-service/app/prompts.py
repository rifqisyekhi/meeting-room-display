"""Prompt LLM untuk penyusunan notulen (bahasa Indonesia). Ubah di sini bila perlu."""

SYSTEM = """Anda adalah notulis rapat profesional di sebuah instansi pemerintah Indonesia.
Aturan wajib:
- Gunakan bahasa Indonesia baku yang ringkas dan jelas (istilah asing boleh dipertahankan bila memang dipakai).
- JANGAN mengarang informasi. Tulis hanya hal yang benar-benar ada di bahan yang diberikan.
- Jika penanggung jawab (PIC) atau tenggat waktu tidak disebutkan, tulis "-".
- Bahan berasal dari transkripsi otomatis yang bisa salah dengar/salah ketik. Perbaiki kata yang
  keliru hanya jika maksudnya jelas dari konteks; jangan menebak nama orang atau angka.
- Abaikan basa-basi, salam pembuka, dan percakapan di luar topik rapat.
- Tulis langsung hasilnya tanpa kalimat pengantar atau penutup."""

NOTES_FORMAT = """### Pembahasan
- <topik>: <inti pembahasan; sebutkan siapa yang menyampaikan bila jelas>
### Keputusan
- <keputusan yang disepakati>
### Action Item
- <tugas> | <PIC> | <tenggat>
### Catatan
- <informasi penting lain: angka, data, kendala, hal yang ditunda>

Jika suatu bagian tidak berisi apa pun, tulis "- (tidak ada)"."""


def meeting_context(meeting: dict) -> str:
    parts = [f"Judul rapat: {meeting.get('title') or '-'}"]
    if meeting.get("agenda"):
        parts.append(f"Agenda: {meeting['agenda']}")
    if meeting.get("participants"):
        parts.append("Peserta: " + ", ".join(meeting["participants"]))
    return "\n".join(parts)


def map_prompt(meeting: dict, chunk: str, index: int, total: int) -> str:
    return f"""{meeting_context(meeting)}

Berikut BAGIAN {index} DARI {total} transkrip rapat (format: [jam:menit:detik] Pembicara: ucapan).
Buat catatan poin dari bagian ini dengan format persis berikut:

{NOTES_FORMAT}

Transkrip bagian {index}:
<<<
{chunk}
>>>"""


def reduce_prompt(meeting: dict, notes: str) -> str:
    return f"""{meeting_context(meeting)}

Berikut beberapa catatan poin dari bagian-bagian rapat yang berurutan. Gabungkan menjadi SATU
catatan poin dengan format yang sama. Satukan poin yang sama atau berulang, pertahankan SEMUA
keputusan dan action item, dan jaga urutan kronologis.

Format:
{NOTES_FORMAT}

Catatan yang akan digabung:
<<<
{notes}
>>>"""


FINAL_FORMAT = """## Ringkasan
<satu paragraf 3–6 kalimat tentang tujuan dan hasil utama rapat>

## Pembahasan
### <Topik 1>
- <poin pembahasan>
### <Topik 2>
- <poin pembahasan>

## Keputusan
1. <keputusan>

## Action Item
| No | Tugas | PIC | Tenggat |
|----|-------|-----|---------|
| 1 | <tugas> | <PIC atau -> | <tenggat atau -> |

## Catatan dan Tindak Lanjut
- <catatan>"""


def final_prompt(meeting: dict, material: str, is_raw_transcript: bool) -> str:
    kind = "transkrip rapat (format: [jam:menit:detik] Pembicara: ucapan)" if is_raw_transcript \
        else "catatan poin hasil peringkasan seluruh rapat"
    return f"""{meeting_context(meeting)}

Susun notulen rapat dalam format Markdown berdasarkan {kind} di bawah.
Gunakan struktur PERSIS seperti ini, dimulai dari "## Ringkasan":

{FINAL_FORMAT}

Ketentuan:
- JANGAN menulis judul, tanggal, tempat, atau daftar peserta (sudah ditulis oleh sistem).
- Kelompokkan pembahasan per topik. Jika tidak ada keputusan, tulis "- Tidak ada keputusan yang dicatat."
- Jika tidak ada action item, tetap buat tabel dengan satu baris berisi "-".

Bahan:
<<<
{material}
>>>"""
