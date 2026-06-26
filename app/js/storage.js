/**
 * storage.js — Almacenamiento local en IndexedDB para Biblias importadas por el usuario.
 * Expone: window.CustomStorage
 */
(function () {
  'use strict';

  const DB_NAME = 'BibliaAppDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'custom_bibles';

  window.CustomStorage = {
    async getDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
      });
    },

    async saveBible(bibleData) {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(bibleData);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    },

    async getBible(id) {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },

    async getAllBiblesMetadata() {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          const meta = list.map(b => ({
            id: b.id,
            name: b.name,
            abbr: b.abbr,
            isCustom: true,
            books: b.books.map(bk => ({
              id: bk.id,
              name: bk.name,
              abbr: bk.abbr,
              testament: bk.testament,
              group: bk.group,
              chapterCount: bk.chapters.length
            }))
          }));
          resolve(meta);
        };
        req.onerror = () => reject(req.error);
      });
    },

    async deleteBible(id) {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    }
  };
})();
