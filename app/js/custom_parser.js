/**
 * custom_parser.js — Motor cliente para parsear archivos .txt y .epub en objetos de Biblia estructurados.
 * Expone: window.ClientParser
 */
(function () {
  'use strict';

  const CANONICAL_BOOKS = [
    { id: 1, name: 'Génesis', abbr: 'GEN', testament: 'AT', group: 'Pentateuco', regex: /g[eé]nesis/i },
    { id: 2, name: 'Éxodo', abbr: 'EXO', testament: 'AT', group: 'Pentateuco', regex: /[eé]xodo/i },
    { id: 3, name: 'Levítico', abbr: 'LEV', testament: 'AT', group: 'Pentateuco', regex: /lev[ií]tico/i },
    { id: 4, name: 'Números', abbr: 'NUM', testament: 'AT', group: 'Pentateuco', regex: /n[uú]meros/i },
    { id: 5, name: 'Deuteronomio', abbr: 'DEU', testament: 'AT', group: 'Pentateuco', regex: /deuteronomio/i },
    { id: 6, name: 'Josué', abbr: 'JOS', testament: 'AT', group: 'Históricos', regex: /josu[eé]/i },
    { id: 7, name: 'Jueces', abbr: 'JUE', testament: 'AT', group: 'Históricos', regex: /jueces/i },
    { id: 8, name: 'Rut', abbr: 'RUT', testament: 'AT', group: 'Históricos', regex: /\brut\b/i },
    { id: 9, name: '1 Samuel', abbr: '1SA', testament: 'AT', group: 'Históricos', regex: /1\s*samuel/i },
    { id: 10, name: '2 Samuel', abbr: '2SA', testament: 'AT', group: 'Históricos', regex: /2\s*samuel/i },
    { id: 11, name: '1 Reyes', abbr: '1RE', testament: 'AT', group: 'Históricos', regex: /1\s*reyes/i },
    { id: 12, name: '2 Reyes', abbr: '2RE', testament: 'AT', group: 'Históricos', regex: /2\s*reyes/i },
    { id: 13, name: '1 Crónicas', abbr: '1CR', testament: 'AT', group: 'Históricos', regex: /1\s*cr[oó]nicas/i },
    { id: 14, name: '2 Crónicas', abbr: '2CR', testament: 'AT', group: 'Históricos', regex: /2\s*cr[oó]nicas/i },
    { id: 15, name: 'Esdras', abbr: 'ESD', testament: 'AT', group: 'Históricos', regex: /esdras/i },
    { id: 16, name: 'Nehemías', abbr: 'NEH', testament: 'AT', group: 'Históricos', regex: /nehem[ií]as/i },
    { id: 17, name: 'Ester', abbr: 'EST', testament: 'AT', group: 'Históricos', regex: /ester/i },
    { id: 18, name: 'Job', abbr: 'JOB', testament: 'AT', group: 'Sapienciales', regex: /\bjob\b/i },
    { id: 19, name: 'Salmos', abbr: 'SAL', testament: 'AT', group: 'Sapienciales', regex: /salmos?/i },
    { id: 20, name: 'Proverbios', abbr: 'PRO', testament: 'AT', group: 'Sapienciales', regex: /proverbios/i },
    { id: 21, name: 'Eclesiastés', abbr: 'ECL', testament: 'AT', group: 'Sapienciales', regex: /eclesiast[eé]s/i },
    { id: 22, name: 'Cantar de los Cantares', abbr: 'CAN', testament: 'AT', group: 'Sapienciales', regex: /cantar/i },
    { id: 23, name: 'Isaías', abbr: 'ISA', testament: 'AT', group: 'Profetas Mayores', regex: /isa[ií]as/i },
    { id: 24, name: 'Jeremías', abbr: 'JER', testament: 'AT', group: 'Profetas Mayores', regex: /jerem[ií]as/i },
    { id: 25, name: 'Lamentaciones', abbr: 'LAM', testament: 'AT', group: 'Profetas Mayores', regex: /lamentaciones/i },
    { id: 26, name: 'Ezequiel', abbr: 'EZE', testament: 'AT', group: 'Profetas Mayores', regex: /ezequiel/i },
    { id: 27, name: 'Daniel', abbr: 'DAN', testament: 'AT', group: 'Profetas Mayores', regex: /daniel/i },
    { id: 28, name: 'Oseas', abbr: 'OSE', testament: 'AT', group: 'Profetas Menores', regex: /oseas/i },
    { id: 29, name: 'Joel', abbr: 'JOE', testament: 'AT', group: 'Profetas Menores', regex: /joel/i },
    { id: 30, name: 'Amós', abbr: 'AMO', testament: 'AT', group: 'Profetas Menores', regex: /am[oó]s/i },
    { id: 31, name: 'Abdías', abbr: 'ABD', testament: 'AT', group: 'Profetas Menores', regex: /abd[ií]as/i },
    { id: 32, name: 'Jonás', abbr: 'JON', testament: 'AT', group: 'Profetas Menores', regex: /jon[aá]s/i },
    { id: 33, name: 'Miqueas', abbr: 'MIQ', testament: 'AT', group: 'Profetas Menores', regex: /miqueas/i },
    { id: 34, name: 'Nahum', abbr: 'NAH', testament: 'AT', group: 'Profetas Menores', regex: /nah[uú]m/i },
    { id: 35, name: 'Habacuc', abbr: 'HAB', testament: 'AT', group: 'Profetas Menores', regex: /habacuc/i },
    { id: 36, name: 'Sofonías', abbr: 'SOF', testament: 'AT', group: 'Profetas Menores', regex: /sofon[ií]as/i },
    { id: 37, name: 'Hageo', abbr: 'HAG', testament: 'AT', group: 'Profetas Menores', regex: /hageo/i },
    { id: 38, name: 'Zacarías', abbr: 'ZAC', testament: 'AT', group: 'Profetas Menores', regex: /zacar[ií]as/i },
    { id: 39, name: 'Malaquías', abbr: 'MAL', testament: 'AT', group: 'Profetas Menores', regex: /malaqu[ií]as/i },
    { id: 40, name: 'Mateo', abbr: 'MAT', testament: 'NT', group: 'Evangelios', regex: /mateo/i },
    { id: 41, name: 'Marcos', abbr: 'MAR', testament: 'NT', group: 'Evangelios', regex: /marcos/i },
    { id: 42, name: 'Lucas', abbr: 'LUC', testament: 'NT', group: 'Evangelios', regex: /lucas/i },
    { id: 43, name: 'Juan', abbr: 'JUA', testament: 'NT', group: 'Evangelios', regex: /\bjuan\b/i },
    { id: 44, name: 'Hechos', abbr: 'HEC', testament: 'NT', group: 'Historia NT', regex: /hechos/i },
    { id: 45, name: 'Romanos', abbr: 'ROM', testament: 'NT', group: 'Cartas de Pablo', regex: /romanos/i },
    { id: 46, name: '1 Corintios', abbr: '1CO', testament: 'NT', group: 'Cartas de Pablo', regex: /1\s*corintios/i },
    { id: 47, name: '2 Corintios', abbr: '2CO', testament: 'NT', group: 'Cartas de Pablo', regex: /2\s*corintios/i },
    { id: 48, name: 'Gálatas', abbr: 'GAL', testament: 'NT', group: 'Cartas de Pablo', regex: /g[aá]latas/i },
    { id: 49, name: 'Efesios', abbr: 'EFE', testament: 'NT', group: 'Cartas de Pablo', regex: /efesios/i },
    { id: 50, name: 'Filipenses', abbr: 'FIL', testament: 'NT', group: 'Cartas de Pablo', regex: /filipenses/i },
    { id: 51, name: 'Colosenses', abbr: 'COL', testament: 'NT', group: 'Cartas de Pablo', regex: /colosenses/i },
    { id: 52, name: '1 Tesalonicenses', abbr: '1TE', testament: 'NT', group: 'Cartas de Pablo', regex: /1\s*tesalonicenses/i },
    { id: 53, name: '2 Tesalonicenses', abbr: '2TE', testament: 'NT', group: 'Cartas de Pablo', regex: /2\s*tesalonicenses/i },
    { id: 54, name: '1 Timoteo', abbr: '1TI', testament: 'NT', group: 'Cartas de Pablo', regex: /1\s*timoteo/i },
    { id: 55, name: '2 Timoteo', abbr: '2TI', testament: 'NT', group: 'Cartas de Pablo', regex: /2\s*timoteo/i },
    { id: 56, name: 'Tito', abbr: 'TIT', testament: 'NT', group: 'Cartas de Pablo', regex: /\btito\b/i },
    { id: 57, name: 'Filemón', abbr: 'FLM', testament: 'NT', group: 'Cartas de Pablo', regex: /filem[oó]n/i },
    { id: 58, name: 'Hebreos', abbr: 'HEB', testament: 'NT', group: 'Cartas Generales', regex: /hebreos/i },
    { id: 59, name: 'Santiago', abbr: 'SAN', testament: 'NT', group: 'Cartas Generales', regex: /santiago/i },
    { id: 60, name: '1 Pedro', abbr: '1PE', testament: 'NT', group: 'Cartas Generales', regex: /1\s*pedro/i },
    { id: 61, name: '2 Pedro', abbr: '2PE', testament: 'NT', group: 'Cartas Generales', regex: /2\s*pedro/i },
    { id: 62, name: '1 Juan', abbr: '1JN', testament: 'NT', group: 'Cartas Generales', regex: /1\s*juan/i },
    { id: 63, name: '2 Juan', abbr: '2JN', testament: 'NT', group: 'Cartas Generales', regex: /2\s*juan/i },
    { id: 64, name: '3 Juan', abbr: '3JN', testament: 'NT', group: 'Cartas Generales', regex: /3\s*juan/i },
    { id: 65, name: 'Judas', abbr: 'JUD', testament: 'NT', group: 'Cartas Generales', regex: /\bjudas\b/i },
    { id: 66, name: 'Apocalipsis', abbr: 'APO', testament: 'NT', group: 'Profecía NT', regex: /apocalipsis/i }
  ];

  async function loadJSZip() {
    if (window.JSZip) return window.JSZip;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => reject(new Error('No se pudo cargar librería JSZip para leer archivos EPUB'));
      document.head.appendChild(s);
    });
  }

  window.ClientParser = {
    async parseFile(file, translationName, translationAbbr, onProgress) {
      const isEpub = file.name.endsWith('.epub');
      let rawText = '';

      if (isEpub) {
        onProgress(10, 'Descomprimiendo archivo EPUB...');
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(file);
        const htmlFiles = Object.keys(zip.files).filter(k => k.endsWith('.html') || k.endsWith('.xhtml') || k.endsWith('.xml'));
        
        onProgress(30, `Extrayendo texto de ${htmlFiles.length} secciones...`);
        for (const path of htmlFiles) {
          const content = await zip.files[path].async('string');
          const text = content
            .replace(/<title[^>]*>.*?<\/title>/gi, '')
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ');
          rawText += '\n' + text;
        }
      } else {
        onProgress(20, 'Leyendo archivo de texto plano...');
        rawText = await file.text();
      }

      onProgress(50, 'Indexando libros, capítulos y versículos...');
      const booksParsed = this.structureText(rawText, onProgress);

      if (booksParsed.length === 0) {
        throw new Error('No se pudieron reconocer libros o versículos bíblicos en el archivo. Asegúrate del formato.');
      }

      onProgress(90, `Generando base de datos con ${booksParsed.length} libros...`);
      
      return {
        id: 'custom_' + Date.now(),
        name: translationName || 'Traducción Importada',
        abbr: (translationAbbr || 'CUST').toUpperCase(),
        books: booksParsed
      };
    },

    structureText(text) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const books = [];
      let currentBook = null;
      let currentChapter = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const canon of CANONICAL_BOOKS) {
          if (canon.regex.test(line) && line.length < 40) {
            currentBook = {
              id: canon.id,
              name: canon.name,
              abbr: canon.abbr,
              testament: canon.testament,
              group: canon.group,
              chapters: []
            };
            if (!books.find(b => b.id === canon.id)) {
              books.push(currentBook);
            } else {
              currentBook = books.find(b => b.id === canon.id);
            }
            break;
          }
        }

        if (!currentBook) continue;

        const chapMatch = line.match(/^(?:Cap[ií]tulo\s*)?(\d{1,3})$/i);
        if (chapMatch) {
          const cNum = parseInt(chapMatch[1], 10);
          let ch = currentBook.chapters.find(c => c.number === cNum);
          if (!ch) {
            ch = { number: cNum, verses: [], sections: [] };
            currentBook.chapters.push(ch);
          }
          currentChapter = ch;
          continue;
        }

        const verseMatch = line.match(/^\[?(\d{1,3})\]?[:.-]?\s*(.+)$/);
        if (verseMatch && currentChapter) {
          const vNum = parseInt(verseMatch[1], 10);
          const vText = verseMatch[2].trim();
          if (vText.length > 1) {
            currentChapter.verses.push({ number: vNum, text: vText });
          }
        }
      }

      books.sort((a, b) => a.id - b.id);
      return books;
    }
  };
})();
