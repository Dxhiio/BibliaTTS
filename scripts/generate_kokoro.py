#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_kokoro.py
==================
Genera audio humanizado con Kokoro-ONNX para los primeros N capitulos
de la Biblia usando el archivo data/bible.json ya existente.

Requisitos:
  pip install kokoro-onnx soundfile numpy

Uso:
  python scripts/generate_kokoro.py --book GEN --chapters 5
  python scripts/generate_kokoro.py --book MAT --chapters 3 --voice if_sara
"""

import argparse
import json
import subprocess
import sys
import os
from pathlib import Path

# Forzar UTF-8 en consola de Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ── Rutas del proyecto ────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
BIBLE_JSON = PROJECT_ROOT / 'data' / 'bible.json'
AUDIO_DIR = PROJECT_ROOT / 'public' / 'audio'


def load_bible():
    print(f'Cargando {BIBLE_JSON.name}...')
    with open(BIBLE_JSON, 'r', encoding='utf-8') as f:
        return json.load(f)


def find_book(bible, abbr):
    abbr = abbr.upper()
    for book in bible['books']:
        if book['abbr'].upper() == abbr:
            return book
    return None


def chapter_to_text(chapter):
    """Convierte un capitulo del JSON a texto plano para TTS."""
    parts = []
    for verse in chapter['verses']:
        # Agregar el numero de versiculo con pausa natural (coma)
        parts.append(f"{verse['number']}, {verse['text']}")
    return ' '.join(parts)


# Instancia global del modelo (se carga una sola vez en memoria)
_kokoro_instance = None

def get_kokoro(device='cuda'):
    """Carga el modelo una sola vez y lo reutiliza en todos los capitulos."""
    global _kokoro_instance
    if _kokoro_instance is None:
        from kokoro_onnx import Kokoro
        if device == 'cuda':
            try:
                import onnxruntime as ort
                available = ort.get_available_providers()
                if 'CUDAExecutionProvider' in available:
                    print('Cargando modelo Kokoro en GPU (CUDA)...')
                    _kokoro_instance = Kokoro(
                        'kokoro-v1.0.onnx', 'voices-v1.0.bin',
                        providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
                    )
                else:
                    print('CUDA no disponible en onnxruntime, usando CPU...')
                    _kokoro_instance = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
            except Exception as e:
                print(f'Fallback a CPU: {e}')
                _kokoro_instance = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
        else:
            print('Cargando modelo Kokoro en CPU...')
            _kokoro_instance = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
        print('Modelo listo.')
    return _kokoro_instance



def generate_audio(text, output_wav, voice, speed, device='cuda'):
    """Genera WAV con Kokoro-ONNX usando GPU si esta disponible."""
    try:
        import soundfile as sf

        kokoro = get_kokoro(device)
        samples, sample_rate = kokoro.create(text, voice=voice, speed=speed, lang='es')

        sf.write(str(output_wav), samples, sample_rate)
        duration = len(samples) / sample_rate
        print(f'  OK  WAV: {output_wav.name} ({duration:.1f}s)')
        return True

    except ImportError as e:
        print(f'ERROR: {e}')
        print('Ejecuta: pip install kokoro-onnx soundfile numpy')
        sys.exit(1)
    except Exception as e:
        print(f'ERROR generando audio: {e}')
        return False


def wav_to_opus(wav_path, opus_path, bitrate='24k'):
    """Convierte WAV a OPUS con ffmpeg."""
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
        print(f'  OK  OPUS: {opus_path.name} ({size_kb:.0f} KB)')
        return True
    else:
        print(f'ERROR ffmpeg: {result.stderr[-200:]}')
        return False


def main():
    parser = argparse.ArgumentParser(description='Genera audio Kokoro TTS desde bible.json')
    parser.add_argument('--book', default='GEN',
                        help='Abreviatura del libro (GEN, MAT, JUA, etc.). Default: GEN')
    parser.add_argument('--chapters', type=int, default=5,
                        help='Numero de capitulos a generar desde el primero. Default: 5')
    parser.add_argument('--voice', default='im_nicola',
                        choices=['im_nicola', 'if_sara'],
                        help='Voz: im_nicola (masculina) o if_sara (femenina). Default: im_nicola')
    parser.add_argument('--speed', type=float, default=0.90,
                        help='Velocidad de lectura (0.8=lenta, 1.0=normal). Default: 0.90')
    parser.add_argument('--bitrate', default='24k',
                        help='Bitrate del archivo OPUS. Default: 24k')
    parser.add_argument('--device', default='cuda', choices=['cuda', 'cpu'],
                        help='Dispositivo de inferencia: cuda (GPU) o cpu. Default: cuda')
    args = parser.parse_args()

    # Verificar que existe bible.json
    if not BIBLE_JSON.exists():
        print(f'ERROR: No se encontro {BIBLE_JSON}')
        print('Asegurate de ejecutar este script desde la raiz del proyecto.')
        sys.exit(1)

    bible = load_bible()
    book = find_book(bible, args.book)

    if not book:
        available = [b['abbr'] for b in bible['books']]
        print(f'ERROR: Libro "{args.book}" no encontrado.')
        print(f'Libros disponibles: {", ".join(available)}')
        sys.exit(1)

    book_abbr = book['abbr']
    book_name = book['name']
    chapters = book['chapters'][:args.chapters]
    out_dir = AUDIO_DIR / book_abbr
    out_dir.mkdir(parents=True, exist_ok=True)

    print()
    print(f'Libro:    {book_name} ({book_abbr})')
    print(f'Capitulos a generar: {len(chapters)}')
    print(f'Voz:      {args.voice} | Velocidad: {args.speed}x | Bitrate: {args.bitrate}')
    print(f'Salida:   {out_dir}')
    print()

    ok_count = 0
    fail_count = 0

    for chapter in chapters:
        num = chapter['number']
        print(f'--- Capitulo {num} ({len(chapter["verses"])} versiculos) ---')

        file_stem = f'{book_abbr.lower()}_{num:03d}'
        opus_path = out_dir / f'{file_stem}.opus'

        if opus_path.exists():
            print(f'  SKIP {opus_path.name} (ya existe)')
            ok_count += 1
            continue

        text = chapter_to_text(chapter)
        wav_path = out_dir / f'{file_stem}.wav'

        if generate_audio(text, wav_path, args.voice, args.speed, args.device):
            if wav_to_opus(wav_path, opus_path, args.bitrate):
                ok_count += 1
            else:
                fail_count += 1
        else:
            fail_count += 1

    print()
    print('=' * 45)
    print(f'Generados: {ok_count} | Fallidos: {fail_count}')
    if ok_count > 0:
        print(f'Archivos en: {out_dir}')
        print()
        print('Siguiente paso: sube estos archivos a GitHub con:')
        print('  git add public/audio/')
        print(f'  git commit -m "audio: Kokoro TTS {book_abbr} cap 1-{len(chapters)}"')
        print('  git push origin main')


if __name__ == '__main__':
    main()
