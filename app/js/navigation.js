/**
 * navigation.js
 * Gestiona la navegación: sidebar, libros, capítulos, routing por hash.
 * Expone: window.Navigation
 */
(function () {
  'use strict';

  // ── Estado ─────────────────────────────────────────────
  const state = {
    books: [],           // todos los libros (metadatos)
    fullData: null,      // datos completos (bible.json)
    officialData: null,  // respaldo TLA oficial
    activeTranslation: 'TLA',
    currentBook: null,   // objeto libro actual
    currentChapter: null,// número de capítulo actual
    currentData: null,   // datos completos del capítulo
  };

  // ── Cache de DOM ────────────────────────────────────────
  const dom = {
    booksAtList:     () => document.getElementById('books-at-list'),
    booksNtList:     () => document.getElementById('books-nt-list'),
    welcomeScreen:   () => document.getElementById('welcome-screen'),
    chapterContent:  () => document.getElementById('chapter-content'),
    loadingScreen:   () => document.getElementById('loading-screen'),
    chapterVerses:   () => document.getElementById('chapter-verses'),
    topbarBook:      () => document.getElementById('topbar-book'),
    topbarChapter:   () => document.getElementById('topbar-chapter'),
    topbarSection:   () => document.getElementById('topbar-section'),
    chapterPickerLabel: () => document.getElementById('chapter-picker-label'),
    chapterPickerModal: () => document.getElementById('chapter-picker-modal'),
    chapterPickerGrid:  () => document.getElementById('chapter-picker-grid'),
    chapterModalBookName: () => document.getElementById('chapter-modal-book-name'),
    prevChapterBtn:  () => document.getElementById('btn-prev-chapter'),
    nextChapterBtn:  () => document.getElementById('btn-next-chapter'),
    prevBottomBtn:   () => document.getElementById('btn-prev-bottom'),
    nextBottomBtn:   () => document.getElementById('btn-next-bottom'),
    prevLabel:       () => document.getElementById('prev-label'),
    nextLabel:       () => document.getElementById('next-label'),
    sidebar:         () => document.getElementById('sidebar'),
    sidebarOverlay:  () => document.getElementById('sidebar-overlay'),
    btnOpenSidebar:  () => document.getElementById('btn-open-sidebar'),
    btnCloseSidebar: () => document.getElementById('btn-close-sidebar'),
    tabAt:           () => document.getElementById('tab-at'),
    tabNt:           () => document.getElementById('tab-nt'),
    panelAt:         () => document.getElementById('books-at'),
    panelNt:         () => document.getElementById('books-nt'),
    searchInput:     () => document.getElementById('search-input'),
    btnStartGenesis: () => document.getElementById('btn-start-genesis'),
    btnChapterPicker:() => document.getElementById('btn-chapter-picker'),
    chapterModalBackdrop: () => document.getElementById('chapter-modal-backdrop'),
  };

  // ── Cargar libros desde JSON estático ──────────────────
  async function loadBooks() {
    try {
      const res = await fetch('/data/bible.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.officialData = data;
      state.fullData = data;
      state.books = data.books.map(b => ({
        abbr: b.abbr,
        name: b.name,
        testament: b.testament,
        group: b.group,
        chapterCount: b.chapters.length
      }));
      renderBookLists();
      restoreFromHash();
      initTranslations();
    } catch (err) {
      showError('No se pudo cargar la Biblia. Verifica que /data/bible.json exista. (' + err.message + ')');
    }
  }

  // ── Gestor de Traducciones Custom ──────────────────────
  async function initTranslations() {
    const select = document.getElementById('translation-select');
    if (!select || !window.CustomStorage) return;

    async function refreshSelect() {
      select.innerHTML = '<option value="TLA">TLA (Oficial con Audio)</option>';
      try {
        const customs = await window.CustomStorage.getAllBiblesMetadata();
        for (const c of customs) {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `${c.abbr} — ${c.name} (Custom)`;
          select.appendChild(opt);
        }
      } catch (e) { console.error(e); }
    }

    await refreshSelect();

    select.addEventListener('change', async (e) => {
      const val = e.target.value;
      state.activeTranslation = val;
      showLoading();
      if (val === 'TLA') {
        state.fullData = state.officialData;
      } else {
        const custData = await window.CustomStorage.getBible(val);
        if (custData) state.fullData = custData;
      }
      state.books = state.fullData.books.map(b => ({
        abbr: b.abbr,
        name: b.name,
        testament: b.testament,
        group: b.group,
        chapterCount: b.chapters.length
      }));
      renderBookLists();
      navigateToChapter('GEN', 1);
    });

    // Modal Importación
    const modal = document.getElementById('custom-bible-modal');
    const btnOpen = document.getElementById('btn-add-bible');
    const btnClose = document.getElementById('btn-close-custom-modal');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('custom-file-input');
    const btnStart = document.getElementById('btn-start-import');
    const nameInput = document.getElementById('custom-bible-name');
    const abbrInput = document.getElementById('custom-bible-abbr');
    const progWrap = document.getElementById('parse-progress-wrap');
    const statusText = document.getElementById('parse-status-text');
    const percentText = document.getElementById('parse-percent-text');
    const progBar = document.getElementById('parse-progress-bar');

    let selectedFile = null;

    if (btnOpen) btnOpen.addEventListener('click', () => { modal.style.display = 'flex'; });
    if (btnClose) btnClose.addEventListener('click', () => { modal.style.display = 'none'; });

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (ev) => { ev.preventDefault(); dropZone.style.borderColor = '#d4af37'; });
      dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#3f3f46'; });
      dropZone.addEventListener('drop', (ev) => {
        ev.preventDefault();
        dropZone.style.borderColor = '#3f3f46';
        if (ev.dataTransfer.files.length > 0) {
          selectedFile = ev.dataTransfer.files[0];
          dropZone.querySelector('p:nth-child(2)').textContent = 'Archivo: ' + selectedFile.name;
        }
      });
      fileInput.addEventListener('change', (ev) => {
        if (ev.target.files.length > 0) {
          selectedFile = ev.target.files[0];
          dropZone.querySelector('p:nth-child(2)').textContent = 'Archivo: ' + selectedFile.name;
        }
      });
    }

    if (btnStart) btnStart.addEventListener('click', async () => {
      if (!selectedFile) { alert('Selecciona un archivo .epub o .txt primero'); return; }
      btnStart.disabled = true;
      progWrap.style.display = 'block';

      try {
        const parsed = await window.ClientParser.parseFile(
          selectedFile,
          nameInput.value,
          abbrInput.value,
          (pct, msg) => {
            statusText.textContent = msg;
            percentText.textContent = pct + '%';
            progBar.style.width = pct + '%';
          }
        );
        
        statusText.textContent = 'Guardando en base de datos local...';
        await window.CustomStorage.saveBible(parsed);
        progBar.style.width = '100%';
        percentText.textContent = '100%';
        
        alert('¡Biblia importada con éxito!');
        modal.style.display = 'none';
        await refreshSelect();
        select.value = parsed.id;
        select.dispatchEvent(new Event('change'));
      } catch (err) {
        alert('Error importando: ' + err.message);
      } finally {
        btnStart.disabled = false;
        progWrap.style.display = 'none';
      }
    });
  }


  // ── Renderizar listas de libros ─────────────────────────
  function renderBookLists() {
    const atBooks = state.books.filter(b => b.testament === 'AT');
    const ntBooks = state.books.filter(b => b.testament === 'NT');

    renderBookGroup(dom.booksAtList(), atBooks);
    renderBookGroup(dom.booksNtList(), ntBooks);
  }

  function renderBookGroup(container, books) {
    if (!container) return;
    container.innerHTML = '';

    // Agrupar por grupo
    const groups = {};
    for (const book of books) {
      if (!groups[book.group]) groups[book.group] = [];
      groups[book.group].push(book);
    }

    for (const [groupName, groupBooks] of Object.entries(groups)) {
      const groupEl = document.createElement('div');
      groupEl.className = 'book-group';

      const label = document.createElement('div');
      label.className = 'book-group__label';
      label.textContent = groupName;
      groupEl.appendChild(label);

      for (const book of groupBooks) {
        const btn = document.createElement('button');
        btn.className = 'book-btn';
        btn.id = `book-btn-${book.abbr}`;
        btn.dataset.abbr = book.abbr;
        btn.setAttribute('aria-label', `${book.name}, ${book.chapterCount} capítulos`);
        btn.innerHTML = `
          <span class="book-btn__abbr">${book.abbr}</span>
          <span class="book-btn__name">${book.name}</span>
          <span class="book-btn__chapters">${book.chapterCount}</span>
        `;
        btn.addEventListener('click', () => {
          navigateToBook(book.abbr, 1);
          closeSidebar();
        });
        groupEl.appendChild(btn);
      }

      container.appendChild(groupEl);
    }
  }

  // ── Navegar a libro/capítulo ────────────────────────────
  async function navigateToBook(abbr, chapter) {
    const book = state.books.find(b => b.abbr === abbr.toUpperCase());
    if (!book) return;

    await navigateToChapter(abbr, chapter || 1);
  }

  async function navigateToChapter(abbr, chapNum) {
    abbr = abbr.toUpperCase();
    chapNum = parseInt(chapNum, 10);

    showLoading();

    try {
      if (!state.fullData) throw new Error("Datos no cargados");

      const book = state.fullData.books.find(b => b.abbr === abbr);
      if (!book) throw new Error("Libro no encontrado");

      const chapter = book.chapters.find(c => c.number === chapNum);
      if (!chapter) throw new Error("Capítulo no encontrado");

      // Construir las rutas estáticas predecibles de audio
      const isCustom = state.activeTranslation !== 'TLA';
      const audioFile = `${book.abbr.toLowerCase()}_${String(chapNum).padStart(3, '0')}`;
      
      const data = {
        book: {
          abbr: book.abbr,
          name: book.name,
          chapterCount: book.chapters.length,
          testament: book.testament
        },
        chapter: chapNum,
        verses: chapter.verses,
        sections: chapter.sections || [],
        isCustom: isCustom,
        audio: isCustom ? null : `/public/audio/${book.abbr}/${audioFile}.opus`,
        audioHQ: isCustom ? null : `https://vps-bibliatts.com/public/audio_hq/${book.abbr}/${audioFile}.opus`,
        timestamps: isCustom ? null : `/public/timestamps/${book.abbr}/${audioFile}.json`
      };

      state.currentBook = data.book;
      state.currentChapter = chapNum;
      state.currentData = data;

      // Actualizar hash sin disparar popstate
      const hash = `#${abbr.toLowerCase()}/${chapNum}`;
      if (location.hash !== hash) {
        history.pushState(null, '', hash);
      }

      renderChapter(data);
      updateNavButtons();
      updateSidebarActive(abbr);
      updateTopbar(data.book.name, chapNum);
      initSectionObserver();

      // Notificar al player sobre el nuevo capítulo
      if (window.Player) {
        window.Player.loadChapter(data);
      }

    } catch (err) {
      showError('Error cargando el capítulo: ' + err.message);
    }
  }

  // ── Intersection Observer para Subtítulos ─────────────────
  let sectionObserver = null;
  let activeSections = new Map();

  function initSectionObserver() {
    if (sectionObserver) {
      sectionObserver.disconnect();
    }
    
    activeSections.clear();
    const sectionTitleSpan = dom.topbarSection();
    sectionTitleSpan.textContent = '';
    sectionTitleSpan.classList.remove('is-visible');

    const titles = document.querySelectorAll('.section-title');
    if (titles.length === 0) return;

    // Opciones para el observer: el margen detecta cuando el titulo pasa cerca del topbar
    const options = {
      root: document.getElementById('reading-area'),
      rootMargin: '-80px 0px -80% 0px',
      threshold: 0
    };

    sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          activeSections.set(entry.target, entry.target.textContent);
        } else {
          activeSections.delete(entry.target);
        }
      });

      // El titulo activo es el más cercano al tope (primer elemento en el map o en el DOM)
      // Como map conserva el orden de inserción y el DOM está en orden, buscamos el activo más alto
      updateActiveSection();
    }, options);

    titles.forEach(title => sectionObserver.observe(title));
  }

  function updateActiveSection() {
    const titles = Array.from(document.querySelectorAll('.section-title'));
    // Encontrar el título más cercano al topbar que haya pasado o esté en la zona
    let currentTitle = null;
    
    // Una lógica más simple: iteramos todos y vemos su posición respecto al scroll
    const readingArea = document.getElementById('reading-area');
    const scrollPos = readingArea.scrollTop + 100; // Offset para el topbar
    
    for (let i = titles.length - 1; i >= 0; i--) {
      if (titles[i].offsetTop <= scrollPos) {
        currentTitle = titles[i].textContent;
        break;
      }
    }
    
    const sectionSpan = dom.topbarSection();
    
    if (currentTitle) {
      sectionSpan.textContent = currentTitle;
      sectionSpan.style.opacity = '1';
    } else {
      sectionSpan.textContent = '';
      sectionSpan.style.opacity = '0';
    }
  }

  // Agregamos un listener al scroll del área de lectura para actualizar el título exacto
  document.getElementById('reading-area').addEventListener('scroll', () => {
    // Throttled update
    if (!window.scrollTimeout) {
      window.scrollTimeout = setTimeout(() => {
        updateActiveSection();
        window.scrollTimeout = null;
      }, 50);
    }
  }, { passive: true });


  // ── Renderizar capítulo ─────────────────────────────────
  function renderChapter(data) {
    const { book, chapter, verses, sections } = data;
    state.versesData = verses || [];

    // Mostrar contenedor
    hideAll();
    dom.chapterContent().hidden = false;

    // Versículos
    const container = dom.chapterVerses();
    container.innerHTML = '';

    // Construir mapa de secciones: por versiculo index
    const sectionMap = {};
    if (sections) {
      for (const sec of sections) {
        const key = sec.afterVerse;
        if (!sectionMap[key]) sectionMap[key] = [];
        sectionMap[key].push(sec.title);
      }
    }

    let animDelay = 0;
    for (let i = 0; i < verses.length; i++) {
      const verse = verses[i];
      const prevVerseNum = i === 0 ? -1 : verses[i - 1].number;

      // Insertar títulos de sección que van después del versículo anterior
      const titlesAfterPrev = sectionMap[prevVerseNum] || [];
      if (i === 0 && sectionMap[0]) {
        for (const title of sectionMap[0]) {
          container.appendChild(createSectionTitle(title));
        }
      }
      if (titlesAfterPrev.length && i > 0) {
        for (const title of titlesAfterPrev) {
          container.appendChild(createSectionTitle(title));
        }
      }

      const verseEl = createVerseElement(verse, animDelay);
      container.appendChild(verseEl);
      animDelay += 15; // ms de delay entre versículos
    }
  }

  function createSectionTitle(title) {
    const el = document.createElement('div');
    el.className = 'section-title';
    el.textContent = title;
    return el;
  }

  function createVerseElement(verse, animDelay) {
    const el = document.createElement('div');
    el.className = 'verse';
    el.id = `verse-${verse.number}`;
    el.dataset.verse = verse.number;
    el.style.animationDelay = `${animDelay}ms`;

    const numEl = document.createElement('span');
    numEl.className = 'verse__number';
    numEl.textContent = verse.label || verse.number;
    numEl.setAttribute('aria-hidden', 'true');

    const textEl = document.createElement('span');
    textEl.className = 'verse__text';
    textEl.textContent = verse.text;

    el.appendChild(numEl);
    el.appendChild(textEl);

    // Click en versículo → saltar al tiempo de ese versículo en el audio
    el.addEventListener('click', () => {
      if (window.Player) {
        window.Player.seekToVerse(verse.number);
      }
    });

    return el;
  }

  // ── Resaltar versículo activo ───────────────────────────
  let lastActiveVerse = null;

  function highlightVerse(verseNum) {
    if (lastActiveVerse === verseNum) return;

    // Quitar highlight anterior
    const prev = document.querySelector('.verse--active');
    if (prev) prev.classList.remove('verse--active');

    // Aplicar nuevo highlight
    const el = document.getElementById(`verse-${verseNum}`);
    if (el) {
      el.classList.add('verse--active');
      // Scroll suave solo si está fuera del viewport
      const rect = el.getBoundingClientRect();
      const viewH = window.innerHeight;
      const topbar = 56;
      const playerH = 120;
      if (rect.top < topbar + 20 || rect.bottom > viewH - playerH - 20) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    lastActiveVerse = verseNum;
  }

  // ── UI helpers ──────────────────────────────────────────
  function hideAll() {
    dom.welcomeScreen().hidden = true;
    dom.chapterContent().hidden = true;
    dom.loadingScreen().hidden = true;
  }

  function showLoading() {
    hideAll();
    dom.loadingScreen().hidden = false;
  }

  function showError(msg) {
    hideAll();
    dom.welcomeScreen().hidden = false;
    dom.welcomeScreen().innerHTML = `
      <div class="welcome-screen__icon">⚠️</div>
      <h2 class="welcome-screen__title">Ocurrió un problema</h2>
      <p class="welcome-screen__hint" style="color: hsl(0, 80%, 65%); margin-top: 20px;">${msg}</p>
    `;
  }

  function updateTopbar(bookName, chapNum) {
    dom.topbarBook().textContent = bookName;
    dom.topbarChapter().textContent = `Capítulo ${chapNum}`;
    dom.chapterPickerLabel().textContent = chapNum;
  }

  function updateSidebarActive(abbr) {
    document.querySelectorAll('.book-btn--active').forEach(el => el.classList.remove('book-btn--active'));
    const btn = document.getElementById(`book-btn-${abbr}`);
    if (btn) {
      btn.classList.add('book-btn--active');
      // Asegurar que el tab correcto esté activo
      const book = state.books.find(b => b.abbr === abbr);
      if (book) {
        if (book.testament === 'NT') activateTab('nt');
        else activateTab('at');
      }
    }
  }

  function updateNavButtons() {
    if (!state.currentBook || !state.currentChapter) return;

    const book = state.books.find(b => b.abbr === state.currentBook.abbr);
    if (!book) return;

    const prevExists = state.currentChapter > 1;
    const nextExists = state.currentChapter < book.chapterCount;

    dom.prevChapterBtn().disabled = !prevExists;
    dom.nextChapterBtn().disabled = !nextExists;
    dom.prevBottomBtn().disabled = !prevExists;
    dom.nextBottomBtn().disabled = !nextExists;

    if (prevExists) {
      dom.prevLabel().textContent = `Capítulo ${state.currentChapter - 1}`;
    }
    if (nextExists) {
      dom.nextLabel().textContent = `Capítulo ${state.currentChapter + 1}`;
    }
  }

  // ── Tabs AT / NT ────────────────────────────────────────
  function activateTab(which) {
    const tabAt = dom.tabAt();
    const tabNt = dom.tabNt();
    const panelAt = dom.panelAt();
    const panelNt = dom.panelNt();

    if (which === 'at') {
      tabAt.classList.add('sidebar__tab--active');
      tabNt.classList.remove('sidebar__tab--active');
      tabAt.setAttribute('aria-selected', 'true');
      tabNt.setAttribute('aria-selected', 'false');
      panelAt.classList.remove('books-panel--hidden');
      panelNt.classList.add('books-panel--hidden');
    } else {
      tabNt.classList.add('sidebar__tab--active');
      tabAt.classList.remove('sidebar__tab--active');
      tabNt.setAttribute('aria-selected', 'true');
      tabAt.setAttribute('aria-selected', 'false');
      panelNt.classList.remove('books-panel--hidden');
      panelAt.classList.add('books-panel--hidden');
    }
  }

  // ── Sidebar móvil ────────────────────────────────────────
  function openSidebar() {
    document.getElementById('sidebar').classList.add('sidebar--open');
    dom.sidebarOverlay().classList.add('sidebar-overlay--active');
    dom.sidebarOverlay().style.display = 'block';
    dom.sidebarOverlay().setAttribute('aria-hidden', 'false');
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('sidebar--open');
    dom.sidebarOverlay().classList.remove('sidebar-overlay--active');
    setTimeout(() => {
      dom.sidebarOverlay().style.display = 'none';
      dom.sidebarOverlay().setAttribute('aria-hidden', 'true');
    }, 300);
  }

  // ── Modal selector de capítulo ──────────────────────────
  function openChapterModal() {
    if (!state.currentBook) return;

    const book = state.books.find(b => b.abbr === state.currentBook.abbr);
    if (!book) return;

    dom.chapterModalBookName().textContent = book.name;

    const grid = dom.chapterPickerGrid();
    grid.innerHTML = '';

    for (let i = 1; i <= book.chapterCount; i++) {
      const btn = document.createElement('button');
      btn.className = 'chapter-grid-btn' + (i === state.currentChapter ? ' chapter-grid-btn--active' : '');
      btn.textContent = i;
      btn.setAttribute('aria-label', `Capítulo ${i}`);
      btn.addEventListener('click', () => {
        closeChapterModal();
        navigateToChapter(state.currentBook.abbr, i);
      });
      grid.appendChild(btn);
    }

    dom.chapterPickerModal().hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeChapterModal() {
    dom.chapterPickerModal().hidden = true;
    document.body.style.overflow = '';
  }

  // ── Búsqueda de libros ──────────────────────────────────
  function filterBooks(query) {
    const q = query.toLowerCase().trim();
    const allBtns = document.querySelectorAll('.book-btn');
    allBtns.forEach(btn => {
      const name = btn.querySelector('.book-btn__name').textContent.toLowerCase();
      const abbr = btn.dataset.abbr.toLowerCase();
      const match = !q || name.includes(q) || abbr.includes(q);
      btn.style.display = match ? '' : 'none';
    });

    // Mostrar todos los grupos con al menos un libro visible
    document.querySelectorAll('.book-group').forEach(group => {
      const visible = [...group.querySelectorAll('.book-btn')].some(b => b.style.display !== 'none');
      group.style.display = visible ? '' : 'none';
    });
  }

  // ── Routing por hash ────────────────────────────────────
  function restoreFromHash() {
    const hash = location.hash.replace('#', '');
    if (hash) {
      const parts = hash.split('/');
      if (parts.length >= 2) {
        navigateToChapter(parts[0].toUpperCase(), parseInt(parts[1], 10));
        return;
      }
    }
    // Default: cargar Génesis 1 en lugar de la pantalla de bienvenida
    navigateToChapter('GEN', 1);
  }

  // ── Inicialización ──────────────────────────────────────
  function init() {
    loadBooks();

    // Tabs
    dom.tabAt().addEventListener('click', () => activateTab('at'));
    dom.tabNt().addEventListener('click', () => activateTab('nt'));

    // Sidebar Drawer Toggle
    dom.btnOpenSidebar().addEventListener('click', openSidebar);
    dom.btnCloseSidebar().addEventListener('click', closeSidebar);
    dom.sidebarOverlay().addEventListener('click', closeSidebar);

    // Efecto compacto (Dynamic Island) al hacer scroll hacia los versículos
    let lastScrollY = dom.chapterContent().parentElement.scrollTop || 0;
    const topbar = document.getElementById('topbar');
    const readingArea = document.getElementById('reading-area');
    
    readingArea.addEventListener('scroll', () => {
      const currentScrollY = readingArea.scrollTop;
      
      // Añadir sombra si no estamos arriba
      if (currentScrollY > 10) {
        topbar.classList.add('topbar--scrolled');
      } else {
        topbar.classList.remove('topbar--scrolled');
      }
      
      // Efecto compacto (Dynamic Island) al hacer scroll hacia los versículos
      if (currentScrollY > 60) {
        topbar.classList.add('topbar--compact');
      } else {
        topbar.classList.remove('topbar--compact');
      }
      
      lastScrollY = currentScrollY;
    }, { passive: true });

    // Búsqueda
    dom.searchInput().addEventListener('input', (e) => filterBooks(e.target.value));

    // Navegación capítulo anterior/siguiente
    dom.prevChapterBtn().addEventListener('click', () => {
      if (state.currentChapter > 1) navigateToChapter(state.currentBook.abbr, state.currentChapter - 1);
    });
    dom.nextChapterBtn().addEventListener('click', () => {
      const book = state.books.find(b => b.abbr === state.currentBook?.abbr);
      if (book && state.currentChapter < book.chapterCount) {
        navigateToChapter(state.currentBook.abbr, state.currentChapter + 1);
      }
    });
    dom.prevBottomBtn().addEventListener('click', () => {
      if (state.currentChapter > 1) navigateToChapter(state.currentBook.abbr, state.currentChapter - 1);
    });
    dom.nextBottomBtn().addEventListener('click', () => {
      const book = state.books.find(b => b.abbr === state.currentBook?.abbr);
      if (book && state.currentChapter < book.chapterCount) {
        navigateToChapter(state.currentBook.abbr, state.currentChapter + 1);
      }
    });

    // Modal capítulo
    dom.btnChapterPicker().addEventListener('click', openChapterModal);
    dom.chapterModalBackdrop().addEventListener('click', closeChapterModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeChapterModal();
    });

    // Routing: popstate (botón atrás/adelante del browser)
    window.addEventListener('popstate', () => restoreFromHash());
  }

  function getNextChapterGlobal(abbr, chapter) {
    if (!state.books || state.books.length === 0) return null;
    const bookIndex = state.books.findIndex(b => b.abbr === abbr);
    if (bookIndex === -1) return null;

    const book = state.books[bookIndex];
    if (chapter < book.chapterCount) {
      return { abbr: book.abbr, chapter: chapter + 1 };
    } else {
      if (bookIndex + 1 < state.books.length) {
        return { abbr: state.books[bookIndex + 1].abbr, chapter: 1 };
      } else {
        return null; // Fin
      }
    }
  }

  // ── API pública ─────────────────────────────────────────
  window.Navigation = {
    highlightVerse,
    navigateToChapter,
    getCurrentData: () => state.currentData,
    getCurrentBook: () => state.currentBook,
    getCurrentChapter: () => state.currentChapter,
    getBooks: () => state.books,
    getNextChapterGlobal
  };
  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
