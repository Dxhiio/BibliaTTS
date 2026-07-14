const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

// Crear directorio dist si no existe
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Función para copiar directorios y archivos de forma recursiva (compatible Node 16+)
function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach(element => {
    if (fs.lstatSync(path.join(from, element)).isFile()) {
      fs.copyFileSync(path.join(from, element), path.join(to, element));
    } else {
      copyFolderSync(path.join(from, element), path.join(to, element));
    }
  });
}

console.log('Empaquetando aplicación estática en dist/ (Multiplataforma Node.js)...');

// Copiar app/* a dist/
copyFolderSync(path.join(__dirname, '..', 'app'), distDir);

// Copiar data a dist/data
copyFolderSync(path.join(__dirname, '..', 'data'), path.join(distDir, 'data'));

// Copiar public/* a dist/
copyFolderSync(path.join(__dirname, '..', 'public'), distDir);

console.log('✅ Build estático completado con éxito.');
