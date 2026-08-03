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
AUDIO_DIR = PROJECT_ROOT / 'public' / 'audio'

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

def numero_a_letras(num):
    unidades = [
        "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
        "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
        "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis",
        "veintisiete", "veintiocho", "veintinueve"
    ]
    decenas = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
    if num < 30:
        return unidades[num].capitalize()
    elif num < 100:
        dec, uni = divmod(num, 10)
        return decenas[dec].capitalize() if uni == 0 else f"{decenas[dec]} y {unidades[uni]}".capitalize()
    elif num == 100:
        return "Cien"
    elif num < 200:
        return f"Ciento {numero_a_letras(num - 100).lower()}".capitalize()
    return str(num)

# ─────────────────────────────────────────────────────────────────────────────
# Worker de compresión asíncrona en CPU (no bloquea el bucle de la GPU)
# ─────────────────────────────────────────────────────────────────────────────
import concurrent.futures
import os

executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(2, os.cpu_count() // 2))

def compress_async_worker(temp_wav, opus_path, audio_chunks, sample_rate, book_abbr, chapter_num):
    try:
        import numpy as np
        import soundfile as sf
        full_audio = np.concatenate(audio_chunks)
        sf.write(str(temp_wav), full_audio, sample_rate)
        if wav_to_opus(temp_wav, opus_path):
            print(f'  ✓ [{book_abbr} {chapter_num}] Guardado y comprimido a OPUS en segundo plano.', flush=True)
        else:
            print(f'  ❌ Falló compresión de [{book_abbr} {chapter_num}]', flush=True)
    except Exception as e:
        print(f'  ❌ Error en worker asíncrono de [{book_abbr} {chapter_num}]: {e}', flush=True)

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
        
    books = bible['books']
    total_chapters = sum(len(b['chapters']) for b in books)

    # 3. Cargar el modelo en GPU UNA VEZ y activar Tensor Cores
    import torch
    import numpy as np
    import soundfile as sf
    
    if torch.cuda.is_available():
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cudnn.benchmark = True

    model = load_qwen_model(args.model)

    print('⚡ Pre-calculando embedding y prompt de voz en VRAM (Artur Mas)...', flush=True)
    prompt_items = model.create_voice_clone_prompt(ref_audio=str(ref_wav), ref_text=ref_text)

    print(f'\n🚀 Iniciando síntesis masiva asíncrona para TODA LA BIBLIA ({len(books)} libros, {total_chapters} capítulos)...', flush=True)
    
    chapters_done = 0
    for book in books:
        abbr = book['abbr']
        book_dir = AUDIO_DIR / abbr
        book_dir.mkdir(parents=True, exist_ok=True)
        
        for chapter in book['chapters']:
            num = chapter['number']
            chapters_done += 1
            
            file_stem = f'{abbr.lower()}_{num:03d}'
            temp_wav = book_dir / f'{file_stem}.wav'
            opus_path = book_dir / f'{file_stem}.opus'
            
            # Salto instantáneo si ya existe (>10 KB) para permitir reanudación sin perder tiempo
            if opus_path.exists() and opus_path.stat().st_size > 10000:
                print(f'[{chapters_done}/{total_chapters}] ⏩ Saltando {abbr} {num:03d} (Ya existe en disco)', flush=True)
                continue
                
            verses = chapter['verses']
            print(f'\n[{chapters_done}/{total_chapters}] --- Generando {abbr} Capítulo {num} ({len(verses)} versículos) ---', flush=True)
            
            audio_chunks = []
            sample_rate = 24000
            
            verses_per_seq = 2
            gpu_batch_size = 4
            
            sequences = []
            for i in range(0, len(verses), verses_per_seq):
                sub = verses[i:i + verses_per_seq]
                seq_text = ' '.join([f"{numero_a_letras(v['number'])}. {v['text']}" for v in sub])
                sequences.append(seq_text)
                
            for i in range(0, len(sequences), gpu_batch_size):
                batch_list = sequences[i:i + gpu_batch_size]
                try:
                    with torch.inference_mode():
                        wavs, sr = model.generate_voice_clone(
                            text=batch_list,
                            language="Spanish",
                            voice_clone_prompt=prompt_items
                        )
                    audio_chunks.extend(wavs)
                    sample_rate = sr
                except Exception as e:
                    print(f'    ⚠️ Error en lote GPU ({abbr} {num}): {e}', flush=True)
                    try:
                        import gc
                        gc.collect()
                        torch.cuda.empty_cache()
                    except: pass
                    for text_single in batch_list:
                        try:
                            with torch.inference_mode():
                                w, sr = model.generate_voice_clone(text=text_single, language="Spanish", voice_clone_prompt=prompt_items)
                                audio_chunks.extend(w)
                        except Exception as e_single:
                            print(f'    ❌ Fallo en versículo individual ({abbr} {num}): {e_single}', flush=True)
                            try:
                                gc.collect()
                                torch.cuda.empty_cache()
                            except: pass
                
                # Limpieza proactiva de VRAM después de cada lote para evitar fragmentación y OOM en ejecuciones largas
                try:
                    import gc
                    gc.collect()
                    torch.cuda.empty_cache()
                except: pass
                    
            if audio_chunks:
                # Enviar codificación de audio al pool de hilos del CPU para no frenar a la GPU
                executor.submit(compress_async_worker, temp_wav, opus_path, audio_chunks, sample_rate, abbr, num)
            else:
                print(f'  ❌ No se pudo generar audio para {abbr} {num}.', flush=True)
                
    print('\nEsperando a que terminen las últimas codificaciones de audio en segundo plano...', flush=True)
    executor.shutdown(wait=True)
    print('\n¡PROCESO FINALIZADO! Toda la Biblia ha sido sintetizada a máxima potencia y comprimida a OPUS.', flush=True)


if __name__ == '__main__':
    main()

