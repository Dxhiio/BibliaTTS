#!/usr/bin/env python3
"""
generate_kokoro.py
==================
Genera audio humanizado con Kokoro TTS para los primeros N capítulos
de una Biblia desde su EPUB (formato SBU/Sociedades Bíblicas Unidas).

Requisitos previos:
  1. Instalar espeak-ng en Windows:
     https://github.com/espeak-ng/espeak-ng/releases  (bajar el .msi, instalar)
  2. pip install kokoro soundfile numpy

Uso:
  python scripts/generate_kokoro.py --epub "C:/ruta/SantaBibliaRV60.epub" --book GEN --chapters 5
"""

import argparse
import re
import subprocess
import sys
import zipfile
from pathlib import Path

import numpy as np

# ─────────────────────────────────────────────────────────────────────────────
# Mapeo canónico: abreviatura → (id_numérico, nombre)
# ─────────────────────────────────────────────────────────────────────────────
BOOKS = {
    'GEN': (1, 'Génesis'),    'EXO': (2, 'Éxodo'),        'LEV': (3, 'Levítico'),
    'NUM': (4, 'Números'),    'DEU': (5, 'Deuteronomio'),  'JOS': (6, 'Josué'),
    'JUE': (7, 'Jueces'),     'RUT': (8, 'Rut'),           '1SA': (9, '1 Samuel'),
    '2SA': (10, '2 Samuel'),  '1RE': (11, '1 Reyes'),      '2RE': (12, '2 Reyes'),
    '1CR': (13, '1 Crónicas'),'2CR': (14, '2 Crónicas'),  'ESD': (15, 'Esdras'),
    'NEH': (16, 'Nehemías'),  'EST': (17, 'Ester'),        'JOB': (18, 'Job'),
    'SAL': (19, 'Salmos'),    'PRO': (20, 'Proverbios'),   'ECL': (21, 'Eclesiastés'),
    'CAN': (22, 'Cantares'),  'ISA': (23, 'Isaías'),       'JER': (24, 'Jeremías'),
    'LAM': (25, 'Lamentaciones'),'EZE': (26, 'Ezequiel'), 'DAN': (27, 'Daniel'),
    'OSE': (28, 'Oseas'),     'JOE': (29, 'Joel'),         'AMO': (30, 'Amós'),
    'ABD': (31, 'Abdías'),    'JON': (32, 'Jonás'),        'MIQ': (33, 'Miqueas'),
    'NAH': (34, 'Nahum'),     'HAB': (35, 'Habacuc'),      'SOF': (36, 'Sofonías'),
    'HAG': (37, 'Hageo'),     'ZAC': (38, 'Zacarías'),     'MAL': (39, 'Malaquías'),
    'MAT': (40, 'Mateo'),     'MAR': (41, 'Marcos'),       'LUC': (42, 'Lucas'),
    'JUA': (43, 'Juan'),      'HEC': (44, 'Hechos'),       'ROM': (45, 'Romanos'),
    '1CO': (46, '1 Corintios'),'2CO': (47, '2 Corintios'),'GAL': (48, 'Gálatas'),
    'EFE': (49, 'Efesios'),   'FIL': (50, 'Filipenses'),   'COL': (51, 'Colosenses'),
    '1TE': (52, '1 Tesalonicenses'),'2TE': (53, '2 Tesalonicenses'),
    '1TI': (54, '1 Timoteo'), '2TI': (55, '2 Timoteo'),   'TIT': (56, 'Tito'),
    'FLM': (57, 'Filemón'),   'HEB': (58, 'Hebreos'),      'SAN': (59, 'Santiago'),
    '1PE': (60, '1 Pedro'),   '2PE': (61, '2 Pedro'),      '1JN': (62, '1 Juan'),
    '2JN': (63, '2 Juan'),    '3JN': (64, '3 Juan'),       'JUD': (65, 'Judas'),
    'APO': (66, 'Apocalipsis'),
}


# ─────────────────────────────────────────────────────────────────────────────
# Parseo del EPUB (estructura SBU: id="...htmlv{BB}{CCC}{VVV}")
# ─────────────────────────────────────────────────────────────────────────────
def strip_html(html: str) -> str:
    text = re.sub(r'<[^>]+>', '', html)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), text)
    text = re.sub(r'&\w+;', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def parse_epub_chapter(epub_path: str, book_num: int, chapter_num: int) -> list[tuple[int, str]]:
    """
    Extrae los versículos de un capítulo usando los IDs estructurados del EPUB.
    Retorna lista de (numero_versiculo, texto).
    """
    verses = []
    bb = f'{book_num:02d}'
    ccc = f'{chapter_num:03d}'
    anchor_pattern = re.compile(rf'id="[^"]*htmlv{bb}{ccc}(\d{{3}})"')
    p_pattern = re.compile(r'<p[^>]*>(.*?)</p>', re.DOTALL)

    with zipfile.ZipFile(epub_path, 'r') as zf:
        html_files = sorted(
            [n for n in zf.namelist() if n.endswith(('.xhtml', '.html', '.htm'))],
            key=lambda s: [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', s)]
        )
        for filename in html_files:
            try:
                html = zf.read(filename).decode('utf-8', errors='ignore')
            except Exception:
                continue

            # Verificar si este archivo contiene versículos de este capítulo
            if not anchor_pattern.search(html):
                continue

            # Extraer párrafos que contienen un anchor de versículo real
            for p_match in p_pattern.finditer(html):
                p_content = p_match.group(1)
                anchor = anchor_pattern.search(p_content)
                if not anchor:
                    continue
                verse_num = int(anchor.group(1))
                if verse_num == 0:
                    continue  # Es encabezado de capítulo, no versículo
                text = strip_html(p_content)
                # Filtrar si es solo números (índice de navegación)
                if len(text) < 5 or re.match(r'^[\d\s,;.]+$', text):
                    continue
                verses.append((verse_num, text))

    return sorted(set(verses), key=lambda x: x[0])


# ─────────────────────────────────────────────────────────────────────────────
# Generación de audio con Kokoro TTS
# ─────────────────────────────────────────────────────────────────────────────
def generate_audio_kokoro(text: str, output_wav: Path, voice: str = 'em_alex', speed: float = 0.92) -> bool:
    """
    Genera un archivo WAV usando Kokoro TTS con voz en español.
    voice opciones: 'em_alex' (masculina), 'ef_dora' (femenina)
    speed < 1.0 = más lento y pausado (recomendado para lectura bíblica)
    """
    try:
        import soundfile as sf
        from kokoro import KPipeline

        print(f'  🎙 Kokoro procesando {len(text)} caracteres con voz {voice}...')
        pipeline = KPipeline(lang_code='e')  # 'e' = Español
        chunks = []

        for _, _, audio in pipeline(text, voice=voice, speed=speed):
            chunks.append(audio)

        if not chunks:
            print('  ⚠ Kokoro no generó audio.')
            return False

        combined = np.concatenate(chunks)
        sf.write(str(output_wav), combined, 24000)
        print(f'  ✓ WAV guardado: {output_wav} ({combined.shape[0] / 24000:.1f}s)')
        return True

    except ImportError as e:
        print(f'\n❌ Dependencia faltante: {e}')
        print('Ejecuta: pip install kokoro soundfile numpy')
        return False
    except Exception as e:
        print(f'\n❌ Error generando audio: {e}')
        return False


def wav_to_opus(wav_path: Path, opus_path: Path, bitrate: str = '24k') -> bool:
    """Convierte WAV a OPUS usando ffmpeg."""
    opus_path.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ['ffmpeg', '-y', '-i', str(wav_path),
         '-c:a', 'libopus', '-b:a', bitrate, '-ac', '1',
         str(opus_path)],
        capture_output=True, text=True
    )
    wav_path.unlink(missing_ok=True)
    if result.returncode == 0:
        size_kb = opus_path.stat().st_size / 1024
        print(f'  ✓ OPUS guardado: {opus_path} ({size_kb:.0f} KB)')
        return True
    else:
        print(f'  ❌ ffmpeg error: {result.stderr[-300:]}')
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Genera audio Kokoro TTS para capítulos de una Biblia EPUB')
    parser.add_argument('--epub', required=True, help='Ruta al archivo .epub (ej: "C:/ruta/SantaBibliaRV60.epub")')
    parser.add_argument('--book', default='GEN', help='Abreviatura del libro (ej: GEN, MAT, JUA). Default: GEN')
    parser.add_argument('--chapters', type=int, default=5, help='Cuántos capítulos generar desde el primero. Default: 5')
    parser.add_argument('--voice', default='em_alex', choices=['em_alex', 'ef_dora'],
                        help='Voz Kokoro: em_alex (masculina), ef_dora (femenina). Default: em_alex')
    parser.add_argument('--speed', type=float, default=0.92,
                        help='Velocidad de lectura (0.8=lenta, 1.0=normal). Default: 0.92')
    parser.add_argument('--bitrate', default='24k', help='Bitrate OPUS. Default: 24k')
    args = parser.parse_args()

    book_abbr = args.book.upper()
    if book_abbr not in BOOKS:
        print(f'❌ Libro desconocido: {book_abbr}')
        print(f'Libros válidos: {", ".join(BOOKS.keys())}')
        sys.exit(1)

    book_num, book_name = BOOKS[book_abbr]
    epub_path = Path(args.epub)
    if not epub_path.exists():
        print(f'❌ Archivo no encontrado: {epub_path}')
        sys.exit(1)

    # Directorio de salida compatible con la estructura de la app
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    out_dir = project_root / 'public' / 'audio' / book_abbr
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f'\n📖 Biblia: {epub_path.name}')
    print(f'📚 Libro:  {book_name} (ID: {book_num:02d})')
    print(f'🎙 Voz:    {args.voice} | Velocidad: {args.speed}x | Bitrate: {args.bitrate}')
    print(f'📂 Salida: {out_dir}\n')

    generated = 0
    failed = 0

    for chapter_num in range(1, args.chapters + 1):
        print(f'─── Capítulo {chapter_num} ───')
        verses = parse_epub_chapter(str(epub_path), book_num, chapter_num)

        if not verses:
            print(f'  ⚠ No se encontraron versículos para {book_abbr} capítulo {chapter_num}. Saltando.')
            failed += 1
            continue

        print(f'  📜 {len(verses)} versículos encontrados')

        # Construir el texto completo del capítulo
        # Agregar pequeñas pausas con comas después del número de versículo
        chapter_text = ' '.join(f'{v_num}, {v_text}' for v_num, v_text in verses)

        # Nombres de archivo compatibles con la app (ej: gen_001.opus)
        file_stem = f'{book_abbr.lower()}_{chapter_num:03d}'
        wav_path = out_dir / f'{file_stem}.wav'
        opus_path = out_dir / f'{file_stem}.opus'

        if opus_path.exists():
            print(f'  ⏭ Ya existe: {opus_path.name} — saltando')
            generated += 1
            continue

        ok = generate_audio_kokoro(chapter_text, wav_path, voice=args.voice, speed=args.speed)
        if not ok:
            failed += 1
            continue

        ok = wav_to_opus(wav_path, opus_path, bitrate=args.bitrate)
        if ok:
            generated += 1
        else:
            failed += 1

    print(f'\n{"="*50}')
    print(f'✅ Generados exitosamente: {generated} capítulos')
    if failed:
        print(f'❌ Fallidos:              {failed} capítulos')
    print(f'\nArchivos en: {out_dir}')
    print('\nPara que la app los sirva correctamente, agrega RVR60 como traducción')
    print('integrada en data/bible_rvr60.json (ejecuta: node scripts/parse_bible.js --epub tu_archivo.epub)')


if __name__ == '__main__':
    main()
