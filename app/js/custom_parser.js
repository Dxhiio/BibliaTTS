/**
 * custom_parser.js — Motor cliente inteligente y auto-reparable para parsear archivos .txt y .epub en objetos de Biblia.
 * Expone: window.ClientParser
 */
(function () {
  'use strict';

  const CANONICAL_BOOKS = [
    { id: 1, name: 'Génesis', abbr: 'GEN', testament: 'AT', group: 'Pentateuco', regex: /\bg[eé]nesis\b/i },
    { id: 2, name: 'Éxodo', abbr: 'EXO', testament: 'AT', group: 'Pentateuco', regex: /\b[eé]xodo\b/i },
    { id: 3, name: 'Levítico', abbr: 'LEV', testament: 'AT', group: 'Pentateuco', regex: /\blev[ií]tico\b/i },
    { id: 4, name: 'Números', abbr: 'NUM', testament: 'AT', group: 'Pentateuco', regex: /\bn[uú]meros\b/i },
    { id: 5, name: 'Deuteronomio', abbr: 'DEU', testament: 'AT', group: 'Pentateuco', regex: /\bdeuteronomio\b/i },
    { id: 6, name: 'Josué', abbr: 'JOS', testament: 'AT', group: 'Históricos', regex: /\bjosu[eé]\b/i },
    { id: 7, name: 'Jueces', abbr: 'JUE', testament: 'AT', group: 'Históricos', regex: /\bjueces\b/i },
    { id: 8, name: 'Rut', abbr: 'RUT', testament: 'AT', group: 'Históricos', regex: /\brut\b/i },
    { id: 9, name: '1 Samuel', abbr: '1SA', testament: 'AT', group: 'Históricos', regex: /\b1\s*samuel\b/i },
    { id: 10, name: '2 Samuel', abbr: '2SA', testament: 'AT', group: 'Históricos', regex: /\b2\s*samuel\b/i },
    { id: 11, name: '1 Reyes', abbr: '1RE', testament: 'AT', group: 'Históricos', regex: /\b1\s*reyes\b/i },
    { id: 12, name: '2 Reyes', abbr: '2RE', testament: 'AT', group: 'Históricos', regex: /\b2\s*reyes\b/i },
    { id: 13, name: '1 Crónicas', abbr: '1CR', testament: 'AT', group: 'Históricos', regex: /\b1\s*cr[oó]nicas\b/i },
    { id: 14, name: '2 Crónicas', abbr: '2CR', testament: 'AT', group: 'Históricos', regex: /\b2\s*cr[oó]nicas\b/i },
    { id: 15, name: 'Esdras', abbr: 'ESD', testament: 'AT', group: 'Históricos', regex: /\besdras\b/i },
    { id: 16, name: 'Nehemías', abbr: 'NEH', testament: 'AT', group: 'Históricos', regex: /\bnehem[ií]as\b/i },
    { id: 17, name: 'Ester', abbr: 'EST', testament: 'AT', group: 'Históricos', regex: /\bester\b/i },
    { id: 18, name: 'Job', abbr: 'JOB', testament: 'AT', group: 'Sapienciales', regex: /\bjob\b/i },
    { id: 19, name: 'Salmos', abbr: 'SAL', testament: 'AT', group: 'Sapienciales', regex: /\bsalmos?\b/i },
    { id: 20, name: 'Proverbios', abbr: 'PRO', testament: 'AT', group: 'Sapienciales', regex: /\bproverbios\b/i },
    { id: 21, name: 'Eclesiastés', abbr: 'ECL', testament: 'AT', group: 'Sapienciales', regex: /\beclesiast[eé]s\b/i },
    { id: 22, name: 'Cantar de los Cantares', abbr: 'CAN', testament: 'AT', group: 'Sapienciales', regex: /\bcantar\b/i },
    { id: 23, name: 'Isaías', abbr: 'ISA', testament: 'AT', group: 'Profetas Mayores', regex: /\bisa[ií]as\b/i },
    { id: 24, name: 'Jeremías', abbr: 'JER', testament: 'AT', group: 'Profetas Mayores', regex: /\bjerem[ií]as\b/i },
    { id: 25, name: 'Lamentaciones', abbr: 'LAM', testament: 'AT', group: 'Profetas Mayores', regex: /\blamentaciones\b/i },
    { id: 26, name: 'Ezequiel', abbr: 'EZE', testament: 'AT', group: 'Profetas Mayores', regex: /\bezequiel\b/i },
    { id: 27, name: 'Daniel', abbr: 'DAN', testament: 'AT', group: 'Profetas Mayores', regex: /\bdaniel\b/i },
    { id: 28, name: 'Oseas', abbr: 'OSE', testament: 'AT', group: 'Profetas Menores', regex: /\boseas\b/i },
    { id: 29, name: 'Joel', abbr: 'JOE', testament: 'AT', group: 'Profetas Menores', regex: /\bjoel\b/i },
    { id: 30, name: 'Amós', abbr: 'AMO', testament: 'AT', group: 'Profetas Menores', regex: /\bam[oó]s\b/i },
    { id: 31, name: 'Abdías', abbr: 'ABD', testament: 'AT', group: 'Profetas Menores', regex: /\babd[ií]as\b/i },
    { id: 32, name: 'Jonás', abbr: 'JON', testament: 'AT', group: 'Profetas Menores', regex: /\bjon[aá]s\b/i },
    { id: 33, name: 'Miqueas', abbr: 'MIQ', testament: 'AT', group: 'Profetas Menores', regex: /\bmiqueas\b/i },
    { id: 34, name: 'Nahum', abbr: 'NAH', testament: 'AT', group: 'Profetas Menores', regex: /\bnah[uú]m\b/i },
    { id: 35, name: 'Habacuc', abbr: 'HAB', testament: 'AT', group: 'Profetas Menores', regex: /\bhabacuc\b/i },
    { id: 36, name: 'Sofonías', abbr: 'SOF', testament: 'AT', group: 'Profetas Menores', regex: /\bsofon[ií]as\b/i },
    { id: 37, name: 'Hageo', abbr: 'HAG', testament: 'AT', group: 'Profetas Menores', regex: /\bhageo\b/i },
    { id: 38, name: 'Zacarías', abbr: 'ZAC', testament: 'AT', group: 'Profetas Menores', regex: /\bzacar[ií]as\b/i },
    { id: 39, name: 'Malaquías', abbr: 'MAL', testament: 'AT', group: 'Profetas Menores', regex: /\bmalaqu[ií]as\b/i },
    { id: 40, name: 'Mateo', abbr: 'MAT', testament: 'NT', group: 'Evangelios', regex: /\bmateo\b/i },
    { id: 41, name: 'Marcos', abbr: 'MAR', testament: 'NT', group: 'Evangelios', regex: /\bmarcos\b/i },
    { id: 42, name: 'Lucas', abbr: 'LUC', testament: 'NT', group: 'Evangelios', regex: /\blucas\b/i },
    { id: 43, name: 'Juan', abbr: 'JUA', testament: 'NT', group: 'Evangelios', regex: /\bjuan\b/i },
    { id: 44, name: 'Hechos', abbr: 'HEC', testament: 'NT', group: 'Historia NT', regex: /\bhechos\b/i },
    { id: 45, name: 'Romanos', abbr: 'ROM', testament: 'NT', group: 'Cartas de Pablo', regex: /\bromanos\b/i },
    { id: 46, name: '1 Corintios', abbr: '1CO', testament: 'NT', group: 'Cartas de Pablo', regex: /\b1\s*corintios\b/i },
    { id: 47, name: '2 Corintios', abbr: '2CO', testament: 'NT', group: 'Cartas de Pablo', regex: /\b2\s*corintios\b/i },
    { id: 48, name: 'Gálatas', abbr: 'GAL', testament: 'NT', group: 'Cartas de Pablo', regex: /\bg[aá]latas\b/i },
    { id: 49, name: 'Efesios', abbr: 'EFE', testament: 'NT', group: 'Cartas de Pablo', regex: /\befesios\b/i },
    { id: 50, name: 'Filipenses', abbr: 'FIL', testament: 'NT', group: 'Cartas de Pablo', regex: /\bfilipenses\b/i },
    { id: 51, name: 'Colosenses', abbr: 'COL', testament: 'NT', group: 'Cartas de Pablo', regex: /\bcolosenses\b/i },
    { id: 52, name: '1 Tesalonicenses', abbr: '1TE', testament: 'NT', group: 'Cartas de Pablo', regex: /\b1\s*tesalonicenses\b/i },
    { id: 53, name: '2 Tesalonicenses', abbr: '2TE', testament: 'NT', group: 'Cartas de Pablo', regex: /\b2\s*tesalonicenses\b/i },
    { id: 54, name: '1 Timoteo', abbr: '1TI', testament: 'NT', group: 'Cartas de Pablo', regex: /\b1\s*timoteo\b/i },
    { id: 55, name: '2 Timoteo', abbr: '2TI', testament: 'NT', group: 'Cartas de Pablo', regex: /\b2\s*timoteo\b/i },
    { id: 56, name: 'Tito', abbr: 'TIT', testament: 'NT', group: 'Cartas de Pablo', regex: /\btito\b/i },
    { id: 57, name: 'Filemón', abbr: 'FLM', testament: 'NT', group: 'Cartas de Pablo', regex: /\bfilem[oó]n\b/i },
    { id: 58, name: 'Hebreos', abbr: 'HEB', testament: 'NT', group: 'Cartas Generales', regex: /\bhebreos\b/i },
    { id: 59, name: 'Santiago', abbr: 'SAN', testament: 'NT', group: 'Cartas Generales', regex: /\bsantiago\b/i },
    { id: 60, name: '1 Pedro', abbr: '1PE', testament: 'NT', group: 'Cartas Generales', regex: /\b1\s*pedro\b/i },
    { id: 61, name: '2 Pedro', abbr: '2PE', testament: 'NT', group: 'Cartas Generales', regex: /\b2\s*pedro\b/i },
    { id: 62, name: '1 Juan', abbr: '1JN', testament: 'NT', group: 'Cartas Generales', regex: /\b1\s*juan\b/i },
    { id: 63, name: '2 Juan', abbr: '2JN', testament: 'NT', group: 'Cartas Generales', regex: /\b2\s*juan\b/i },
    { id: 64, name: '3 Juan', abbr: '3JN', testament: 'NT', group: 'Cartas Generales', regex: /\b3\s*juan\b/i },
    { id: 65, name: 'Judas', abbr: 'JUD', testament: 'NT', group: 'Cartas Generales', regex: /\bjudas\b/i },
    { id: 66, name: 'Apocalipsis', abbr: 'APO', testament: 'NT', group: 'Profecía NT', regex: /\bapocalipsis\b/i }
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
        
        // Ordenar archivos de manera alfanumérica natural
        const htmlFiles = Object.keys(zip.files)
          .filter(k => k.endsWith('.html') || k.endsWith('.xhtml') || k.endsWith('.xml') || k.endsWith('.htm'))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        
        onProgress(30, `Extrayendo texto de ${htmlFiles.length} secciones...`);
        for (const path of htmlFiles) {
          const content = await zip.files[path].async('string');
          
          // Preservar estructura de versículos en HTML (sup, span, p, div)
          let text = content
            .replace(/<title[^>]*>.*?<\/title>/gi, '')
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<sup>(\d{1,3})<\/sup>/gi, '\n[$1] ')
            .replace(/<span[^>]*class="[^"]*(?:verse|vers|num)[^"]*"[^>]*>(\d{1,3})<\/span>/gi, '\n[$1] ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/h[1-6]>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ');
            
          rawText += '\n' + text;
        }
      } else {
        onProgress(20, 'Leyendo archivo de texto plano...');
        rawText = await file.text();
      }

      onProgress(50, 'Indexando libros, capítulos y versículos...');
      const booksParsed = this.structureText(rawText);

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

      function getOrCreateChapter(book, num) {
        let ch = book.chapters.find(c => c.number === num);
        if (!ch) {
          ch = { number: num, verses: [], sections: [] };
          book.chapters.push(ch);
        }
        return ch;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Intentar detectar un nombre de libro canónico en la línea
        if (!/^\d/.test(line) && line.length < 120) {
          for (const canon of CANONICAL_BOOKS) {
            if (canon.regex.test(line)) {
              let existing = books.find(b => b.id === canon.id);
              if (!existing) {
                existing = {
                  id: canon.id,
                  name: canon.name,
                  abbr: canon.abbr,
                  testament: canon.testament,
                  group: canon.group,
                  chapters: []
                };
                books.push(existing);
              }
              currentBook = existing;
              currentChapter = null; // Reiniciamos capítulo al entrar a nuevo libro
              break;
            }
          }
        }

        if (!currentBook) continue;

        // 2. Detectar encabezado de capítulo explícito (ej. "Capítulo 1", "Capítulo 2")
        const chapMatch = line.match(/^(?:Cap[ií]tulo|Salmo)\s*(\d{1,3})(?:\b|:|\.|$)/i);
        if (chapMatch) {
          const cNum = parseInt(chapMatch[1], 10);
          currentChapter = getOrCreateChapter(currentBook, cNum);
          continue;
        }

        // 3. Detectar versículo con notación [capítulo:versículo] o suelto [versículo]
        const verseMatch = line.match(/^\[?(\d{1,3})\]?(?:[:.](\d{1,3}))?[:.-]?\s*(.+)$/);
        if (verseMatch) {
          const numA = parseInt(verseMatch[1], 10);
          const numB = verseMatch[2] ? parseInt(verseMatch[2], 10) : null;
          const vText = verseMatch[3].trim();

          if (vText.length < 2) continue;

          if (numB !== null) {
            // Notación explícita cap:vers (ej. 1:1 En el principio)
            currentChapter = getOrCreateChapter(currentBook, numA);
            currentChapter.verses.push({ number: numB, text: vText });
          } else {
            // Notación de versículo suelto (ej. 1 En el principio)
            if (!currentChapter) {
              // Si no se había declarado capítulo, asumimos Capítulo 1
              currentChapter = getOrCreateChapter(currentBook, 1);
            } else if (numA === 1 && currentChapter.verses.length >= 3) {
              // Auto-sanación: si se reinicia el contador a versículo 1 tras varios versículos, ¡es un nuevo capítulo!
              const nextNum = currentChapter.number + 1;
              currentChapter = getOrCreateChapter(currentBook, nextNum);
            }
            currentChapter.verses.push({ number: numA, text: vText });
          }
        }
      }

      // Ordenar libros según canon bíblico oficial
      books.sort((a, b) => a.id - b.id);
      return books;
    }
  };
})();
