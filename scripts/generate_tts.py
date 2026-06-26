#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_tts.py
Genera audio narrado para capitulos biblicos usando Microsoft Edge TTS.
Voz: es-MX-JorgeNeural (masculina, espanol latinoamericano neutro)
Salida: archivos .opus + .json de timestamps por capitulo

Uso:
  python generate_tts.py --book GEN              # Solo Genesis
  python generate_tts.py --book GEN --chapter 1  # Solo Genesis 1
  python generate_tts.py --all                   # Todos (toma horas)

Requisitos:
  pip install edge-tts
  ffmpeg instalado y en PATH
"""

import asyncio
import json
import os
import sys
import argparse
import subprocess
from pathlib import Path

# Forzar UTF-8 en stdout para Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import edge_tts
except ImportError:
    print("[ERROR] Falta: pip install edge-tts")
    sys.exit(1)

# --- Configuracion ---
VOICE = "es-MX-DaliaNeural"   # Alternativa: es-MX-JorgeNeural (masculino)
RATE = "+0%"                    # Velocidad normal
PITCH = "+0Hz"
AUDIO_BITRATE = "16k"           # Bitrate opus (máxima compresión voz mono)

SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
DATA_FILE = ROOT_DIR / "data" / "bible.json"
AUDIO_DIR = ROOT_DIR / "app" / "public" / "audio"
TIMESTAMPS_DIR = ROOT_DIR / "app" / "public" / "timestamps"

# Asegurar directorios
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
TIMESTAMPS_DIR.mkdir(parents=True, exist_ok=True)


def get_audio_filename(book_abbr: str, chapter_num: int) -> str:
    """gen_001, gen_002, ..."""
    return f"{book_abbr.lower()}_{chapter_num:03d}"


def verses_to_text_and_map(verses: list) -> tuple:
    """
    Construye texto plano del capitulo y una lista de marcadores
    para mapear palabras a versiculos.
    """
    parts = []
    verse_map = []
    cursor = 0

    for verse in verses:
        label = verse.get("label", str(verse["number"]))
        text = verse["text"].strip()

        char_start = cursor
        parts.append(text)
        cursor += len(text) + 1  # +1 por espacio entre versiculos
        char_end = cursor

        verse_map.append({
            "verse": verse["number"],
            "label": label,
            "char_start": char_start,
            "char_end": char_end,
            "text": text
        })

    full_text = " ".join(parts)
    return full_text, verse_map


def _check_ffmpeg() -> bool:
    """Verifica si ffmpeg esta disponible en el sistema."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True, timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


async def generate_chapter_audio(book_abbr: str, chapter_num: int, verses: list):
    """
    Genera audio + timestamps para un capitulo.
    Guarda: audio/<book_abbr>/<abbr>_<num>.opus (o .mp3 si no hay ffmpeg) + timestamps/<book_abbr>/<abbr>_<num>.json
    """
    base_name = get_audio_filename(book_abbr, chapter_num)
    
    # Crear subcarpetas para el libro
    book_audio_dir = AUDIO_DIR / book_abbr
    book_ts_dir = TIMESTAMPS_DIR / book_abbr
    book_audio_dir.mkdir(exist_ok=True)
    book_ts_dir.mkdir(exist_ok=True)
    
    opus_path = book_audio_dir / f"{base_name}.opus"
    mp3_path = book_audio_dir / f"{base_name}.mp3"
    ts_path = book_ts_dir / f"{base_name}.json"

    # Si ya existe (opus o mp3) con timestamps, saltar
    audio_exists = opus_path.exists() or mp3_path.exists()
    if audio_exists and ts_path.exists():
        print(f"  [skip] {base_name} ya existe.")
        return

    text, verse_map = verses_to_text_and_map(verses)
    if not text.strip():
        print(f"  [warn] {base_name} sin texto, saltando.")
        return

    print(f"  [tts]  {base_name} ({len(verses)} versiculos, {len(text)} chars)...")

    # Generar con Edge-TTS con reintentos
    max_retries = 3
    retry_delay = 5  # Segundos iniciales
    
    for attempt in range(max_retries):
        try:
            communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)

            # Recopilar audio bytes y sentence boundary events
            audio_chunks = []
            word_boundaries = [] # We'll store sentences here to keep frontend compatibility
            current_char_offset = 0

            async for event in communicate.stream():
                if event["type"] == "audio":
                    audio_chunks.append(event["data"])
                elif event["type"] == "SentenceBoundary":
                    sentence_text = event["text"]
                    
                    # Buscar el offset de esta oracion en el texto completo
                    idx = text[current_char_offset:].find(sentence_text)
                    if idx != -1:
                        char_offset = current_char_offset + idx
                        current_char_offset = char_offset + len(sentence_text)
                    else:
                        char_offset = current_char_offset
                        
                    word_boundaries.append({
                        "word": sentence_text,
                        "start_ms": event["offset"] // 10000,   # 100ns a ms
                        "duration_ms": event["duration"] // 10000,
                        "char_offset": char_offset,
                        "char_len": len(sentence_text)
                    })
            break # Exito, salir del loop de reintentos
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"  [warn] Error en edge-tts (intento {attempt+1}/{max_retries}): {e}. Reintentando en {retry_delay}s...")
                import asyncio
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
            else:
                print(f"  [error] Fallo final en edge-tts despues de {max_retries} intentos: {e}")
                return

    # Guardar audio (MP3 de Edge-TTS — browsers lo reproducen nativamente)
    # Si ffmpeg esta disponible, convertir a Opus para menor tamanio.
    # Si no, guardar como MP3 directamente.
    ffmpeg_available = _check_ffmpeg()

    if ffmpeg_available:
        # Guardar MP3 temporal y convertir a Opus
        with open(mp3_path, "wb") as f:
            for chunk in audio_chunks:
                f.write(chunk)

        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(mp3_path),
             "-ac", "1", "-c:a", "libopus", "-b:a", AUDIO_BITRATE,
             "-application", "voip",
             str(opus_path)],
            capture_output=True, text=True
        )
        try:
            mp3_path.unlink()
        except:
            pass

        if result.returncode != 0:
            print(f"  [error] ffmpeg fallo: {result.stderr[-200:]}")
            # Fallback: guardar como MP3
            with open(mp3_path, "wb") as f:
                for chunk in audio_chunks:
                    f.write(chunk)
            # Renombrar como opus_path para uniformidad (usamos mp3 igual)
            opus_path = mp3_path
            print(f"  [warn] Guardando como MP3 en su lugar.")
        else:
            print(f"  [conv] Convertido a Opus OK.")
    else:
        # Sin ffmpeg: guardar directamente como MP3
        # Actualizar rutas para usar .mp3
        opus_path = AUDIO_DIR / f"{base_name}.mp3"
        with open(opus_path, "wb") as f:
            for chunk in audio_chunks:
                f.write(chunk)
        # Actualizar ts_path igual (el JSON sigue siendo .json)
        print(f"  [info] ffmpeg no disponible, guardando como MP3.")

    # Mapear word boundaries -> versiculos usando char_offset
    mapped_words = []
    for wb in word_boundaries:
        char_pos = wb.get("char_offset", 0)
        verse_num = 1  # default
        for vm in verse_map:
            if vm["char_start"] <= char_pos < vm["char_end"]:
                verse_num = vm["verse"]
                break

        mapped_words.append({
            "word": wb["word"],
            "verse": verse_num,
            "start_ms": wb["start_ms"],
            "end_ms": wb["start_ms"] + wb["duration_ms"],
            "duration_ms": wb["duration_ms"]
        })

    # Guardar timestamps
    actual_ext = opus_path.suffix  # .opus o .mp3 dependiendo de lo que se guardo
    timestamps_data = {
        "book": book_abbr,
        "chapter": chapter_num,
        "voice": VOICE,
        "audio_format": actual_ext.lstrip('.'),
        "verse_count": len(verses),
        "word_count": len(mapped_words),
        "verse_map": verse_map,
        "words": mapped_words
    }

    with open(ts_path, "w", encoding="utf-8") as f:
        json.dump(timestamps_data, f, ensure_ascii=False, indent=2)

    print(f"  [ok]   {base_name}.opus ({len(mapped_words)} palabras mapeadas)")


async def main_async(args):
    # Cargar bible.json
    if not DATA_FILE.exists():
        print(f"[ERROR] No encontrado: {DATA_FILE}")
        print("   Ejecuta primero: node scripts/parse_bible.js")
        sys.exit(1)

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        bible = json.load(f)

    books = bible["books"]

    # Filtrar por libro
    if args.all:
        target_books = books
    elif args.book:
        abbr_upper = args.book.upper()
        target_books = [b for b in books if b["abbr"] == abbr_upper]
        if not target_books:
            print(f"[ERROR] Libro '{args.book}' no encontrado. Abreviaciones disponibles:")
            print("  " + ", ".join(b["abbr"] for b in books))
            sys.exit(1)
    else:
        print("Usa --book GEN o --all")
        sys.exit(1)

    total_chapters = sum(len(b["chapters"]) for b in target_books)
    print(f"\n[Biblia TTS] Procesando {len(target_books)} libro(s), {total_chapters} capitulo(s)")
    print(f"   Voz: {VOICE}\n")

    for book in target_books:
        abbr = book["abbr"]
        print(f"\n[{abbr}] {book['name']} -- {len(book['chapters'])} capitulos")

        chapters = book["chapters"]
        if args.chapter:
            chapters = [c for c in chapters if c["number"] == args.chapter]
            if not chapters:
                print(f"  [warn] Capitulo {args.chapter} no encontrado en {book['name']}")
                continue

        for chapter in chapters:
            await generate_chapter_audio(abbr, chapter["number"], chapter["verses"])
            await asyncio.sleep(0.3)

    print(f"\n[LISTO] Audios en: {AUDIO_DIR}")
    print(f"   Timestamps en: {TIMESTAMPS_DIR}")


def main():
    global VOICE
    parser = argparse.ArgumentParser(
        description="Genera TTS para la Biblia usando Edge-TTS"
    )
    parser.add_argument("--book", type=str, help="Abreviacion del libro (ej: GEN, MAT)")
    parser.add_argument("--chapter", type=int, help="Numero de capitulo (opcional)")
    parser.add_argument("--all", action="store_true", help="Procesar todos los libros")
    parser.add_argument("--voice", type=str, default=VOICE,
                        help=f"Voz de Edge-TTS (default: {VOICE})")

    args = parser.parse_args()

    if args.voice and args.voice != VOICE:
        VOICE = args.voice

    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
