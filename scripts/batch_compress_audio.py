#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
batch_compress_audio.py
Re-comprime todos los archivos .opus existentes en app/public/audio/
a 16 kbps mono Opus (-application voip) para máxima compresión y ahorro de espacio.
"""

import os
import sys
import time
import subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Forzar UTF-8 en stdout para Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
AUDIO_DIR = ROOT_DIR / "app" / "public" / "audio"
TARGET_BITRATE = "16k"

def compress_file(opus_path: Path) -> tuple:
    tmp_path = opus_path.with_suffix(".tmp.opus")
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-i", str(opus_path),
        "-ac", "1",
        "-c:a", "libopus",
        "-b:a", TARGET_BITRATE,
        "-application", "voip",
        str(tmp_path)
    ]
    try:
        orig_size = opus_path.stat().st_size
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and tmp_path.exists() and tmp_path.stat().st_size > 0:
            new_size = tmp_path.stat().st_size
            tmp_path.replace(opus_path)
            return True, orig_size, new_size, opus_path.name
        else:
            if tmp_path.exists():
                tmp_path.unlink(missing_ok=True)
            return False, orig_size, orig_size, f"{opus_path.name} (error ffmpeg: {res.stderr})"
    except Exception as e:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        return False, 0, 0, f"{opus_path.name} (exc: {e})"

def main():
    print(f"[*] Buscando archivos .opus en {AUDIO_DIR} ...")
    files = list(AUDIO_DIR.rglob("*.opus"))
    files = [f for f in files if not f.name.endswith(".tmp.opus")]
    
    total_files = len(files)
    if total_files == 0:
        print("[!] No se encontraron archivos .opus para comprimir.")
        return

    print(f"[*] Encontrados {total_files} audios. Comprimiendo a {TARGET_BITRATE} mono en paralelo...")
    start_time = time.time()
    
    workers = min(32, (os.cpu_count() or 4) * 2)
    success_count = 0
    fail_count = 0
    total_orig_bytes = 0
    total_new_bytes = 0

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(compress_file, f): f for f in files}
        for i, fut in enumerate(as_completed(futures), 1):
            ok, orig_b, new_b, msg = fut.result()
            total_orig_bytes += orig_b
            total_new_bytes += new_b
            if ok:
                success_count += 1
            else:
                fail_count += 1
            
            if i % 50 == 0 or i == total_files:
                elapsed = time.time() - start_time
                saved_mb = (total_orig_bytes - total_new_bytes) / (1024 * 1024)
                print(f"  [{i}/{total_files}] OK: {success_count} | Fallos: {fail_count} | Ahorrado: {saved_mb:.1f} MB | Tiempo: {elapsed:.1f}s")

    orig_mb = total_orig_bytes / (1024 * 1024)
    new_mb = total_new_bytes / (1024 * 1024)
    reduction = (1 - (total_new_bytes / (total_orig_bytes or 1))) * 100
    
    print("\n--- RESUMEN DE COMPRESIÓN ---")
    print(f"Total procesados : {total_files}")
    print(f"Exitosos         : {success_count}")
    print(f"Fallidos         : {fail_count}")
    print(f"Tamaño original  : {orig_mb:.2f} MB")
    print(f"Nuevo tamaño     : {new_mb:.2f} MB")
    print(f"Reducción total  : {reduction:.1f}% (-{orig_mb - new_mb:.2f} MB)")
    print(f"Tiempo total     : {time.time() - start_time:.1f} segundos")

if __name__ == "__main__":
    main()
