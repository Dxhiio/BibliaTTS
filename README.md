# 📖 Biblia TLA — App Web con Audio Sincronizado

Aplicación web para leer y escuchar la Biblia completa (Traducción al Lenguaje Actual Protestante).  
Funciona como servidor local accesible desde cualquier dispositivo en la red.

---

## ⚡ Inicio rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Parsear el texto bíblico
```bash
npm run parse
```
Esto genera `data/bible.json` con los 66 libros, capítulos y versículos.

### 3. Instalar dependencias de Python (para TTS)
```bash
pip install edge-tts
```
Asegúrate de tener `ffmpeg` instalado y en el PATH:
- **Windows**: `winget install ffmpeg` o descargar de https://ffmpeg.org
- **Linux/Raspberry Pi**: `sudo apt install ffmpeg`
- **Termux (Android)**: `pkg install ffmpeg`

### 4. Generar audio de Génesis (demo)
```bash
npm run tts-genesis
```
Esto genera los 50 capítulos de Génesis como archivos `.opus` con timestamps.

### 5. Iniciar el servidor
```bash
npm start
```

Abre en el navegador: **http://localhost:3000**

Para acceder desde otro dispositivo en la misma red:  
**http://[IP-DEL-SERVIDOR]:3000**

---

## 🌐 Acceso desde red / otros dispositivos

Al iniciar, el servidor muestra las IPs disponibles:
```
Local:    http://localhost:3000
Red (eth0): http://192.168.1.10:3000
```

Para cambiar el puerto:
```bash
PORT=8080 npm start
```

---

## 🎙 Generar más audios

```bash
# Un libro específico
python scripts/generate_tts.py --book MAT

# Un capítulo específico
python scripts/generate_tts.py --book GEN --chapter 1

# Toda la Biblia (tarda ~3-4 horas)
npm run tts-all

# Voz femenina
python scripts/generate_tts.py --book GEN --voice es-MX-DaliaNeural

# Listar voces disponibles en español
python -c "import asyncio,edge_tts; voices=asyncio.run(edge_tts.list_voices()); [print(v['ShortName']) for v in voices if 'es-' in v['ShortName']]"
```

---

## 🗂 Estructura del proyecto

```
biblia/
├── app/                  ← App web
│   ├── index.html        ← SPA principal
│   ├── css/style.css     ← Estilos
│   ├── js/
│   │   ├── app.js        ← Entry point
│   │   ├── navigation.js ← Sidebar + routing
│   │   └── player.js     ← Reproductor + sync
│   └── public/
│       ├── audio/        ← Archivos .opus generados
│       └── timestamps/   ← Archivos .json de sync
├── content/              ← Epub original (fuente)
│   └── OEBPS/Text/       ← Archivos .xhtml
├── data/
│   └── bible.json        ← Biblia parseada
├── scripts/
│   ├── parse_bible.js    ← Parser xhtml → JSON
│   └── generate_tts.py   ← Generador TTS
├── server.js             ← Servidor Express
└── package.json
```

---

## ⌨️ Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `Espacio` | Play / Pausa |
| `→` | +10 segundos |
| `←` | −10 segundos |
| `M` | Silenciar / Activar |

---

## 🖥 Compatibilidad

- ✅ Windows (PC de escritorio / laptop)
- ✅ Linux (VPS, servidor casero)
- ✅ Raspberry Pi (3/4/5)
- ✅ Android con Termux
- ✅ macOS

**Requisitos mínimos:**
- Node.js v14+
- Python 3.8+
- ffmpeg

---

## 📻 Sobre el audio

- **Motor TTS**: Microsoft Edge TTS (gratuito, sin cuenta)
- **Voz por defecto**: `es-MX-JorgeNeural` (español latinoamericano neutro, masculino)
- **Alternativa femenina**: `es-MX-DaliaNeural`
- **Formato de audio**: Opus (~96kbps) — excelente calidad, tamaño reducido
- **Sincronización**: Word-boundary timestamps (nivel palabra → versículo)
