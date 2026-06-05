/**
 * app.js — Entry point
 * Inicialización global, integración navigation ↔ player.
 */
(function () {
  'use strict';

  function init() {
    // Verificar que las dependencias están disponibles
    if (!window.Navigation) {
      console.error('Navigation module no cargado');
      return;
    }
    if (!window.Player) {
      console.error('Player module no cargado');
      return;
    }

    // Verificar conectividad con el servidor
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        console.log(
          `%c📖 Biblia TLA — ${data.translation}`,
          'font-size:14px; font-weight:bold; color:#d4a32a;'
        );
        console.log(`   Libros: ${data.books_loaded} | Audios: ${data.audio_files} | Node: ${data.node_version}`);
        if (data.audio_files === 0) {
          console.warn('   ⚠️  No hay audios generados. Ejecuta: npm run tts-genesis');
        }
      })
      .catch(() => {
        console.warn('No se pudo conectar al servidor API. Verifica que el servidor esté corriendo.');
      });

    console.log(
      '%c📖 Biblia TLA cargada. Atajos de teclado:\n' +
      '   [Espacio]  Play/Pausa\n' +
      '   [→]        +10 segundos\n' +
      '   [←]        −10 segundos\n' +
      '   [M]        Silenciar/Activar',
      'color:#8a9bc0; font-size:11px;'
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
