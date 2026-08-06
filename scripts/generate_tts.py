#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_tts.py
Genera audio narrado para capitulos biblicos usando Microsoft Edge TTS.
Voz: es-MX-JorgeNeural (masculina, espanol latinoamericano neutro)
Salida: archivos .opus + .json de timestamps por capitulo

Uso:
  python generate_tts.py --version TLA --book GEN              # Solo Genesis
  python generate_tts.py --version RVR60 --book GEN --chapter 1  # Solo Genesis 1 RVR60
  python generate_tts.py --version RVR60 --all                   # Todos (toma horas)

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

SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent

def get_paths(version="TLA"):
    if version == "RVR60":
        return {
            "DATA_FILE": ROOT_DIR / "data" / "rvr60.json",
            "AUDIO_DIR": ROOT_DIR / "app" / "public" / "audio_rvr60",
            "TIMESTAMPS_DIR": ROOT_DIR / "app" / "public" / "timestamps_rvr60",
            "BITRATE": "12k"  # Extra compresion
        }
    else:
        return {
            "DATA_FILE": ROOT_DIR / "data" / "bible.json",
            "AUDIO_DIR": ROOT_DIR / "app" / "public" / "audio",
            "TIMESTAMPS_DIR": ROOT_DIR / "app" / "public" / "timestamps",
            "BITRATE": "16k"
        }



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

async def convert_mp3_to_opus(mp3_path: Path, opus_path: Path, bitrate="16k"):
    """
    Convierte un MP3 a OPUS usando FFmpeg para maxima compresion.
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(mp3_path),
        "-ac", "1",
        "-c:a", "libopus",
        "-b:a", bitrate,
        "-vbr", "on",
        "-compression_level", "10",
        "-application", "voip",
        str(opus_path)
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await proc.communicate()
    except Exception as e:
        print(f"Error ffmpeg: {e}")


async def generate_chapter_audio(book_abbr: str, chapter_num: int, verses: list, paths: dict):
    """
    Genera audio + timestamps para un capitulo.
    Guarda: audio/<book_abbr>/<abbr>_<num>.opus (o .mp3 si no hay ffmpeg) + timestamps/<book_abbr>/<abbr>_<num>.json
    """
    base_name = get_audio_filename(book_abbr, chapter_num)
    
    # Crear subcarpetas para el libro
    book_audio_dir = paths["AUDIO_DIR"] / book_abbr
    book_ts_dir = paths["TIMESTAMPS_DIR"] / book_abbr
    book_audio_dir.mkdir(parents=True, exist_ok=True)
    book_ts_dir.mkdir(parents=True, exist_ok=True)
    
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
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)

            audio_chunks = []
            word_boundaries = []
            current_char_offset = 0

            async for event in communicate.stream():
                if event["type"] == "audio":
                    audio_chunks.append(event["data"])
                elif event["type"] == "SentenceBoundary":
                    sentence_text = event["text"]
                    idx = text[current_char_offset:].find(sentence_text)
                    if idx != -1:
                        char_offset = current_char_offset + idx
                        current_char_offset = char_offset + len(sentence_text)
                    else:
                        char_offset = current_char_offset
                        
                    word_boundaries.append({
                        "word": sentence_text,
                        "start_ms": event["offset"] // 10000,
                        "duration_ms": event["duration"] // 10000,
                        "char_offset": char_offset,
                        "char_len": len(sentence_text)
                    })
            break 
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
            else:
                return

    ffmpeg_available = _check_ffmpeg()
    if ffmpeg_available:
        with open(mp3_path, "wb") as f:
            for chunk in audio_chunks:
                f.write(chunk)
        print(f"[{book_abbr} {chapter_num}] Convirtiendo a OPUS ({paths['BITRATE']})...")
        await convert_mp3_to_opus(mp3_path, opus_path, paths['BITRATE'])
        try:
            mp3_path.unlink()
        except:
            pass
    else:
        with open(mp3_path, "wb") as f:
            for chunk in audio_chunks:
                f.write(chunk)
        opus_path = mp3_path
        print(f"  [info] ffmpeg no disponible, guardando como MP3.")

    mapped_words = []
    for wb in word_boundaries:
        char_pos = wb.get("char_offset", 0)
        verse_num = 1
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

    timestamps_data = {
        "book": book_abbr,
        "chapter": chapter_num,
        "voice": VOICE,
        "audio_format": opus_path.suffix.lstrip('.'),
        "verse_count": len(verses),
        "word_count": len(mapped_words),
        "verse_map": verse_map,
        "words": mapped_words
    }

    with open(ts_path, "w", encoding="utf-8") as f:
        json.dump(timestamps_data, f, ensure_ascii=False, indent=2)

    print(f"  [ok]   {base_name}{opus_path.suffix} ({len(mapped_words)} palabras mapeadas)")


async def process_books(books_to_process, paths):
    for book, chapter_filter in books_to_process:
        abbr = book["abbr"]
        print(f"\n[{abbr}] {book['name']}")
        chapters = book["chapters"]
        if chapter_filter:
            chapters = [c for c in chapters if c["number"] == chapter_filter]
        
        for chapter in chapters:
            await generate_chapter_audio(abbr, chapter["number"], chapter["verses"], paths)
            await asyncio.sleep(0.3)

async def main_async(args):
    paths = get_paths(args.version)
    
    if not paths["DATA_FILE"].exists():
        print(f"[ERROR] No se encuentra {paths['DATA_FILE']}")
        sys.exit(1)
        
    with open(paths["DATA_FILE"], "r", encoding="utf-8") as f:
        bible_data = json.load(f)
        
    books = bible_data["books"]
    
    if args.all:
        target_books = books
    elif args.book:
        abbr_upper = args.book.upper()
        target_books = [b for b in books if b["abbr"] == abbr_upper]
        if not target_books:
            print(f"[ERROR] Libro '{args.book}' no encontrado.")
            sys.exit(1)
    else:
        print("[ERROR] Usa --book GEN o --all")
        sys.exit(1)
        
    books_to_process = []
    for b in target_books:
        books_to_process.append((b, args.chapter if args.chapter else None))
        
    print(f"\n[Biblia TTS] Procesando {len(target_books)} libro(s)")
    await process_books(books_to_process, paths)

def main():
    global VOICE
    parser = argparse.ArgumentParser(description="Generador de TTS Bíblico")
    parser.add_argument("--version", type=str, default="TLA", choices=["TLA", "RVR60"], help="Versión de la Biblia (TLA o RVR60)")
    parser.add_argument("--book", type=str, help="Abreviatura del libro (ej. GEN, EXO)")
    parser.add_argument("--chapter", type=int, help="Numero de capitulo (opcional, si no se procesa todo el libro)")
    parser.add_argument("--all", action="store_true", help="Procesar TODA la biblia (cuidado, toma mucho tiempo)")
    parser.add_argument("--voice", type=str, default=VOICE, help=f"Voz de Edge-TTS (default: {VOICE})")
    
    args = parser.parse_args()
    if args.voice and args.voice != VOICE:
        VOICE = args.voice
        
    asyncio.run(main_async(args))

if __name__ == "__main__":
    main()
