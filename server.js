/**
 * server.js — Servidor Express para la App Biblia
 *
 * Sirve la app web + archivos estáticos (audio, json).
 * Compatible con: Windows, Linux, macOS, Raspberry Pi, Android (Termux), VPS, etc.
 *
 * Uso:
 *   node server.js              → puerto 3000
 *   PORT=8080 node server.js    → puerto personalizado
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3005;
const HOST = process.env.HOST || '0.0.0.0'; // Escucha en todas las interfaces

// --- Rutas de archivos ---
const APP_DIR = path.join(__dirname, 'app');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const DATA_DIR = path.join(__dirname, 'data');

// --- Middleware ---
// Servir archivos estáticos de app/ (HTML, CSS, JS)
app.use(express.static(APP_DIR));

// Servir audio y timestamps desde app/public/
app.use('/public', express.static(PUBLIC_DIR));

// Servir bible.json desde data/
app.use('/data', express.static(DATA_DIR));

// --- API routes ---

// GET /api/status — Health check + info del servidor
app.get('/api/status', (req, res) => {
  const audioDir = path.join(PUBLIC_DIR, 'audio');
  const tsDir = path.join(PUBLIC_DIR, 'timestamps');
  const dataFile = path.join(DATA_DIR, 'bible.json');

  let audioCount = 0;
  let tsCount = 0;
  let booksCount = 0;

  try { audioCount = fs.readdirSync(audioDir).filter(f => f.endsWith('.opus')).length; } catch {}
  try { tsCount = fs.readdirSync(tsDir).filter(f => f.endsWith('.json')).length; } catch {}
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    booksCount = data.books?.length || 0;
  } catch {}

  res.json({
    status: 'ok',
    version: '1.0.0',
    translation: 'TLA Protestante',
    books_loaded: booksCount,
    audio_files: audioCount,
    timestamp_files: tsCount,
    node_version: process.version,
    platform: process.platform,
    uptime_s: Math.floor(process.uptime())
  });
});

// GET /api/books — Lista de libros (sin versículos, para el sidebar)
app.get('/api/books', (req, res) => {
  const dataFile = path.join(DATA_DIR, 'bible.json');
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    // Retornar solo metadatos, sin el texto de los versículos
    const books = data.books.map(b => ({
      id: b.id,
      name: b.name,
      abbr: b.abbr,
      testament: b.testament,
      group: b.group,
      chapterCount: b.chapterCount
    }));
    res.json({ books });
  } catch (err) {
    res.status(500).json({ error: 'bible.json no encontrado. Ejecuta: npm run parse' });
  }
});

// GET /api/book/:abbr — Capítulos de un libro (sin texto, solo metadatos)
app.get('/api/book/:abbr', (req, res) => {
  const dataFile = path.join(DATA_DIR, 'bible.json');
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const book = data.books.find(b => b.abbr === req.params.abbr.toUpperCase());
    if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

    const chapters = book.chapters.map(c => ({
      number: c.number,
      verseCount: c.verses.length,
      sections: c.sections || []
    }));
    res.json({ id: book.id, name: book.name, abbr: book.abbr, chapters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chapter/:abbr/:num — Versículos de un capítulo
app.get('/api/chapter/:abbr/:num', (req, res) => {
  const dataFile = path.join(DATA_DIR, 'bible.json');
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const book = data.books.find(b => b.abbr === req.params.abbr.toUpperCase());
    if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

    const chapNum = parseInt(req.params.num, 10);
    const chapter = book.chapters.find(c => c.number === chapNum);
    if (!chapter) return res.status(404).json({ error: 'Capítulo no encontrado' });

    // Verificar si tiene audio estándar y HQ
    const audioFile = `${book.abbr.toLowerCase()}_${String(chapNum).padStart(3, '0')}`;
    
    let audioPath = null;
    for (const ext of ['opus', 'mp3']) {
      if (fs.existsSync(path.join(PUBLIC_DIR, 'audio', book.abbr, `${audioFile}.${ext}`))) {
        audioPath = `/public/audio/${book.abbr}/${audioFile}.${ext}`;
        break;
      }
    }

    let audioHQPath = null;
    if (process.env.HQ_CDN_URL) {
      // Si hay un CDN/VPS configurado, asumimos que el archivo existe en formato opus
      // Ejemplo: HQ_CDN_URL="https://mi-vps.com" -> https://mi-vps.com/public/audio_hq/GEN/gen_001.opus
      audioHQPath = `${process.env.HQ_CDN_URL.replace(/\/$/, '')}/public/audio_hq/${book.abbr}/${audioFile}.opus`;
    } else {
      // Búsqueda local de HQ
      for (const ext of ['opus', 'mp3']) {
        if (fs.existsSync(path.join(PUBLIC_DIR, 'audio_hq', book.abbr, `${audioFile}.${ext}`))) {
          audioHQPath = `/public/audio_hq/${book.abbr}/${audioFile}.${ext}`;
          break;
        }
      }
    }

    const hasTimestamps = fs.existsSync(path.join(PUBLIC_DIR, 'timestamps', book.abbr, `${audioFile}.json`));

    res.json({
      book: { id: book.id, name: book.name, abbr: book.abbr },
      chapter: chapNum,
      sections: chapter.sections || [],
      verses: chapter.verses,
      audio: audioPath,
      audioHQ: audioHQPath,
      timestamps: hasTimestamps ? `/public/timestamps/${book.abbr}/${audioFile}.json` : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SPA fallback: todas las rutas no encontradas → index.html ---
app.get('*', (req, res) => {
  res.sendFile(path.join(APP_DIR, 'index.html'));
});

// --- Iniciar servidor ---
app.listen(PORT, HOST, () => {
  // Mostrar todas las IPs disponibles para acceso en red
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const [name, nets] of Object.entries(interfaces)) {
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ iface: name, ip: net.address });
      }
    }
  }

  console.log('\n📖 ════════════════════════════════════════');
  console.log('   Biblia TLA — Servidor iniciado');
  console.log('════════════════════════════════════════');
  console.log(`\n   Local:    http://localhost:${PORT}`);
  for (const addr of addresses) {
    console.log(`   Red (${addr.iface}): http://${addr.ip}:${PORT}`);
  }
  console.log('\n   Para acceder desde otro dispositivo en la');
  console.log('   misma red, usa la URL "Red" de arriba.');
  console.log('\n   Ctrl+C para detener.\n');
});
