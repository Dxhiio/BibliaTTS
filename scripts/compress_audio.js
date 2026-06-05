const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const AUDIO_HQ_DIR = path.join(__dirname, '../app/public/audio_hq');
const AUDIO_STD_DIR = path.join(__dirname, '../app/public/audio');

// Concurrency limit for ffmpeg
const MAX_CONCURRENT = 4;

async function compressAll() {
  if (!fs.existsSync(AUDIO_HQ_DIR)) {
    console.error(`ERROR: No existe la carpeta ${AUDIO_HQ_DIR}`);
    return;
  }

  if (!fs.existsSync(AUDIO_STD_DIR)) {
    fs.mkdirSync(AUDIO_STD_DIR, { recursive: true });
  }

  // Recopilar todos los archivos
  const tasks = [];
  const books = fs.readdirSync(AUDIO_HQ_DIR);

  for (const book of books) {
    const bookPathHQ = path.join(AUDIO_HQ_DIR, book);
    if (!fs.statSync(bookPathHQ).isDirectory()) continue;

    const bookPathStd = path.join(AUDIO_STD_DIR, book);
    if (!fs.existsSync(bookPathStd)) {
      fs.mkdirSync(bookPathStd, { recursive: true });
    }

    const files = fs.readdirSync(bookPathHQ).filter(f => f.endsWith('.opus'));
    for (const file of files) {
      const input = path.join(bookPathHQ, file);
      const output = path.join(bookPathStd, file);
      
      // Si ya existe y pesa algo, lo saltamos (resumible)
      if (fs.existsSync(output) && fs.statSync(output).size > 0) {
        continue;
      }

      tasks.push({ input, output, name: `${book}/${file}` });
    }
  }

  console.log(`[COMPRESS] Encontrados ${tasks.length} archivos para comprimir a 32kbps.`);

  let activeCount = 0;
  let currentIndex = 0;
  let completed = 0;
  const total = tasks.length;

  if (total === 0) {
    console.log('[COMPRESS] Todo está ya comprimido.');
    return;
  }

  return new Promise((resolve) => {
    function startNext() {
      if (currentIndex >= total && activeCount === 0) {
        console.log('\n[COMPRESS] ¡Compresión finalizada con éxito!');
        resolve();
        return;
      }

      while (activeCount < MAX_CONCURRENT && currentIndex < total) {
        const task = tasks[currentIndex++];
        activeCount++;

        // Compress using ffmpeg:
        // -c:a libopus -b:a 32k -vbr on -compression_level 10
        const args = [
          '-y',
          '-i', task.input,
          '-c:a', 'libopus',
          '-b:a', '32k',
          '-vbr', 'on',
          '-compression_level', '10',
          task.output
        ];

        const proc = spawn('ffmpeg', args, { stdio: 'ignore' });

        proc.on('close', (code) => {
          activeCount--;
          completed++;
          process.stdout.write(`\r[COMPRESS] Progreso: ${completed}/${total} (Faltan ${total - completed}) - Último: ${task.name}                `);
          
          if (code !== 0) {
            console.error(`\n[ERROR] Falló la compresión de ${task.name}`);
            // Eliminar archivo corrupto si existe
            if (fs.existsSync(task.output)) fs.unlinkSync(task.output);
          }
          
          startNext();
        });
      }
    }

    startNext();
  });
}

compressAll().catch(console.error);
