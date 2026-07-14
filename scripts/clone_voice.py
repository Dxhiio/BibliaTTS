#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
clone_voice.py
==============
Clona una voz de referencia (ej: Artur Mas de YouTube) usando Qwen3-TTS
y genera los audios de los capítulos 1 al 5 de Génesis para la app.

Requisitos previos:
  pip install yt-dlp qwen-tts SpeechRecognition soundfile numpy
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Forzar UTF-8 en consola de Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ── Configuración de Rutas ───────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / 'data'
BIBLE_JSON = DATA_DIR / 'bible.json'
AUDIO_DIR = PROJECT_ROOT / 'public' / 'audio' / 'GEN'

DATA_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# 1. Descarga y extracción de audio desde YouTube
# ─────────────────────────────────────────────────────────────────────────────
def download_youtube_audio(url, output_wav):
    """Descarga el audio de YouTube y lo guarda como WAV mono a 24000Hz (óptimo para TTS)."""
    print(f'Descargando audio de YouTube: {url}...')
    temp_opus = DATA_DIR / 'temp_audio.opus'
    
    # 1. Descargar con yt-dlp
    cmd_download = [
        sys.executable, '-m', 'yt_dlp',
        '-x', '--audio-format', 'opus',
        '-o', str(temp_opus.with_suffix('')), # yt-dlp añade la extensión
        url
    ]
    
    result = subprocess.run(cmd_download, capture_output=True, text=True)
    if result.returncode != 0:
        print(f'ERROR descargando de YouTube: {result.stderr}')
        return False

    temp_opus_real = temp_opus.with_suffix('.opus')
    
    # 2. Recortar 15 segundos limpios (segundo 25 al 40) y exportar a WAV 24000Hz mono
    print('Recortando 15 segundos del audio de referencia (segundos 25 al 40)...')
    cmd_ffmpeg = [
        'ffmpeg', '-y',
        '-ss', '25', '-to', '40',
        '-i', str(temp_opus_real),
        '-ar', '24000', '-ac', '1',
        str(output_wav)
    ]
    
    result_ffmpeg = subprocess.run(cmd_ffmpeg, capture_output=True, text=True)
    
    # Limpiar temp
    if temp_opus_real.exists():
        temp_opus_real.unlink()
        
    if result_ffmpeg.returncode == 0 and output_wav.exists():
        print(f'Audio de referencia guardado en: {output_wav}')
        return True
    else:
        print(f'ERROR procesando ffmpeg: {result_ffmpeg.stderr}')
        return False

# ─────────────────────────────────────────────────────────────────────────────
# 2. Transcripción automática (requerida por Qwen3-TTS)
# ─────────────────────────────────────────────────────────────────────────────
def transcribe_audio(wav_path):
    """Transcribe el WAV usando la API gratuita de Google Web Speech."""
    print('Transcribiendo el audio de referencia de forma automática...')
    try:
        import speech_recognition as sr
        
        r = sr.Recognizer()
        with sr.AudioFile(str(wav_path)) as source:
            audio = r.record(source)
            
        text = r.recognize_google(audio, language='es-ES')
        print(f'Transcripción obtenida: "{text}"')
        return text
    except ImportError:
        print('Instalando SpeechRecognition de forma rápida...')
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'SpeechRecognition'], capture_output=True)
        return transcribe_audio(wav_path)
    except Exception as e:
        print(f'No se pudo transcribir automáticamente ({e}).')
        # Fallback manual aproximado por las declaraciones de Artur Mas
        fallback_text = "Hay que ir a una confrontación inteligente con el Estado, no a cualquier confrontación que debilite la posición catalana."
        print(f'Usando transcripción por defecto: "{fallback_text}"')
        return fallback_text

# ─────────────────────────────────────────────────────────────────────────────
# 3. Generación con Qwen3-TTS
# ─────────────────────────────────────────────────────────────────────────────
def load_qwen_model(model_name="Qwen/Qwen3-TTS-12Hz-0.6B-Base"):
    """Carga Qwen3-TTS en CUDA usando bfloat16 una sola vez."""
    import torch
    from qwen_tts import Qwen3TTSModel
    
    has_cuda = torch.cuda.is_available()
    device = "cuda:0" if has_cuda else "cpu"
    dtype = torch.bfloat16 if has_cuda else torch.float32
    
    print(f'Cargando modelo Qwen3-TTS ({model_name}) en {device.upper()} con {dtype}...')
    model = Qwen3TTSModel.from_pretrained(model_name, device_map=device, dtype=dtype)
    print('✅ Modelo Qwen3-TTS listo en memoria.')
    return model

# ─────────────────────────────────────────────────────────────────────────────
# 4. Compresión a OPUS
# ─────────────────────────────────────────────────────────────────────────────
def wav_to_opus(wav_path, opus_path, bitrate='24k'):
    """Convierte WAV a OPUS con ffmpeg."""
    result = subprocess.run(
        ['ffmpeg', '-y', '-i', str(wav_path),
         '-c:a', 'libopus', '-b:a', bitrate, '-ac', '1',
         str(opus_path)],
        capture_output=True, text=True
    )
    wav_path.unlink(missing_ok=True)
    return result.returncode == 0

# ─────────────────────────────────────────────────────────────────────────────
# Main Flow
# ─────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Clonador de voz con Qwen3-TTS para la Biblia')
    parser.add_argument('--url', default='https://www.youtube.com/watch?v=glnykcSDHFc',
                        help='URL del video de YouTube de referencia')
    parser.add_argument('--model', default='Qwen/Qwen3-TTS-12Hz-0.6B-Base',
                        choices=['Qwen/Qwen3-TTS-12Hz-0.6B-Base', 'Qwen/Qwen3-TTS-12Hz-1.7B-Base'],
                        help='Modelo de Qwen3-TTS a utilizar (1.7B tiene mayor calidad pero consume más VRAM)')
    args = parser.parse_args()

    ref_wav = DATA_DIR / 'reference_voice.wav'
    
    # 1. Obtener audio de referencia
    if not ref_wav.exists():
        ok = download_youtube_audio(args.url, ref_wav)
        if not ok:
            print('No se pudo obtener el audio de referencia.')
            sys.exit(1)
            
    ref_text = transcribe_audio(ref_wav)
    
    # 2. Cargar la biblia
    if not BIBLE_JSON.exists():
        print(f'ERROR: No se encontró {BIBLE_JSON.name}.')
        sys.exit(1)
        
    with open(BIBLE_JSON, 'r', encoding='utf-8') as f:
        bible = json.load(f)
        
    gen_book = next(b for b in bible['books'] if b['abbr'] == 'GEN')
    chapters = gen_book['chapters'][:5] # Los primeros 5 capítulos

    # 3. Cargar el modelo en GPU UNA VEZ
    model = load_qwen_model(args.model)
    import numpy as np
    import soundfile as sf

    print(f'\nIniciando clonación rápida por bloques para los primeros 5 capítulos de Génesis...')
    
    for chapter in chapters:
        num = chapter['number']
        verses = chapter['verses']
        print(f'\n--- Generando Capítulo {num} ({len(verses)} versículos en lotes rápidos) ---')
        
        file_stem = f'gen_{num:03d}'
        temp_wav = AUDIO_DIR / f'{file_stem}.wav'
        opus_path = AUDIO_DIR / f'{file_stem}.opus'
        
        if opus_path.exists():
            opus_path.unlink()
            
        audio_chunks = []
        sample_rate = 24000
        
        # Agrupar de 4 en 4 versículos para que la GPU procese cada bloque en ~2 segundos
        batch_size = 4
        for i in range(0, len(verses), batch_size):
            batch = verses[i:i + batch_size]
            batch_text = ' '.join([f"{v['number']}, {v['text']}" for v in batch])
            print(f'  [Lote {i//batch_size + 1}/{(len(verses) + batch_size - 1)//batch_size}] Versículos {batch[0]["number"]}-{batch[-1]["number"]}...')
            try:
                wavs, sr = model.generate_voice_clone(
                    text=batch_text,
                    language="Spanish",
                    ref_audio=str(ref_wav),
                    ref_text=ref_text
                )
                audio_chunks.append(wavs[0])
                sample_rate = sr
            except Exception as e:
                print(f'    ⚠️ Error en lote: {e}')
                
        if audio_chunks:
            full_audio = np.concatenate(audio_chunks)
            sf.write(str(temp_wav), full_audio, sample_rate)
            print('  Comprimiendo a OPUS...')
            if wav_to_opus(temp_wav, opus_path):
                print(f'  ✓ Capítulo {num} generado y reemplazado con éxito.')
            else:
                print(f'  ❌ Falló compresión de capítulo {num}')
        else:
            print(f'  ❌ No se pudo generar audio para el capítulo {num}.')
            
    print('\n¡Proceso finalizado! Todos los archivos OPUS están listos en public/audio/GEN/.')


if __name__ == '__main__':
    main()

