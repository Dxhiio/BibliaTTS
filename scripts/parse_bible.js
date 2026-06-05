#!/usr/bin/env node
/**
 * parse_bible.js
 * Convierte los archivos Section00XX.xhtml del epub de la TLA
 * en un bible.json estructurado con libros, capítulos y versículos.
 *
 * Uso: node parse_bible.js
 * Salida: ../data/bible.json
 */

const fs = require('fs');
const path = require('path');

// Mapeo de archivo → metadatos del libro
const BOOK_MAP = [
  { file: 'Section0001', id: 1,  name: 'Génesis',               abbr: 'GEN', testament: 'AT', group: 'Pentateuco' },
  { file: 'Section0002', id: 2,  name: 'Éxodo',                 abbr: 'EXO', testament: 'AT', group: 'Pentateuco' },
  { file: 'Section0003', id: 3,  name: 'Levítico',              abbr: 'LEV', testament: 'AT', group: 'Pentateuco' },
  { file: 'Section0004', id: 4,  name: 'Números',               abbr: 'NUM', testament: 'AT', group: 'Pentateuco' },
  { file: 'Section0005', id: 5,  name: 'Deuteronomio',          abbr: 'DEU', testament: 'AT', group: 'Pentateuco' },
  { file: 'Section0006', id: 6,  name: 'Josué',                 abbr: 'JOS', testament: 'AT', group: 'Históricos' },
  { file: 'Section0007', id: 7,  name: 'Jueces',                abbr: 'JUE', testament: 'AT', group: 'Históricos' },
  { file: 'Section0008', id: 8,  name: 'Rut',                   abbr: 'RUT', testament: 'AT', group: 'Históricos' },
  { file: 'Section0009', id: 9,  name: '1 Samuel',              abbr: '1SA', testament: 'AT', group: 'Históricos' },
  { file: 'Section0010', id: 10, name: '2 Samuel',              abbr: '2SA', testament: 'AT', group: 'Históricos' },
  { file: 'Section0011', id: 11, name: '1 Reyes',               abbr: '1RE', testament: 'AT', group: 'Históricos' },
  { file: 'Section0012', id: 12, name: '2 Reyes',               abbr: '2RE', testament: 'AT', group: 'Históricos' },
  { file: 'Section0013', id: 13, name: '1 Crónicas',            abbr: '1CR', testament: 'AT', group: 'Históricos' },
  { file: 'Section0014', id: 14, name: '2 Crónicas',            abbr: '2CR', testament: 'AT', group: 'Históricos' },
  { file: 'Section0015', id: 15, name: 'Esdras',                abbr: 'ESD', testament: 'AT', group: 'Históricos' },
  { file: 'Section0016', id: 16, name: 'Nehemías',              abbr: 'NEH', testament: 'AT', group: 'Históricos' },
  { file: 'Section0017', id: 17, name: 'Ester',                 abbr: 'EST', testament: 'AT', group: 'Históricos' },
  { file: 'Section0018', id: 18, name: 'Job',                   abbr: 'JOB', testament: 'AT', group: 'Sapienciales' },
  { file: 'Section0019', id: 19, name: 'Salmos',                abbr: 'SAL', testament: 'AT', group: 'Sapienciales' },
  { file: 'Section0020', id: 20, name: 'Proverbios',            abbr: 'PRO', testament: 'AT', group: 'Sapienciales' },
  { file: 'Section0021', id: 21, name: 'Eclesiastés',           abbr: 'ECL', testament: 'AT', group: 'Sapienciales' },
  { file: 'Section0022', id: 22, name: 'Cantar de los Cantares',abbr: 'CAN', testament: 'AT', group: 'Sapienciales' },
  { file: 'Section0023', id: 23, name: 'Isaías',                abbr: 'ISA', testament: 'AT', group: 'Profetas Mayores' },
  { file: 'Section0024', id: 24, name: 'Jeremías',              abbr: 'JER', testament: 'AT', group: 'Profetas Mayores' },
  { file: 'Section0025', id: 25, name: 'Lamentaciones',         abbr: 'LAM', testament: 'AT', group: 'Profetas Mayores' },
  { file: 'Section0026', id: 26, name: 'Ezequiel',              abbr: 'EZE', testament: 'AT', group: 'Profetas Mayores' },
  { file: 'Section0027', id: 27, name: 'Daniel',                abbr: 'DAN', testament: 'AT', group: 'Profetas Mayores' },
  { file: 'Section0028', id: 28, name: 'Oseas',                 abbr: 'OSE', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0029', id: 29, name: 'Joel',                  abbr: 'JOE', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0030', id: 30, name: 'Amós',                  abbr: 'AMO', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0031', id: 31, name: 'Abdías',                abbr: 'ABD', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0032', id: 32, name: 'Jonás',                 abbr: 'JON', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0033', id: 33, name: 'Miqueas',               abbr: 'MIQ', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0034', id: 34, name: 'Nahum',                 abbr: 'NAH', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0035', id: 35, name: 'Habacuc',               abbr: 'HAB', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0036', id: 36, name: 'Sofonías',              abbr: 'SOF', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0037', id: 37, name: 'Hageo',                 abbr: 'HAG', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0038', id: 38, name: 'Zacarías',              abbr: 'ZAC', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0039', id: 39, name: 'Malaquías',             abbr: 'MAL', testament: 'AT', group: 'Profetas Menores' },
  { file: 'Section0040', id: 40, name: 'Mateo',                 abbr: 'MAT', testament: 'NT', group: 'Evangelios' },
  { file: 'Section0041', id: 41, name: 'Marcos',                abbr: 'MAR', testament: 'NT', group: 'Evangelios' },
  { file: 'Section0042', id: 42, name: 'Lucas',                 abbr: 'LUC', testament: 'NT', group: 'Evangelios' },
  { file: 'Section0043', id: 43, name: 'Juan',                  abbr: 'JUA', testament: 'NT', group: 'Evangelios' },
  { file: 'Section0044', id: 44, name: 'Hechos',                abbr: 'HEC', testament: 'NT', group: 'Historia NT' },
  { file: 'Section0045', id: 45, name: 'Romanos',               abbr: 'ROM', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0046', id: 46, name: '1 Corintios',           abbr: '1CO', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0047', id: 47, name: '2 Corintios',           abbr: '2CO', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0048', id: 48, name: 'Gálatas',               abbr: 'GAL', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0049', id: 49, name: 'Efesios',               abbr: 'EFE', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0050', id: 50, name: 'Filipenses',            abbr: 'FIL', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0051', id: 51, name: 'Colosenses',            abbr: 'COL', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0052', id: 52, name: '1 Tesalonicenses',      abbr: '1TE', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0053', id: 53, name: '2 Tesalonicenses',      abbr: '2TE', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0054', id: 54, name: '1 Timoteo',             abbr: '1TI', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0055', id: 55, name: '2 Timoteo',             abbr: '2TI', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0056', id: 56, name: 'Tito',                  abbr: 'TIT', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0057', id: 57, name: 'Filemón',               abbr: 'FLM', testament: 'NT', group: 'Cartas de Pablo' },
  { file: 'Section0058', id: 58, name: 'Hebreos',               abbr: 'HEB', testament: 'NT', group: 'Cartas Generales' },
  { file: 'Section0059', id: 59, name: 'Santiago',              abbr: 'SAN', testament: 'NT', group: 'Cartas Generales' },
  { file: 'Section0060', id: 60, name: '1 Pedro',               abbr: '1PE', testament: 'NT', group: 'Cartas Generales' },
  { file: 'Section0061', id: 61, name: '2 Pedro',               abbr: '2PE', testament: 'NT', group: 'Cartas Generales' },
  { file: 'Section0062', id: 62, name: '1 Juan',                abbr: '1JN', testament: 'NT', group: 'Cartas Generales' },
  { file: 'Section0063', id: 63, name: '2 Juan',                abbr: '2JN', testament: 'NT', group: 'Cartas Generales' },
  { file: 'Section0064', id: 64, name: '3 Juan',                abbr: '3JN', testament: 'NT', group: 'Cartas Generales' },
  { file: 'Section0065', id: 65, name: 'Judas',                 abbr: 'JUD', testament: 'NT', group: 'Cartas Generales' },
  { file: 'Section0066', id: 66, name: 'Apocalipsis',           abbr: 'APO', testament: 'NT', group: 'Profecía NT' },
];

const XHTML_DIR = path.join(__dirname, '..', 'content', 'OEBPS', 'Text');
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'bible.json');

/**
 * Limpia el HTML quitando tags y dejando texto plano.
 * Preserva el texto dentro de <sup> si es número de versículo.
 */
function stripHtml(html) {
  return html
    .replace(/<a\b[^>]*>.*?<\/a>/gi, '') // notas al pie
    .replace(/<sup>\d[^<]*<\/sup>/gi, '') // números de versículo inline
    .replace(/<[^>]+>/g, '')              // todos los demás tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Parsea un archivo xhtml y devuelve array de capítulos con versículos.
 * Maneja libros de un solo capítulo (sin etiqueta <h3>).
 */
function parseBookFile(filePath, bookName) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const chapters = [];
  let currentChapter = null;
  let currentSectionTitle = null;

  // Detectar si el libro tiene algún <h3> (múltiples capítulos)
  const hasH3 = /<h3\b/.test(raw);

  // Si NO tiene <h3>, es un libro de un solo capítulo → crear capítulo 1 automáticamente
  if (!hasH3) {
    currentChapter = { number: 1, sections: [], verses: [] };
    chapters.push(currentChapter);
  }

  // Extraer todos los elementos relevantes en orden
  const elementRegex = /<(h1|h3|p)([^>]*)>([\s\S]*?)<\/(h1|h3|p)>/gi;
  let match;

  while ((match = elementRegex.exec(raw)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const content = match[3];

    if (tag === 'h1') continue; // nombre del libro, ignoramos

    if (tag === 'h3') {
      // Número de capítulo (solo para libros multi-capítulo)
      const chapNum = parseInt(stripHtml(content), 10);
      if (!isNaN(chapNum)) {
        currentChapter = { number: chapNum, sections: [], verses: [] };
        chapters.push(currentChapter);
        currentSectionTitle = null;
      }
      continue;
    }

    if (tag === 'p' && currentChapter) {
      const isNegrita = /class="[^"]*negrita[^"]*"/.test(attrs);

      if (isNegrita) {
        currentSectionTitle = stripHtml(content).trim();
        if (currentSectionTitle) {
          currentChapter.sections.push({
            afterVerse: currentChapter.verses.length > 0
              ? currentChapter.verses[currentChapter.verses.length - 1].number
              : 0,
            title: currentSectionTitle
          });
        }
        continue;
      }

      // ¿Tiene <sup> con número de versículo?
      const supMatch = content.match(/<sup>([\d\-–]+)<\/sup>/);
      if (supMatch) {
        const verseLabel = supMatch[1];
        const verseNum = parseInt(verseLabel.split(/[-–]/)[0], 10);
        if (!isNaN(verseNum)) {
          const text = stripHtml(content).trim();
          if (text) {
            currentChapter.verses.push({
              number: verseNum,
              label: verseLabel,
              text: text,
              sectionTitle: currentSectionTitle || null
            });
          }
        }
      }
    }
  }

  return chapters;
}

/**
 * Main
 */
function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const result = { version: '1.0', translation: 'TLA', books: [] };
  let totalChapters = 0;
  let totalVerses = 0;

  for (const bookMeta of BOOK_MAP) {
    const filePath = path.join(XHTML_DIR, `${bookMeta.file}.xhtml`);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  No encontrado: ${filePath}`);
      continue;
    }

    process.stdout.write(`Parseando ${bookMeta.name}...`);
    const chapters = parseBookFile(filePath, bookMeta.name);
    const verseCount = chapters.reduce((sum, c) => sum + c.verses.length, 0);
    totalChapters += chapters.length;
    totalVerses += verseCount;
    console.log(` ${chapters.length} caps, ${verseCount} vers.`);

    result.books.push({
      id: bookMeta.id,
      name: bookMeta.name,
      abbr: bookMeta.abbr,
      testament: bookMeta.testament,
      group: bookMeta.group,
      file: bookMeta.file,
      chapterCount: chapters.length,
      chapters: chapters
    });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');

  console.log('\n✅ Completado!');
  console.log(`   Libros:    ${result.books.length}`);
  console.log(`   Capítulos: ${totalChapters}`);
  console.log(`   Versículos:${totalVerses}`);
  console.log(`   Salida:    ${OUTPUT_FILE}`);
}

main();
