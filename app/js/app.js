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

    console.log(
      `%c📖 Biblia TLA — Cliente Estático`,
      'font-size:14px; font-weight:bold; color:#d4a32a;'
    );

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
