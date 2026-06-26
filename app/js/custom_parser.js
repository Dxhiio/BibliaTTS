/**
 * custom_parser.js — Motor cliente que decodifica EPUBs con IDs estructurados (formato SBU/estudio)
 * y también parsea EPUBs/TXTs genéricos por texto.
 * Expone: window.ClientParser
 */
(function () {
  'use strict';

  // Mapa canónico de 66 libros por ID numérico
  const CANONICAL_BOOKS = [
    { id: 1,  name: 'Génesis',               abbr: 'GEN', testament: 'AT', group: 'Pentateuco' },
    { id: 2,  name: 'Éxodo',                 abbr: 'EXO', testament: 'AT', group: 'Pentateuco' },
    { id: 3,  name: 'Levítico',              abbr: 'LEV', testament: 'AT', group: 'Pentateuco' },
    { id: 4,  name: 'Números',               abbr: 'NUM', testament: 'AT', group: 'Pentateuco' },
    { id: 5,  name: 'Deuteronomio',          abbr: 'DEU', testament: 'AT', group: 'Pentateuco' },
    { id: 6,  name: 'Josué',                 abbr: 'JOS', testament: 'AT', group: 'Históricos' },
    { id: 7,  name: 'Jueces',                abbr: 'JUE', testament: 'AT', group: 'Históricos' },
    { id: 8,  name: 'Rut',                   abbr: 'RUT', testament: 'AT', group: 'Históricos' },
    { id: 9,  name: '1 Samuel',              abbr: '1SA', testament: 'AT', group: 'Históricos' },
    { id: 10, name: '2 Samuel',              abbr: '2SA', testament: 'AT', group: 'Históricos' },
    { id: 11, name: '1 Reyes',               abbr: '1RE', testament: 'AT', group: 'Históricos' },
    { id: 12, name: '2 Reyes',               abbr: '2RE', testament: 'AT', group: 'Históricos' },
    { id: 13, name: '1 Crónicas',            abbr: '1CR', testament: 'AT', group: 'Históricos' },
    { id: 14, name: '2 Crónicas',            abbr: '2CR', testament: 'AT', group: 'Históricos' },
    { id: 15, name: 'Esdras',                abbr: 'ESD', testament: 'AT', group: 'Históricos' },
    { id: 16, name: 'Nehemías',              abbr: 'NEH', testament: 'AT', group: 'Históricos' },
    { id: 17, name: 'Ester',                 abbr: 'EST', testament: 'AT', group: 'Históricos' },
    { id: 18, name: 'Job',                   abbr: 'JOB', testament: 'AT', group: 'Sapienciales' },
    { id: 19, name: 'Salmos',                abbr: 'SAL', testament: 'AT', group: 'Sapienciales' },
    { id: 20, name: 'Proverbios',            abbr: 'PRO', testament: 'AT', group: 'Sapienciales' },
    { id: 21, name: 'Eclesiastés',           abbr: 'ECL', testament: 'AT', group: 'Sapienciales' },
    { id: 22, name: 'Cantar de los Cantares',abbr: 'CAN', testament: 'AT', group: 'Sapienciales' },
    { id: 23, name: 'Isaías',                abbr: 'ISA', testament: 'AT', group: 'Profetas Mayores' },
    { id: 24, name: 'Jeremías',              abbr: 'JER', testament: 'AT', group: 'Profetas Mayores' },
    { id: 25, name: 'Lamentaciones',         abbr: 'LAM', testament: 'AT', group: 'Profetas Mayores' },
    { id: 26, name: 'Ezequiel',              abbr: 'EZE', testament: 'AT', group: 'Profetas Mayores' },
    { id: 27, name: 'Daniel',                abbr: 'DAN', testament: 'AT', group: 'Profetas Mayores' },
    { id: 28, name: 'Oseas',                 abbr: 'OSE', testament: 'AT', group: 'Profetas Menores' },
    { id: 29, name: 'Joel',                  abbr: 'JOE', testament: 'AT', group: 'Profetas Menores' },
    { id: 30, name: 'Amós',                  abbr: 'AMO', testament: 'AT', group: 'Profetas Menores' },
    { id: 31, name: 'Abdías',                abbr: 'ABD', testament: 'AT', group: 'Profetas Menores' },
    { id: 32, name: 'Jonás',                 abbr: 'JON', testament: 'AT', group: 'Profetas Menores' },
    { id: 33, name: 'Miqueas',               abbr: 'MIQ', testament: 'AT', group: 'Profetas Menores' },
    { id: 34, name: 'Nahum',                 abbr: 'NAH', testament: 'AT', group: 'Profetas Menores' },
    { id: 35, name: 'Habacuc',               abbr: 'HAB', testament: 'AT', group: 'Profetas Menores' },
    { id: 36, name: 'Sofonías',              abbr: 'SOF', testament: 'AT', group: 'Profetas Menores' },
    { id: 37, name: 'Hageo',                 abbr: 'HAG', testament: 'AT', group: 'Profetas Menores' },
    { id: 38, name: 'Zacarías',              abbr: 'ZAC', testament: 'AT', group: 'Profetas Menores' },
    { id: 39, name: 'Malaquías',             abbr: 'MAL', testament: 'AT', group: 'Profetas Menores' },
    { id: 40, name: 'Mateo',                 abbr: 'MAT', testament: 'NT', group: 'Evangelios' },
    { id: 41, name: 'Marcos',                abbr: 'MAR', testament: 'NT', group: 'Evangelios' },
    { id: 42, name: 'Lucas',                 abbr: 'LUC', testament: 'NT', group: 'Evangelios' },
    { id: 43, name: 'Juan',                  abbr: 'JUA', testament: 'NT', group: 'Evangelios' },
    { id: 44, name: 'Hechos',                abbr: 'HEC', testament: 'NT', group: 'Historia NT' },
    { id: 45, name: 'Romanos',               abbr: 'ROM', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 46, name: '1 Corintios',           abbr: '1CO', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 47, name: '2 Corintios',           abbr: '2CO', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 48, name: 'Gálatas',               abbr: 'GAL', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 49, name: 'Efesios',               abbr: 'EFE', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 50, name: 'Filipenses',            abbr: 'FIL', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 51, name: 'Colosenses',            abbr: 'COL', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 52, name: '1 Tesalonicenses',      abbr: '1TE', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 53, name: '2 Tesalonicenses',      abbr: '2TE', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 54, name: '1 Timoteo',             abbr: '1TI', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 55, name: '2 Timoteo',             abbr: '2TI', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 56, name: 'Tito',                  abbr: 'TIT', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 57, name: 'Filemón',               abbr: 'FLM', testament: 'NT', group: 'Cartas de Pablo' },
    { id: 58, name: 'Hebreos',               abbr: 'HEB', testament: 'NT', group: 'Cartas Generales' },
    { id: 59, name: 'Santiago',              abbr: 'SAN', testament: 'NT', group: 'Cartas Generales' },
    { id: 60, name: '1 Pedro',               abbr: '1PE', testament: 'NT', group: 'Cartas Generales' },
    { id: 61, name: '2 Pedro',               abbr: '2PE', testament: 'NT', group: 'Cartas Generales' },
    { id: 62, name: '1 Juan',                abbr: '1JN', testament: 'NT', group: 'Cartas Generales' },
    { id: 63, name: '2 Juan',                abbr: '2JN', testament: 'NT', group: 'Cartas Generales' },
    { id: 64, name: '3 Juan',                abbr: '3JN', testament: 'NT', group: 'Cartas Generales' },
    { id: 65, name: 'Judas',                 abbr: 'JUD', testament: 'NT', group: 'Cartas Generales' },
    { id: 66, name: 'Apocalipsis',           abbr: 'APO', testament: 'NT', group: 'Profecía NT' }
  ];

  const BOOK_BY_ID = {};
  CANONICAL_BOOKS.forEach(b => { BOOK_BY_ID[b.id] = b; });

  // Tabla de regex de nombres para parseo genérico por texto
  const BOOK_NAME_REGEX = [
    { id: 1,  regex: /\bg[eé]nesis\b/i }, { id: 2,  regex: /\b[eé]xodo\b/i },
    { id: 3,  regex: /\blev[ií]tico\b/i }, { id: 4,  regex: /\bn[uú]meros\b/i },
    { id: 5,  regex: /\bdeuteronomio\b/i }, { id: 6,  regex: /\bjosu[eé]\b/i },
    { id: 7,  regex: /\bjueces\b/i }, { id: 8,  regex: /\brut\b/i },
    { id: 9,  regex: /\b1\s*samuel\b/i }, { id: 10, regex: /\b2\s*samuel\b/i },
    { id: 11, regex: /\b1\s*reyes\b/i }, { id: 12, regex: /\b2\s*reyes\b/i },
    { id: 13, regex: /\b1\s*cr[oó]nicas\b/i }, { id: 14, regex: /\b2\s*cr[oó]nicas\b/i },
    { id: 15, regex: /\besdras\b/i }, { id: 16, regex: /\bnehem[ií]as\b/i },
    { id: 17, regex: /\bester\b/i }, { id: 18, regex: /\bjob\b/i },
    { id: 19, regex: /\bsalmos?\b/i }, { id: 20, regex: /\bproverbios\b/i },
    { id: 21, regex: /\beclesiast[eé]s\b/i }, { id: 22, regex: /\bcantar\b/i },
    { id: 23, regex: /\bisa[ií]as\b/i }, { id: 24, regex: /\bjerem[ií]as\b/i },
    { id: 25, regex: /\blamentaciones\b/i }, { id: 26, regex: /\bezequiel\b/i },
    { id: 27, regex: /\bdaniel\b/i }, { id: 28, regex: /\boseas\b/i },
    { id: 29, regex: /\bjoel\b/i }, { id: 30, regex: /\bam[oó]s\b/i },
    { id: 31, regex: /\babd[ií]as\b/i }, { id: 32, regex: /\bjon[aá]s\b/i },
    { id: 33, regex: /\bmiqueas\b/i }, { id: 34, regex: /\bnah[uú]m\b/i },
    { id: 35, regex: /\bhabacuc\b/i }, { id: 36, regex: /\bsofon[ií]as\b/i },
    { id: 37, regex: /\bhageo\b/i }, { id: 38, regex: /\bzacar[ií]as\b/i },
    { id: 39, regex: /\bmalaqu[ií]as\b/i }, { id: 40, regex: /\bmateo\b/i },
    { id: 41, regex: /\bmarcos\b/i }, { id: 42, regex: /\blucas\b/i },
    { id: 43, regex: /\bjuan\b/i }, { id: 44, regex: /\bhechos\b/i },
    { id: 45, regex: /\bromanos\b/i }, { id: 46, regex: /\b1\s*corintios\b/i },
    { id: 47, regex: /\b2\s*corintios\b/i }, { id: 48, regex: /\bg[aá]latas\b/i },
    { id: 49, regex: /\befesios\b/i }, { id: 50, regex: /\bfilipenses\b/i },
    { id: 51, regex: /\bcolosenses\b/i }, { id: 52, regex: /\b1\s*tesalonicenses\b/i },
    { id: 53, regex: /\b2\s*tesalonicenses\b/i }, { id: 54, regex: /\b1\s*timoteo\b/i },
    { id: 55, regex: /\b2\s*timoteo\b/i }, { id: 56, regex: /\btito\b/i },
    { id: 57, regex: /\bfilem[oó]n\b/i }, { id: 58, regex: /\bhebreos\b/i },
    { id: 59, regex: /\bsantiago\b/i }, { id: 60, regex: /\b1\s*pedro\b/i },
    { id: 61, regex: /\b2\s*pedro\b/i }, { id: 62, regex: /\b1\s*juan\b/i },
    { id: 63, regex: /\b2\s*juan\b/i }, { id: 64, regex: /\b3\s*juan\b/i },
    { id: 65, regex: /\bjudas\b/i }, { id: 66, regex: /\bapocalipsis\b/i }
  ];

  async function loadJSZip() {
    if (window.JSZip) return window.JSZip;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => reject(new Error('No se pudo cargar JSZip'));
      document.head.appendChild(s);
    });
  }

  function stripHtml(html) {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function booksMapToArray(booksMap) {
    const books = [];
    for (const bookId of Object.keys(booksMap).map(Number).sort((a, b) => a - b)) {
      const canon = BOOK_BY_ID[bookId];
      if (!canon) continue;
      const chapMap = booksMap[bookId];
      const chapters = Object.keys(chapMap).map(Number).sort((a, b) => a - b)
        .map(chapId => ({
          number: chapId,
          verses: (chapMap[chapId] || []).sort((a, b) => a.number - b.number),
          sections: []
        }))
        .filter(ch => ch.verses.length > 0);
      if (chapters.length > 0) {
        books.push({ id: canon.id, name: canon.name, abbr: canon.abbr, testament: canon.testament, group: canon.group, chapters });
      }
    }
    return books;
  }

  // ══════════════════════════════════════════════════════════════
  // ESTRATEGIA 1: Parseo estructurado por atributos id
  // Formato: id="...htmlv{BB}{CCC}{VVV}" donde BB=libro, CCC=cap, VVV=vers
  // Usado por: SBU, Biblia de estudio esquematizada, y otros EPUBs académicos
  // ══════════════════════════════════════════════════════════════
  function parseHtmlByIds(html) {
    const verses = [];
    // Regex para etiquetas <p> (o <span>) que contengan un id de versículo real
    // "htmlv{BB}{CCC}{VVV}" donde VVV > 0 y NO es "htmlrv" (referencia de navegación)
    const pPattern = /<(?:p|span|div)([^>]*)>([\s\S]*?)<\/(?:p|span|div)>/gi;
    let pMatch;

    while ((pMatch = pPattern.exec(html)) !== null) {
      const pContent = pMatch[2];
      // Buscar anchor de versículo real: htmlv{BB:2}{CCC:3}{VVV:3} (no htmlrv)
      const aMatch = /id="[^"]*htmlv(\d{2})(\d{3})(\d{3})"/.exec(pContent);
      if (!aMatch) continue;

      const bookNum = parseInt(aMatch[1], 10);
      const chapNum = parseInt(aMatch[2], 10);
      const verseNum = parseInt(aMatch[3], 10);

      // Saltar encabezados (VVV=000) o datos fuera de rango
      if (verseNum === 0 || bookNum < 1 || bookNum > 66 || chapNum < 1) continue;
      if (!BOOK_BY_ID[bookNum]) continue;

      const text = stripHtml(pContent);
      // Filtrar si el texto es solo números/espacios (índice de navegación)
      if (text.length < 4 || /^[\d\s,;.]+$/.test(text)) continue;

      verses.push({ bookNum, chapNum, verseNum, text });
    }
    return verses;
  }

  // ══════════════════════════════════════════════════════════════
  // ESTRATEGIA 2: Parseo genérico por texto
  // Para EPUBs/TXTs con formato cap:vers o "Capítulo N" + versículos numerados
  // ══════════════════════════════════════════════════════════════
  function parseTextGeneric(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const booksMap = {};
    let currentBookId = null;
    let currentChapNum = null;

    function ensureChap() {
      if (!booksMap[currentBookId]) booksMap[currentBookId] = {};
      if (!booksMap[currentBookId][currentChapNum]) booksMap[currentBookId][currentChapNum] = [];
    }

    for (const line of lines) {
      // Detectar nombre de libro
      if (!/^\d/.test(line) && line.length < 120) {
        for (const { id, regex } of BOOK_NAME_REGEX) {
          if (regex.test(line)) {
            currentBookId = id;
            currentChapNum = null;
            break;
          }
        }
      }
      if (!currentBookId) continue;

      // Detectar capítulo explícito
      const chapMatch = line.match(/^(?:cap[ií]tulo|salmo)\s*(\d{1,3})/i);
      if (chapMatch) { currentChapNum = parseInt(chapMatch[1], 10); continue; }

      // Versículo con notación cap:vers
      const cvMatch = line.match(/^\[?(\d{1,3})\]?[:.](\d{1,3})\]?[:.-]?\s*(.+)$/);
      if (cvMatch) {
        currentChapNum = parseInt(cvMatch[1], 10);
        const vNum = parseInt(cvMatch[2], 10);
        const vText = cvMatch[3].trim();
        if (vText.length >= 4) { ensureChap(); booksMap[currentBookId][currentChapNum].push({ number: vNum, text: vText }); }
        continue;
      }

      // Versículo suelto (solo número de versículo)
      const vMatch = line.match(/^\[?(\d{1,3})\]?[:.-]?\s*(.+)$/);
      if (vMatch) {
        const vNum = parseInt(vMatch[1], 10);
        const vText = vMatch[2].trim();
        if (vText.length >= 4) {
          if (!currentChapNum) currentChapNum = 1;
          // Auto-avance de capítulo si el versículo 1 se repite con contexto previo
          else if (vNum === 1 && booksMap[currentBookId]?.[currentChapNum]?.length >= 3) {
            currentChapNum++;
          }
          ensureChap();
          booksMap[currentBookId][currentChapNum].push({ number: vNum, text: vText });
        }
      }
    }
    return booksMap;
  }

  window.ClientParser = {
    async parseFile(file, translationName, translationAbbr, onProgress) {
      const isEpub = file.name.endsWith('.epub');
      let finalBooks = [];

      if (isEpub) {
        onProgress(10, 'Descomprimiendo EPUB...');
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(file);

        const htmlFiles = Object.keys(zip.files)
          .filter(k => !zip.files[k].dir && (k.endsWith('.html') || k.endsWith('.xhtml') || k.endsWith('.htm')))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        onProgress(20, `Analizando ${htmlFiles.length} archivos del EPUB...`);

        // ── Intento 1: parseo estructurado por IDs ──────────────────
        const booksMap = {};
        let structuredCount = 0;

        for (let fi = 0; fi < htmlFiles.length; fi++) {
          const html = await zip.files[htmlFiles[fi]].async('string');

          // Rápidamente detectar si contiene IDs de versículo estructurados
          if (/htmlv\d{8}/.test(html)) {
            const verses = parseHtmlByIds(html);
            for (const { bookNum, chapNum, verseNum, text } of verses) {
              if (!booksMap[bookNum]) booksMap[bookNum] = {};
              if (!booksMap[bookNum][chapNum]) booksMap[bookNum][chapNum] = [];
              booksMap[bookNum][chapNum].push({ number: verseNum, text });
              structuredCount++;
            }
          }

          if (fi % 20 === 0) {
            const pct = 20 + Math.floor(fi / htmlFiles.length * 55);
            onProgress(pct, `Procesando archivo ${fi + 1} de ${htmlFiles.length}...`);
          }
        }

        if (structuredCount > 0) {
          onProgress(80, `Indexados ${structuredCount} versículos. Organizando libros...`);
          finalBooks = booksMapToArray(booksMap);
        }

        // ── Intento 2: parseo genérico por texto (fallback) ──────────
        if (finalBooks.length === 0) {
          onProgress(55, 'Intentando extracción por texto plano...');
          let rawText = '';
          for (const path of htmlFiles) {
            const html = await zip.files[path].async('string');
            rawText += '\n' + html
              .replace(/<sup>(\d{1,3})<\/sup>/gi, '\n[$1] ')
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<\/div>/gi, '\n')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
          }
          const textBooksMap = parseTextGeneric(rawText);
          finalBooks = booksMapToArray(textBooksMap);
        }

      } else {
        // Archivo .txt
        onProgress(20, 'Leyendo archivo de texto...');
        const rawText = await file.text();
        onProgress(50, 'Indexando versículos...');
        const textBooksMap = parseTextGeneric(rawText);
        finalBooks = booksMapToArray(textBooksMap);
      }

      onProgress(95, `Completado: ${finalBooks.length} libros encontrados.`);

      if (finalBooks.length === 0) {
        throw new Error('No se pudieron reconocer libros o versículos bíblicos en el archivo. Asegúrate del formato.');
      }

      return {
        id: 'custom_' + Date.now(),
        name: translationName || 'Traducción Importada',
        abbr: (translationAbbr || 'CUST').toUpperCase(),
        books: finalBooks
      };
    }
  };
})();
