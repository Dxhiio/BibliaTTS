/**
 * player.js
 * Reproductor de audio con sincronización de versículos.
 * Usa timestamps.json para mapear cada millisegundo → versículo.
 * Expone: window.Player
 */
(function () {
  'use strict';

  // ── Estado interno ──────────────────────────────────────
  const state = {
    audioEl:     null,
    isPlaying:   false,
    isMuted:     false,
    volume:      1,
    speed:       1,
    speedSteps:  [0.75, 1, 1.25, 1.5, 1.75, 2],
    speedIndex:  1,    // índice en speedSteps (1 = 1×)
    timestamps:  null, // datos de timestamps del capítulo actual
    words:       [],   // array de { word, verse, start_ms, end_ms }
    isDragging:  false,
    currentChapterData: null,
    isHQ:        localStorage.getItem('audio_hq') === 'true',
  };

  // ── Cache DOM ────────────────────────────────────────────
  const el = {
    player:      () => document.getElementById('audio-player'),
    audio:       () => document.getElementById('audio-element'),
    btnPlay:     () => document.getElementById('btn-play'),
    iconPlay:    () => document.getElementById('icon-play'),
    iconPause:   () => document.getElementById('icon-pause'),
    btnRewind:   () => document.getElementById('btn-rewind'),
    btnForward:  () => document.getElementById('btn-forward'),
    btnSpeed:    () => document.getElementById('btn-speed'),
    speedLabel:  () => document.getElementById('speed-label'),
    btnHQ:       () => document.getElementById('btn-hq'),
    btnMute:     () => document.getElementById('btn-mute'),
    iconVolOn:   () => document.getElementById('icon-vol-on'),
    iconVolOff:  () => document.getElementById('icon-vol-off'),
    volSlider:   () => document.getElementById('volume-slider'),
    progressBar: () => document.getElementById('progress-bar'),
    progressFill:() => document.getElementById('progress-fill'),
    progressThumb:() => document.getElementById('progress-thumb'),
    currentTime: () => document.getElementById('player-current-time'),
    totalTime:   () => document.getElementById('player-total-time'),
    playerBook:  () => document.getElementById('player-book-name'),
    playerChap:  () => document.getElementById('player-chapter-name'),
  };

  // ── Formatear tiempo ─────────────────────────────────────
  function formatTime(secs) {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Búsqueda binaria de versículo por tiempo ─────────────
  function getVerseAtTime(ms) {
    if (!state.words || state.words.length === 0) return null;

    let lo = 0, hi = state.words.length - 1;
    let result = null;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const word = state.words[mid];
      if (word.start_ms <= ms) {
        result = word;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return result ? result.verse : null;
  }

  // ── Cargar nuevo capítulo ────────────────────────────────
  async function loadChapter(data) {
    state.currentChapterData = data;
    state.words = [];
    state.timestamps = null;

    const audioEl = el.audio();
    const playerEl = el.player();

    // Si la biblia es Custom, usar narrador nativo TTS offline
    if (data.isCustom) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      playerEl.hidden = false;
      el.playerBook().textContent = data.book.name;
      el.playerChap().textContent = `Capítulo ${data.chapter}`;
      audioEl.src = '';
      state.isPlaying = false;
      updatePlayIcon();
      return;
    }

    // Si no hay audio, ocultar player
    if (!data.audio) {
      playerEl.hidden = true;
      audioEl.src = '';
      return;
    }

    // Actualizar info del reproductor
    el.playerBook().textContent = data.book.name;
    el.playerChap().textContent = `Capítulo ${data.chapter}`;

    // Seleccionar mejor fuente de audio según preferencia y disponibilidad
    const src = getBestAudioPath(data);

    // Si no hay source válida final (raro, pero por si acaso falla el fallback)
    if (!src) {
      playerEl.hidden = true;
      audioEl.src = '';
      return;
    }

    // Cargar audio
    audioEl.src = src;
    audioEl.playbackRate = state.speed;
    audioEl.volume = state.isMuted ? 0 : state.volume;
    audioEl.load();

    // Mostrar player
    playerEl.hidden = false;

    // Pausar si estaba reproduciendo
    if (state.isPlaying) {
      pause();
    }

    // Reset UI de progreso
    el.progressFill().style.width = '0%';
    el.currentTime().textContent = '0:00';
    el.totalTime().textContent = '0:00';
    el.progressBar().setAttribute('aria-valuenow', 0);

    // Cargar timestamps
    if (data.timestamps) {
      try {
        const tsRes = await fetch(data.timestamps);
        if (tsRes.ok) {
          const tsData = await tsRes.json();
          state.words = tsData.words || [];
          state.timestamps = tsData;
        }
      } catch (err) {
        console.warn('No se cargaron timestamps:', err.message);
      }
    }
  }

  // ── Reproducción Custom TTS ──────────────────────────────
  let ttsUtterance = null;
  function startCustomTTS() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const verses = state.currentChapterData?.verses || [];
    let idx = 0;

    function speakNext() {
      if (!state.isPlaying || idx >= verses.length) {
        state.isPlaying = false;
        updatePlayIcon();
        return;
      }
      const v = verses[idx];
      ttsUtterance = new SpeechSynthesisUtterance(v.text);
      ttsUtterance.rate = state.speed || 1.0;
      ttsUtterance.lang = 'es-ES';
      ttsUtterance.onstart = () => {
        if (window.Navigation?.highlightVerse) {
          window.Navigation.highlightVerse(v.number);
        }
      };
      ttsUtterance.onend = () => {
        idx++;
        if (state.isPlaying) speakNext();
      };
      ttsUtterance.onerror = () => {
        idx++;
        if (state.isPlaying) speakNext();
      };
      window.speechSynthesis.speak(ttsUtterance);
    }

    speakNext();
  }

  // ── Reproducción ─────────────────────────────────────────
  function play() {
    if (state.currentChapterData?.isCustom) {
      if (window.speechSynthesis?.paused) {
        window.speechSynthesis.resume();
      } else {
        startCustomTTS();
      }
      state.isPlaying = true;
      updatePlayIcon();
      return;
    }

    const audioEl = el.audio();
    if (!audioEl.src || audioEl.src === window.location.href) return;

    audioEl.play().then(() => {
      state.isPlaying = true;
      updatePlayIcon();
    }).catch(err => {
      console.warn('Error al reproducir:', err);
    });
  }

  function pause() {
    if (state.currentChapterData?.isCustom) {
      if (window.speechSynthesis) window.speechSynthesis.pause();
      state.isPlaying = false;
      updatePlayIcon();
      return;
    }

    el.audio().pause();
    state.isPlaying = false;
    updatePlayIcon();
  }

  function togglePlay() {
    if (state.isPlaying) pause();
    else play();
  }

  function updatePlayIcon() {
    if (state.isPlaying) {
      el.iconPlay().style.display = 'none';
      el.iconPause().style.display = '';
      el.btnPlay().setAttribute('aria-label', 'Pausar');
    } else {
      el.iconPlay().style.display = '';
      el.iconPause().style.display = 'none';
      el.btnPlay().setAttribute('aria-label', 'Reproducir');
    }
  }

  // ── Velocidad ────────────────────────────────────────────
  function cycleSpeed() {
    state.speedIndex = (state.speedIndex + 1) % state.speedSteps.length;
    state.speed = state.speedSteps[state.speedIndex];
    el.audio().playbackRate = state.speed;
    const label = state.speed === 1 ? '1×' : `${state.speed}×`;
    el.speedLabel().textContent = label;
  }

  // ── Volumen ──────────────────────────────────────────────
  function toggleMute() {
    state.isMuted = !state.isMuted;
    el.audio().volume = state.isMuted ? 0 : state.volume;
    el.iconVolOn().style.display = state.isMuted ? 'none' : '';
    el.iconVolOff().style.display = state.isMuted ? '' : 'none';
    el.btnMute().setAttribute('aria-label', state.isMuted ? 'Activar sonido' : 'Silenciar');
  }

  function setVolume(value) {
    state.volume = parseFloat(value);
    if (!state.isMuted) el.audio().volume = state.volume;
  }

  // ── Calidad HQ ───────────────────────────────────────────
  function getBestAudioPath(data) {
    if (!data) return null;
    if (state.isHQ && data.audioHQ) return data.audioHQ;
    if (!state.isHQ && data.audio) return data.audio;
    // Fallback cruzado
    return data.audio || data.audioHQ;
  }

  function updateHQButton() {
    const btn = el.btnHQ();
    if (!btn) return;
    if (state.isHQ) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }

  function toggleHQ() {
    state.isHQ = !state.isHQ;
    localStorage.setItem('audio_hq', state.isHQ ? 'true' : 'false');
    updateHQButton();

    if (state.currentChapterData) {
      const newSrc = getBestAudioPath(state.currentChapterData);
      const audioEl = el.audio();
      
      // Si el source cambió realmente (para evitar reload innecesario)
      if (newSrc && !audioEl.src.endsWith(newSrc)) {
        const currentTime = audioEl.currentTime;
        const wasPlaying = state.isPlaying;
        
        audioEl.src = newSrc;
        audioEl.currentTime = currentTime;
        
        if (wasPlaying) {
          audioEl.play().catch(console.error);
        }
      }
    }
  }

  // ── Saltar a versículo ───────────────────────────────────
  function seekToVerse(verseNum) {
    if (!state.words.length) return;

    // Encontrar la primera palabra de ese versículo
    const word = state.words.find(w => w.verse === verseNum);
    if (!word) return;

    el.audio().currentTime = word.start_ms / 1000;
    if (!state.isPlaying) play();
  }

  // ── Actualizar barra de progreso ─────────────────────────
  function updateProgressBar(currentSec, totalSec) {
    if (isNaN(totalSec) || totalSec <= 0) return;
    const pct = Math.min((currentSec / totalSec) * 100, 100);
    el.progressFill().style.width = `${pct}%`;
    el.progressBar().setAttribute('aria-valuenow', Math.round(pct));
    el.currentTime().textContent = formatTime(currentSec);
    el.totalTime().textContent = formatTime(totalSec);
  }

  // ── Seek desde barra de progreso ─────────────────────────
  function getSeekTime(e) {
    const rect = el.progressBar().getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    const ratio = Math.max(0, Math.min(x / rect.width, 1));
    return ratio * el.audio().duration;
  }

  // ── Eventos del audio element ────────────────────────────
  function bindAudioEvents() {
    const audioEl = el.audio();

    audioEl.addEventListener('timeupdate', () => {
      if (state.isDragging) return;
      const cur = audioEl.currentTime;
      const dur = audioEl.duration;
      updateProgressBar(cur, dur);

      // Sincronizar versículo
      const ms = cur * 1000;
      const verse = getVerseAtTime(ms);
      if (verse !== null && window.Navigation) {
        window.Navigation.highlightVerse(verse);
      }
    });

    audioEl.addEventListener('loadedmetadata', () => {
      el.totalTime().textContent = formatTime(audioEl.duration);
    });

    audioEl.addEventListener('ended', () => {
      state.isPlaying = false;
      updatePlayIcon();
      // Auto-avanzar al siguiente capítulo
      const nav = window.Navigation;
      if (nav) {
        const curData = nav.getCurrentData();
        const curBook = nav.getCurrentBook();
        const curChap = nav.getCurrentChapter();
        if (curData && curBook) {
          // Buscar cuántos capítulos tiene el libro
          // (el player no tiene la lista de libros, usamos currentData)
          // Al terminar el último capítulo, simplemente nos detenemos
          nav.navigateToChapter(curBook.abbr, curChap + 1)
            .catch(() => {}); // Silenciar error si no hay capítulo siguiente
        }
      }
    });

    audioEl.addEventListener('play', () => { state.isPlaying = true; updatePlayIcon(); });
    audioEl.addEventListener('pause', () => { state.isPlaying = false; updatePlayIcon(); });
    audioEl.addEventListener('error', (e) => {
      console.warn('Error de audio:', e);
      state.isPlaying = false;
      updatePlayIcon();
    });
  }

  // ── Eventos de la barra de progreso ──────────────────────
  function bindProgressEvents() {
    const bar = el.progressBar();

    function onSeekStart(e) {
      state.isDragging = true;
      const time = getSeekTime(e.type.includes('touch') ? e : e);
      updateProgressBar(time, el.audio().duration);
    }

    function onSeekMove(e) {
      if (!state.isDragging) return;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      if (clientX === undefined) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
      const time = ratio * el.audio().duration;
      updateProgressBar(time, el.audio().duration);
    }

    function onSeekEnd(e) {
      if (!state.isDragging) return;
      state.isDragging = false;
      const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX;
      if (clientX !== undefined) {
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
        el.audio().currentTime = ratio * el.audio().duration;
      }
    }

    bar.addEventListener('mousedown', onSeekStart);
    bar.addEventListener('touchstart', onSeekStart, { passive: true });
    document.addEventListener('mousemove', onSeekMove);
    document.addEventListener('touchmove', onSeekMove, { passive: true });
    document.addEventListener('mouseup', onSeekEnd);
    document.addEventListener('touchend', onSeekEnd);

    // Click directo
    bar.addEventListener('click', (e) => {
      const time = getSeekTime(e);
      if (!isNaN(time)) {
        el.audio().currentTime = time;
      }
    });

    // Teclado en la barra de progreso
    bar.addEventListener('keydown', (e) => {
      const step = 5;
      if (e.key === 'ArrowRight') el.audio().currentTime += step;
      if (e.key === 'ArrowLeft') el.audio().currentTime = Math.max(0, el.audio().currentTime - step);
    });
  }

  // ── Atajos de teclado globales ────────────────────────────
  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignorar si se está escribiendo en un input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          el.audio().currentTime = Math.min(el.audio().duration, el.audio().currentTime + 10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          el.audio().currentTime = Math.max(0, el.audio().currentTime - 10);
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
      }
    });
  }

  // ── Inicialización ────────────────────────────────────────
  function init() {
    const audioEl = el.audio();
    if (!audioEl) return;

    // Asignar element al estado
    state.audioEl = audioEl;

    // Controles
    el.btnPlay().addEventListener('click', togglePlay);
    el.btnRewind().addEventListener('click', () => {
      audioEl.currentTime = Math.max(0, audioEl.currentTime - 10);
    });
    el.btnForward().addEventListener('click', () => {
      audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 10);
    });
    el.btnSpeed().addEventListener('click', cycleSpeed);
    
    if (el.btnHQ()) {
      el.btnHQ().addEventListener('click', toggleHQ);
      updateHQButton(); // Set initial visual state
    }

    el.btnMute().addEventListener('click', toggleMute);
    el.volSlider().addEventListener('input', (e) => setVolume(e.target.value));

    bindAudioEvents();
    bindProgressEvents();
    bindKeyboardShortcuts();
  }

  // ── API pública ───────────────────────────────────────────
  window.Player = {
    loadChapter,
    play,
    pause,
    seekToVerse,
    isPlaying: () => state.isPlaying,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
