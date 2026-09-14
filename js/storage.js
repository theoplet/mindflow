/**
 * Storage class to handle local storage persistence for mindmaps.
 * Handles saving, loading, auto-saving, and preference management.
 */
export class Storage {
  /**
   * @param {string} prefix - The prefix used for local storage keys.
   */
  constructor(prefix = 'mindflow_') {
    this.prefix = prefix;
    this.autoSaveTimeout = null;
    this.cachedIndex = null;
    this.db = null;
    this._initDB();
  }

  async _initDB() {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('mindflow_db', 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('maps')) {
            db.createObjectStore('maps', { keyPath: 'id' });
          }
        };
        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        request.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  _cleanNodeText(text) {
    if (!text || typeof text !== 'string') return text || '';
    if (text.includes('katex-rendered') || text.includes('katex-mathml') || text.includes('class="katex"')) {
      const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
      if (tempDiv) {
        tempDiv.innerHTML = text;
        tempDiv.querySelectorAll('.katex-rendered, .katex-display, .katex').forEach(el => {
          const ann = el.querySelector('annotation[encoding="application/x-tex"]');
          if (ann) {
            el.replaceWith(document.createTextNode(ann.textContent));
          } else {
            el.remove();
          }
        });
        const clean = tempDiv.textContent || tempDiv.innerText || '';
        return clean.trim() || 'Topic';
      }
    }
    return text;
  }

  _cleanTree(tree) {
    if (!tree) return tree;
    const cleanNode = (node) => {
      if (!node) return node;
      const copy = { ...node };
      if (typeof copy.text === 'string') {
        copy.text = this._cleanNodeText(copy.text);
      }
      if (Array.isArray(copy.children)) {
        copy.children = copy.children.map(cleanNode);
      }
      return copy;
    };

    if (Array.isArray(tree.roots)) {
      return {
        ...tree,
        roots: tree.roots.map(cleanNode)
      };
    }
    return cleanNode(tree);
  }

  saveMap(id, data) {
    try {
      const now = new Date().toISOString();
      const cleanedTree = this._cleanTree(data.tree);
      const mapData = {
        ...data,
        tree: cleanedTree,
        updatedAt: now,
        createdAt: data.createdAt || now
      };

      // 1. Save to IndexedDB (supports 500MB+ unlimited storage)
      if (this.db) {
        try {
          const tx = this.db.transaction('maps', 'readwrite');
          tx.objectStore('maps').put(mapData);
        } catch (dbErr) {
          console.warn('IndexedDB put error:', dbErr);
        }
      }

      // 2. Save to localStorage with quota protection
      try {
        localStorage.setItem(`${this.prefix}map_${id}`, JSON.stringify(mapData));
      } catch (quotaErr) {
        console.warn('localStorage quota exceeded. Map saved exclusively to IndexedDB.', quotaErr);
      }

      this._updateIndex(id, mapData);
      return true;
    } catch (error) {
      console.error('Failed to save map:', error);
      return false;
    }
  }

  loadMap(id) {
    try {
      const dataStr = localStorage.getItem(`${this.prefix}map_${id}`);
      if (!dataStr) return null;
      return JSON.parse(dataStr);
    } catch (error) {
      console.error('Failed to load map from localStorage:', error);
      return null;
    }
  }

  async loadMapAsync(id) {
    if (this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('maps', 'readonly');
          const req = tx.objectStore('maps').get(id);
          req.onsuccess = () => resolve(req.result || this.loadMap(id));
          req.onerror = () => resolve(this.loadMap(id));
        } catch (e) {
          resolve(this.loadMap(id));
        }
      });
    }
    return this.loadMap(id);
  }

  getMap(id) {
    return this.loadMap(id);
  }

  async getMapAsync(id) {
    return this.loadMapAsync(id);
  }

  get(id) {
    return this.loadMap(id);
  }

  async getAsync(id) {
    return this.loadMapAsync(id);
  }

  save(id, data) {
    return this.saveMap(id, data);
  }

  delete(id) {
    return this.deleteMap(id);
  }

  removeMap(id) {
    return this.deleteMap(id);
  }

  getMaps() {
    return this.getMapList();
  }

  async getMapsAsync() {
    return this.getMapListAsync();
  }

  listMaps() {
    return this.getMapList();
  }

  async listMapsAsync() {
    return this.getMapListAsync();
  }

  deleteMap(id) {
    try {
      if (this.autoSaveTimeout) {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = null;
      }
      if (this.db) {
        try {
          const tx = this.db.transaction('maps', 'readwrite');
          tx.objectStore('maps').delete(id);
        } catch (e) {}
      }
      localStorage.removeItem(`${this.prefix}map_${id}`);
      this._removeFromIndex(id);
      
      const lastMapId = this.getPreference('lastMapId', null);
      if (lastMapId === id) {
        localStorage.removeItem(`${this.prefix}pref_lastMapId`);
      }
    } catch (error) {
      console.error('Failed to delete map:', error);
    }
  }

  /**
   * Retrieves the list of all saved maps (metadata only).
   * @returns {Array<Object>} List of map metadata sorted by updatedAt descending.
   */
  getMapList() {
    try {
      if (!this.cachedIndex) {
        const indexStr = localStorage.getItem(`${this.prefix}index`);
        this.cachedIndex = indexStr ? JSON.parse(indexStr) : {};
      }
      return Object.values(this.cachedIndex).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      console.error('Failed to get map list:', error);
      return [];
    }
  }

  async getMapListAsync() {
    if (this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('maps', 'readonly');
          const store = tx.objectStore('maps');
          const req = store.getAll();
          req.onsuccess = () => {
            const idbMaps = (req.result || []).map(m => ({
              id: m.id,
              name: m.name || (m.tree ? m.tree.name : 'Untitled Map'),
              updatedAt: m.updatedAt || new Date().toISOString()
            }));
            
            const indexMaps = this.getMapList();
            const mapMap = new Map();
            indexMaps.forEach(m => mapMap.set(m.id, m));
            idbMaps.forEach(m => mapMap.set(m.id, m));

            const finalContainer = Array.from(mapMap.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            resolve(finalContainer);
          };
          req.onerror = () => resolve(this.getMapList());
        } catch (e) {
          resolve(this.getMapList());
        }
      });
    }
    return this.getMapList();
  }

  /**
   * Auto-saves the current map with a debounce.
   * @param {string} mapId - The ID of the mindmap.
   * @param {Object} treeData - The tree data of the mindmap.
   * @param {string} mapName - The name of the mindmap.
   */
  autoSave(mapId, treeData, mapName = 'Untitled Map') {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      const mapData = {
        id: mapId,
        name: mapName,
        tree: treeData,
        updatedAt: new Date().toISOString()
      };
      this.saveMap(mapId, mapData);
      document.dispatchEvent(new CustomEvent('mindflow:autosaved', { detail: { mapId } }));
    }, 1500);
  }

  /**
   * Gets a user preference.
   * @param {string} key - Preference key.
   * @param {*} defaultValue - Default value if not set.
   * @returns {*} The preference value.
   */
  getPreference(key, defaultValue) {
    try {
      const val = localStorage.getItem(`${this.prefix}pref_${key}`);
      if (val === null) return defaultValue;
      return JSON.parse(val);
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * Sets a user preference.
   * @param {string} key - Preference key.
   * @param {*} value - The value to set.
   */
  setPreference(key, value) {
    try {
      localStorage.setItem(`${this.prefix}pref_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to set preference:', error);
    }
  }

  /**
   * Checks current storage usage.
   * @returns {Object} { used, available, percent }
   */
  getStorageUsage() {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        used += localStorage.getItem(key).length;
      }
    }
    const maxEstimate = 5 * 1024 * 1024; // Typically 5MB
    return {
      used,
      available: Math.max(0, maxEstimate - used),
      percent: Math.min(100, Math.round((used / maxEstimate) * 100))
    };
  }

  /**
   * Exports all application data.
   * @returns {string} JSON string of all data.
   */
  exportAllData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        data[key] = localStorage.getItem(key);
      }
    }
    return JSON.stringify(data);
  }

  /**
   * Imports application data.
   * @param {string} dataString - JSON string of data.
   */
  importAllData(dataString) {
    try {
      const data = JSON.parse(dataString);
      for (const key in data) {
        if (key.startsWith(this.prefix)) {
          localStorage.setItem(key, data[key]);
        }
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Invalid data format');
    }
  }

  /**
   * Internal helper to update the map index.
   * @private
   */
  _updateIndex(id, mapData) {
    try {
      if (!this.cachedIndex) {
        const indexStr = localStorage.getItem(`${this.prefix}index`);
        this.cachedIndex = indexStr ? JSON.parse(indexStr) : {};
      }
      this.cachedIndex[id] = {
        id,
        name: mapData.name,
        updatedAt: mapData.updatedAt
      };
      localStorage.setItem(`${this.prefix}index`, JSON.stringify(this.cachedIndex));
    } catch (error) {
      console.error('Failed to update index:', error);
    }
  }

  /**
   * Internal helper to remove a map from the index.
   * @private
   */
  _removeFromIndex(id) {
    try {
      const indexStr = localStorage.getItem(`${this.prefix}index`);
      if (!indexStr) return;
      const index = JSON.parse(indexStr);
      delete index[id];
      this.cachedIndex = index;
      localStorage.setItem(`${this.prefix}index`, JSON.stringify(index));
    } catch (error) {
      console.error('Failed to remove from index:', error);
    }
  }
}
