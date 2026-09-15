/**
 * MindFlow — Main Application Controller
 * Wires together all modules: MindMap, Layout, Renderer, Canvas, Keyboard,
 * History, Storage, Exporter, Importer, Theme, I18n, AI
 */

import { $, showToast, generateId, debounce, deepClone, compressImageFile } from './utils.js';
import { MindMap } from './mindmap.js';
import { Layout } from './layout.js';
import { Renderer } from './renderer.js';
import { Canvas } from './canvas.js';
import { Keyboard } from './keyboard.js';
import { History } from './history.js';
import { Storage } from './storage.js';
import { Exporter } from './export.js';
import { Importer } from './import.js';
import { Theme } from './theme.js';
import { I18n } from './i18n.js';
import { AI } from './ai.js';
import { GDrive } from './gdrive.js';
import { parseDriveState, clearDriveState } from './drive_state.js';
import { MathEditor } from './math_editor.js';
import {
  attachSmartEditor,
  toggleBulletList,
  toggleNumberedList,
  indentSelection,
  outdentSelection
} from './smart_editor.js';

class App {
  constructor() {
    window.app = this;
    window.mindflowApp = this;

    // Core modules
    this.mindmap = new MindMap();
    this.layout = new Layout();
    this.history = new History(50);
    this.storage = new Storage();
    window.storage = this.storage;
    window.mindmap = this.mindmap;
    this.exporter = new Exporter();
    this.importer = new Importer();
    this.theme = new Theme();
    this.i18n = new I18n();
    this.ai = new AI();
    this.gdrive = new GDrive();
    this.keyboard = new Keyboard();
    this.mathEditor = new MathEditor(this);

    // State
    this.currentMapId = null;
    this.currentMapDriveId = null;
    this.pendingDriveFolderId = null;
    this.currentMapName = 'Untitled Map';
    this.clipboard = null;
    this.isEditing = false;
    this.lastLayoutData = null;
    this.lastBounds = null;
    this.allLinesSelected = false;
    this.isUndoRedoing = false;
    this.isLoadingMap = false;
    this.editingRightNodeId = null;
    this.rightEditorImages = [];
    this.rightEditorHistory = null;
    this.nodeEditorHistories = new Map();
    this.selectedConnectionId = null;
    this.connectMode = null;

    // DOM references (set in init)
    this.canvas = null;
    this.renderer = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    // Initialize theme & i18n & gdrive
    this.theme.init();
    this.i18n.init();
    this.ai.init();
    this.gdrive.init();

    // Initialize canvas & renderer
    const canvasContainer = $('#mindmap-canvas');
    const canvasTransform = $('#canvas-transform');
    const svgConnectors = $('#svg-connectors');

    this.canvas = new Canvas(canvasContainer, canvasTransform);
    this.canvas.init();

    this.renderer = new Renderer(canvasTransform, svgConnectors);

    // Set up renderer callbacks
    this.renderer.onNodeClick = (nodeId) => this.handleNodeClick(nodeId);
    this.renderer.onNodeDoubleClick = (nodeId) => this.handleNodeDoubleClick(nodeId);
    this.renderer.onNodeContextMenu = (nodeId, e) => this.handleContextMenu(nodeId, e);
    this.renderer.onNodeTextChange = (nodeId, text) => this.handleTextChange(nodeId, text);
    this.renderer.onCollapseToggle = (nodeId) => this.handleCollapseToggle(nodeId);
    this.renderer.onNodeDragEnd = (dragId, targetId, dropPos) => this.handleDragDrop(dragId, targetId, dropPos);
    this.renderer.getCanvasScale = () => (this.canvas ? this.canvas.scale : 1.0);
    this.renderer.onNodeResize = (nodeId, width, height) => {
      this.mindmap.updateNode(nodeId, { customWidth: width, customHeight: height });
    };
    this.renderer.onNodeImagesUpdate = (nodeId, imagesArray) => {
      this.mindmap.updateNode(nodeId, { images: imagesArray, customHeight: undefined, customWidth: undefined });
    };
    this.renderer.onImageResize = (nodeId, imgIndex, width, height) => {
      const node = this.mindmap.findNode(nodeId);
      if (!node) return;
      let imagesList = node.images ? [...node.images] : (node.image ? [node.image] : []);
      if (imagesList[imgIndex]) {
        const item = imagesList[imgIndex];
        const src = typeof item === 'string' ? item : item.src;
        imagesList[imgIndex] = { src, width: Math.round(width), height: Math.round(height) };
      }
      this.mindmap.updateNode(nodeId, {
        images: imagesList,
        customWidth: undefined,
        customHeight: undefined
      });
    };
    this.renderer.onLineClick = (parentId, childId, pathEl, e) => {
      this.selectedConnectionId = null;
      if (this.renderer) this.renderer.selectedConnectionId = null;
      this.handleLineClick(parentId, childId, e);
    };
    this.renderer.onFreeLineClick = (connectionId, pathEl, e) => {
      this.handleFreeConnectionClick(connectionId, e);
    };

    // Set up mindmap event listeners
    this.mindmap.on('selectionChanged', ({ nodeId, oldSelectedId }) => {
      this.renderer.updateSelection(oldSelectedId, nodeId);
      this.updatePropertiesPanel(nodeId);
      this.updateFormattingBar(nodeId);
    });

    this.mindmap.on('structureChanged', () => {
      this.renderMap();
      if (!this.isUndoRedoing && !this.isLoadingMap) {
        this.saveState();
        this.triggerAutoSave();
      }
      if (this.nodeEditorHistories && this.nodeEditorHistories.size > 0 && this.mindmap.nodeMap) {
        for (const nid of this.nodeEditorHistories.keys()) {
          if (!this.mindmap.nodeMap.has(nid)) {
            this.nodeEditorHistories.delete(nid);
          }
        }
      }
    });

    this.mindmap.on('nodeUpdated', ({ nodeId }) => {
      this.renderMap();
      this.triggerAutoSave();
      this.updateFormattingBar(nodeId);
    });

    // Set up canvas zoom/pan listener
    this.canvas.on('change', ({ scale }) => {
      $('#zoom-level').textContent = `${Math.round(scale * 100)}%`;
      $('#status-zoom').textContent = `${Math.round(scale * 100)}%`;
      this.hideAllContextBoxes();
    });

    // Initialize keyboard shortcuts
    this.keyboard.init();
    this.registerKeyboardShortcuts();

    // Set up UI event listeners
    this.setupToolbarListeners();
    this.setupModalListeners();
    this.setupPropertiesPanelListeners();
    this.setupContextMenuListeners();
    this.setupRightEditorPanelListeners();
    this.setupLineMenuListeners();
    this.setupFormattingBarListeners();
    this.setupLineContextBoxListeners();
    this.setupCanvasClickListener();
    this.setupAutoSaveListener();
    this.setupGlobalPasteSanitizer();
    this.setupFileDropListener();
    this.mathEditor.init();

    // Set up history change listener
    this.history.on('change', ({ canUndo, canRedo }) => {
      const undoBtn = $('#btn-undo');
      const redoBtn = $('#btn-redo');
      if (undoBtn) {
        undoBtn.disabled = !canUndo;
        undoBtn.classList.toggle('disabled', !canUndo);
      }
      if (redoBtn) {
        redoBtn.disabled = !canRedo;
        redoBtn.classList.toggle('disabled', !canRedo);
      }
    });

    // Load or create map (handling Google Drive UI entry if triggered)
    const handledDrive = await this.handleDriveEntry();
    if (!handledDrive) {
      this.loadInitialMap();
    }

    // Update language label
    this.updateLangLabel();
    this.i18n.onChange(() => {
      this.updateLangLabel();
    });

    console.log('🧠 MindFlow initialized');
  }

  // ==================== MAP LOADING ====================

  /**
   * Handle incoming Google Drive UI Integration actions ("open" or "create" via ?state=)
   * @returns {Promise<boolean>} true if Drive action was handled, false otherwise
   */
  async handleDriveEntry() {
    const driveState = parseDriveState();
    if (!driveState || !driveState.action) {
      return false;
    }

    try {
      if (driveState.action === 'open') {
        const fileId = driveState.ids && driveState.ids.length > 0 ? driveState.ids[0] : null;
        if (!fileId) {
          console.warn('Google Drive open action missing file ID in state:', driveState);
          clearDriveState();
          return false;
        }

        const resourceKey = driveState.resourceKeys ? driveState.resourceKeys[fileId] : undefined;

        showToast(this.i18n.t('gdrive.loading') || 'Đang mở sơ đồ từ Google Drive...', 'info', 4000);

        // Ensure OAuth token (silent first with userId hint)
        if (this.gdrive.hasClientId()) {
          try {
            await this.gdrive.ensureToken(driveState.userId || '');
          } catch (authErr) {
            console.warn('Silent Google Drive auth did not complete:', authErr);
          }
        }

        if (!this.gdrive.isConnected()) {
          // Not connected yet - show GDrive modal to let user connect or authorize
          showToast('Vui lòng kết nối Google Drive để mở tệp', 'error', 4000);
          this.showGDriveModal();
          clearDriveState();
          return false;
        }

        // Download file content (auto decompresses gzip if needed)
        const fileText = await this.gdrive.downloadFileText(fileId, resourceKey);

        // Fetch file metadata for proper map name if possible
        let fileName = null;
        try {
          const meta = await this.gdrive.getFileMeta(fileId, resourceKey);
          if (meta && meta.name) {
            fileName = meta.name.replace(/\.(mindflow|json)$/i, '');
          }
        } catch (metaErr) {
          console.warn('Could not fetch file meta, fallback to content name:', metaErr);
        }

        // Parse and apply mindmap
        const result = await this.importer.importJSONAsync(fileText);
        if (fileName) {
          result.name = fileName;
        }

        await this.applyImportedResult(result);
        this.currentMapDriveId = fileId;
        this.pendingDriveFolderId = null;

        clearDriveState();
        return true;
      }

      if (driveState.action === 'create') {
        this.createNewMap();
        this.currentMapDriveId = null;
        this.pendingDriveFolderId = driveState.folderId || null;

        if (this.gdrive.hasClientId() && driveState.userId) {
          this.gdrive.ensureToken(driveState.userId).catch(() => {});
        }

        clearDriveState();
        showToast('Sơ đồ mới sẵn sàng lưu vào Google Drive!', 'info', 3000);
        return true;
      }

      clearDriveState();
      return false;
    } catch (err) {
      console.error('Failed to handle Google Drive entry:', err);
      showToast('Lỗi khi mở từ Google Drive: ' + (err.message || err), 'error', 4000);
      clearDriveState();
      return false;
    }
  }

  loadInitialMap() {
    const lastMapId = this.storage.getPreference('lastMapId', null);
    if (lastMapId) {
      const mapData = this.storage.loadMap(lastMapId);
      if (mapData && mapData.tree) {
        this.currentMapId = lastMapId;
        this.currentMapName = mapData.name || 'Untitled Map';
        this.mindmap.fromJSON(mapData.tree);
        if (this.mindmap.root) {
          this.mindmap.selectNode(this.mindmap.root.id);
        }
        $('#map-name').value = this.currentMapName;
        this.nodeEditorHistories?.clear();
        this.history.init(this.mindmap.toJSON());
        this.renderMap();
        setTimeout(() => this.centerView(), 50);
        return;
      }
    }
    this.createNewMap();
  }

  hideAllContextBoxes() {
    this.hideContextMenu();
    $('#node-formatting-bar')?.classList.add('hidden');
    $('#line-context-box')?.classList.add('hidden');
    $('#context-menu')?.classList.remove('open');
    $('#line-menu')?.classList.remove('open');
    $('#fmt-highlight-palette')?.classList.add('hidden');
    $('#fmt-color-palette')?.classList.add('hidden');
    this.allLinesSelected = false;
    this.selectedLineChildId = null;
    this.selectedConnectionId = null;
    if (this.renderer) this.renderer.selectedConnectionId = null;
    $('#btn-select-all-lines')?.classList.remove('active');
  }

  createNewMap() {
    if (this.currentMapId && this.storage.loadMap(this.currentMapId) && this.mindmap && this.mindmap.root) {
      this.saveCurrentMap(false);
    }
    this.isLoadingMap = true;
    this.hideAllContextBoxes();
    this.currentMapId = generateId();
    this.currentMapName = this.i18n.t('map.untitled');
    this.mindmap = new MindMap();

    // Re-register events cleanly
    this.mindmap.on('selectionChanged', ({ nodeId, oldSelectedId }) => {
      this.renderer.updateSelection(oldSelectedId, nodeId);
      this.updatePropertiesPanel(nodeId);
      this.updateFormattingBar(nodeId);
    });
    this.mindmap.on('structureChanged', () => {
      this.renderMap();
      if (!this.isUndoRedoing && !this.isLoadingMap) {
        this.saveState();
        this.triggerAutoSave();
      }
    });
    this.mindmap.on('nodeUpdated', ({ nodeId }) => {
      this.updateFormattingBar(nodeId);
    });

    const rootNode = this.mindmap.createDefault();

    $('#map-name').value = this.currentMapName;
    
    // Immediately persist newly created map
    this.storage.saveMap(this.currentMapId, {
      id: this.currentMapId,
      name: this.currentMapName,
      tree: this.mindmap.toJSON(),
    });
    this.storage.setPreference('lastMapId', this.currentMapId);

    this.renderMap();
    this.nodeEditorHistories?.clear();
    this.history.init(this.mindmap.toJSON());
    this.isLoadingMap = false;

    if (rootNode) this.mindmap.selectNode(rootNode.id);
    setTimeout(() => this.centerView(), 50);
  }

  // ==================== RENDERING ====================

  renderMap() {
    if (this.renderPending) return;
    this.renderPending = true;
    requestAnimationFrame(() => {
      this.renderPending = false;
      this._doRenderMap();
    });
  }

  _buildLayoutArray(nodes) {
    const layoutArray = [];
    this.mindmap.roots.forEach(rootNode => {
      const traverse = (node, depth = 0) => {
        const data = nodes.get(node.id);
        if (data) {
          node.x = Math.round(data.x);
          node.y = Math.round(data.y);

          layoutArray.push({
            id: node.id,
            node: node,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            depth: depth
          });
        }
        if (!node.collapsed && node.children) {
          node.children.forEach(child => traverse(child, depth + 1));
        }
      };
      traverse(rootNode);
    });
    return layoutArray;
  }

  _doRenderMap() {
    if (!this.mindmap || !this.mindmap.roots || this.mindmap.roots.length === 0) return;

    // Pass 1: Compute layout & render DOM elements
    let { nodes, bounds } = this.layout.computeLayout(this.mindmap.roots);
    let layoutArray = this._buildLayoutArray(nodes);
    this.renderer.renderTree(this.mindmap.roots, layoutArray, this.mindmap.globalLineStyle, this.allLinesSelected, this.mindmap.connections);

    // Skip Pass 2 measurement during active dragging or text editing to guarantee zero reflow & keep selection intact!
    if (this.renderer && this.renderer.dragState && this.renderer.dragState.isDragging) return;
    if (document.activeElement && document.activeElement.classList.contains('node-text')) return;

    // Pass 2: Measure REAL DOM sizes of all nodes after browser DOM rendering & KaTeX math layout
    let dimensionsChanged = false;

    this.renderer.nodeElements.forEach((el, nodeId) => {
      const node = this.mindmap.findNode(nodeId);
      if (node && !node.customWidth && !node.customHeight) {
        const isRoot = node.id === this.mindmap.root?.id || this.mindmap.isRoot(node.id);
        const imagesCount = (node.images && node.images.length) ? node.images.length : (node.image ? 1 : 0);
        const prevW = el.style.width;
        const prevH = el.style.height;
        const prevMaxW = el.style.maxWidth;
        const prevMinH = el.style.minHeight;

        const textSpan = el.querySelector('.node-text');
        const prevTextWs = textSpan ? textSpan.style.whiteSpace : '';
        if (textSpan) {
          textSpan.style.whiteSpace = 'pre';
        }

        el.style.width = 'auto';
        el.style.height = 'auto';
        el.style.minHeight = '0px';
        el.style.maxWidth = '1500px';

        let realW = Math.ceil(el.offsetWidth) + 14;
        let realH = el.offsetHeight;

        if (el.scrollHeight > el.clientHeight + 4) {
          realH = Math.max(realH, el.scrollHeight + 8);
        }

        // Safety clamp on measured DOM size
        const maxSafeW = 1600;
        const maxSafeH = 1500;
        realW = Math.min(realW, maxSafeW);
        realH = Math.min(realH, maxSafeH);

        if (textSpan) {
          textSpan.style.whiteSpace = prevTextWs;
        }

        el.style.width = prevW;
        el.style.height = prevH;
        el.style.minHeight = prevMinH;
        el.style.maxWidth = prevMaxW;

        if (!node.measuredWidth || !node.measuredHeight || Math.abs(node.measuredWidth - realW) > 3 || Math.abs(node.measuredHeight - realH) > 3) {
          node.measuredWidth = realW;
          node.measuredHeight = realH;
          dimensionsChanged = true;
        }
      }
    });

    // If real DOM dimensions differed from estimates, re-compute layout with exact measured dimensions!
    if (dimensionsChanged) {
      const result = this.layout.computeLayout(this.mindmap.roots);
      nodes = result.nodes;
      bounds = result.bounds;
      layoutArray = this._buildLayoutArray(nodes);
      this.renderer.renderTree(this.mindmap.roots, layoutArray, this.mindmap.globalLineStyle, this.allLinesSelected, this.mindmap.connections);
    }

    this.lastBounds = bounds;
    this.lastLayoutData = layoutArray;

    // Update node count
    const countEl = $('#node-count');
    if (countEl) countEl.textContent = this.mindmap.getNodeCount();
  }

  centerView() {
    const mainRoot = this.mindmap.root || (this.mindmap.roots ? this.mindmap.roots[0] : null);
    if (mainRoot && this.lastLayoutData) {
      const rootLayout = this.lastLayoutData.find(n => n.id === mainRoot.id);
      if (rootLayout) {
        this.canvas.scale = 1.0;
        this.canvas.centerOnPoint(rootLayout.x + (rootLayout.width || 140) / 2, rootLayout.y + (rootLayout.height || 40) / 2, false);
        return;
      }
    }
    this.canvas.scale = 1.0;
    this.canvas.centerOnPoint(0, 0, false);
  }

  // ==================== STATE MANAGEMENT ====================

  saveState() {
    if (this.mindmap && this.mindmap.root && !this.isUndoRedoing && !this.isLoadingMap) {
      this.history.push(this.mindmap.toJSON());
    }
  }

  undo() {
    if (this.isUndoRedoing) return;
    if (this.saveStateTimer) clearTimeout(this.saveStateTimer);
    const prevSelectedId = this.mindmap ? this.mindmap.selectedNodeId : null;
    this.isUndoRedoing = true;
    try {
      const state = this.history.undo(this.mindmap.toJSON());
      if (state) {
        this.mindmap.fromJSON(state, false);
        if (prevSelectedId && this.mindmap.findNode(prevSelectedId)) {
          this.mindmap.selectNode(prevSelectedId);
        } else if (this.mindmap.root) {
          this.mindmap.selectNode(this.mindmap.root.id);
        }
        this._doRenderMap();
        showToast(this.i18n.t('toast.undone'), 'info', 1500);
      }
    } finally {
      this.isUndoRedoing = false;
    }
  }

  redo() {
    if (this.isUndoRedoing) return;
    if (this.saveStateTimer) clearTimeout(this.saveStateTimer);
    const prevSelectedId = this.mindmap ? this.mindmap.selectedNodeId : null;
    this.isUndoRedoing = true;
    try {
      const state = this.history.redo(this.mindmap.toJSON());
      if (state) {
        this.mindmap.fromJSON(state, false);
        if (prevSelectedId && this.mindmap.findNode(prevSelectedId)) {
          this.mindmap.selectNode(prevSelectedId);
        } else if (this.mindmap.root) {
          this.mindmap.selectNode(this.mindmap.root.id);
        }
        this._doRenderMap();
        showToast(this.i18n.t('toast.redone'), 'info', 1500);
      }
    } finally {
      this.isUndoRedoing = false;
    }
  }

  triggerAutoSave = debounce(() => {
    if (!this.mindmap) return;
    if (!this.currentMapId) {
      this.currentMapId = generateId();
    }
    this.currentMapName = $('#map-name')?.value?.trim() || (this.i18n ? this.i18n.t('map.untitled') : 'Untitled Map');
    if (this.mindmap.root) {
      this.storage.autoSave(this.currentMapId, this.mindmap.toJSON(), this.currentMapName);
    }
  }, 1000);

  // ==================== NODE INTERACTIONS ====================

  handleNodeClick(nodeId) {
    // If currently editing a DIFFERENT node, stop editing first
    if (this.isEditing && this.renderer.editingNodeId && this.renderer.editingNodeId !== nodeId) {
      this.stopEditing();
    }
    if (this.connectingSourceNodeId) {
      if (nodeId !== this.connectingSourceNodeId) {
        if (this.connectMode === 'freeline') {
          this.mindmap.addConnection(this.connectingSourceNodeId, nodeId);
          showToast('↗️ Đã tạo đường nối tự do thành công!', 'success', 2500);
        } else {
          if (this.mindmap.moveNode(this.connectingSourceNodeId, nodeId)) {
            showToast('🔗 Nối Node thành công! Lines đã được cập nhật.', 'success', 2500);
          } else {
            showToast('Không thể nối node (tránh vòng lặp lặp lại).', 'error', 2500);
          }
        }
      }
      const prevEl = this.renderer.nodeElements.get(this.connectingSourceNodeId);
      if (prevEl) prevEl.classList.remove('connecting-source');
      this.connectingSourceNodeId = null;
      this.connectMode = null;
      this.renderMap();
      return;
    }
    this.mindmap.selectNode(nodeId);
    this.updateFormattingBar(nodeId);
  }

  handleNodeDoubleClick(nodeId) {
    this.startEditing(nodeId);
  }

  handleTextChange(nodeId, newText) {
    if (newText.trim() === '') newText = 'Topic';
    this.mindmap.updateNode(nodeId, { text: newText });
    this.isEditing = false;
    this.keyboard.setEditing(false);
  }

  handleCollapseToggle(nodeId) {
    if (this.isCollapsing) return;
    this.isCollapsing = true;
    try {
      this.mindmap.toggleCollapse(nodeId);
    } finally {
      setTimeout(() => { this.isCollapsing = false; }, 60);
    }
  }

  handleDragDrop(dragId, targetId, dropPos) {
    if (targetId) {
      if (this.mindmap.moveNode(dragId, targetId)) {
        showToast(this.i18n.t('toast.pasted'), 'success', 2000);
      }
    } else if (dropPos) {
      const draggedNode = this.mindmap.findNode(dragId);
      if (!draggedNode || !this.lastLayoutData) return;

      let centerX, centerY;
      if (dropPos.canvasX !== undefined) {
        centerX = dropPos.canvasX;
        centerY = dropPos.canvasY;
      } else {
        const draggedLayout = this.lastLayoutData.find(n => n.id === dragId);
        const w = draggedLayout ? draggedLayout.width : 120;
        const h = draggedLayout ? draggedLayout.height : 40;
        const coords = this.canvas.screenToCanvas(dropPos.x, dropPos.y);
        centerX = coords.x;
        centerY = coords.y;
      }

      const parent = this.mindmap.getParent(dragId);
      let parentCenterX = null;
      let parentCenterY = null;

      if (parent) {
        const parentLayout = this.lastLayoutData.find(n => n.id === parent.id);
        if (parentLayout) {
          parentCenterX = parentLayout.x;
          parentCenterY = parentLayout.y;
        }
      }

      this.mindmap.setNodePosition(dragId, centerX, centerY, parentCenterX, parentCenterY);
    }
  }

  startEditing(nodeId) {
    if (!nodeId) {
      const selected = this.mindmap.getSelectedNode();
      if (selected) nodeId = selected.id;
      else return;
    }
    this.openRightEditorPanel(nodeId);
  }

  stopEditing() {
    if (this.isEditing) {
      // Use renderer.editingNodeId which is always set, even after selectNode(null)
      const editingId = this.renderer.editingNodeId;
      if (editingId) {
        this.renderer.stopEditing(editingId, true);
      } else {
        // Fallback: try selected node
        const selected = this.mindmap.getSelectedNode();
        if (selected) {
          this.renderer.stopEditing(selected.id, true);
        }
      }
      this.isEditing = false;
      this.keyboard.setEditing(false);
    }
  }

  // ==================== CONTEXT MENU ====================

  handleContextMenu(nodeId, e) {
    this.mindmap.selectNode(nodeId);
    const menu = $('#context-menu');
    const node = this.mindmap.findNode(nodeId);

    // Update collapse/expand text
    const collapseText = $('#ctx-collapse-text');
    if (node && node.collapsed) {
      collapseText.textContent = this.i18n.t('context.expand');
    } else {
      collapseText.textContent = this.i18n.t('context.collapse');
    }

    // Position menu
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.remove('hidden');
    menu.classList.add('open');

    // Ensure menu stays within viewport
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - rect.width - 8}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - rect.height - 8}px`;
      }
    });
  }

  hideContextMenu() {
    const menu = $('#context-menu');
    if (menu) {
      menu.classList.remove('open');
      menu.classList.add('hidden');
    }
  }

  // ==================== LINE CONTEXT MENU ====================

  handleLineClick(parentId, childId, e) {
    this.selectedLineChildId = childId;
    this.allLinesSelected = false;
    $('#btn-select-all-lines')?.classList.remove('active');

    const box = $('#line-context-box');
    if (!box) return;

    const childNode = this.mindmap.findNode(childId);
    if (childNode) {
      const width = childNode.lineWidth || 2;
      box.querySelectorAll('.line-val-btn[data-width]').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.width) === width);
      });

      const opacity = childNode.lineOpacity !== null && childNode.lineOpacity !== undefined ? childNode.lineOpacity : 1.0;
      box.querySelectorAll('.line-val-btn[data-opacity]').forEach(b => {
        b.classList.toggle('active', parseFloat(b.dataset.opacity) === opacity);
      });

      const dash = childNode.lineDash || 'solid';
      box.querySelectorAll('.line-val-btn[data-dash]').forEach(b => {
        b.classList.toggle('active', b.dataset.dash === dash);
      });

      const color = childNode.lineColor || 'inherit';
      box.querySelectorAll('.line-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.lineColor === color);
      });

      const arrow = childNode.lineArrow || 'none';
      box.querySelectorAll('.line-arrow-val-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.arrow === (arrow === true ? 'end' : arrow));
      });

      const textInput = $('#line-text-input');
      if (textInput) {
        textInput.value = childNode.lineText || '';
      }
    }

    const clientX = (e && typeof e.clientX === 'number') ? e.clientX : 200;
    const clientY = (e && typeof e.clientY === 'number') ? e.clientY : 200;
    box.style.left = `${Math.min(window.innerWidth - 310, Math.max(10, clientX + 10))}px`;
    box.style.top = `${Math.min(window.innerHeight - 300, Math.max(70, clientY - 20))}px`;
    box.classList.remove('hidden');
    this.clampToViewport(box);
    this.renderMap();
  }

  handleFreeConnectionClick(connectionId, e) {
    this.selectedConnectionId = connectionId;
    if (this.renderer) this.renderer.selectedConnectionId = connectionId;
    this.selectedLineChildId = null;
    this.allLinesSelected = false;
    $('#btn-select-all-lines')?.classList.remove('active');

    const box = $('#line-context-box');
    if (!box) return;

    const conn = (this.mindmap.connections || []).find(c => c.id === connectionId);
    if (conn) {
      const width = conn.lineWidth || 2;
      box.querySelectorAll('.line-val-btn[data-width]').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.width) === width);
      });

      const opacity = conn.lineOpacity !== null && conn.lineOpacity !== undefined ? conn.lineOpacity : 1.0;
      box.querySelectorAll('.line-val-btn[data-opacity]').forEach(b => {
        b.classList.toggle('active', parseFloat(b.dataset.opacity) === opacity);
      });

      const dash = conn.lineDash || 'solid';
      box.querySelectorAll('.line-val-btn[data-dash]').forEach(b => {
        b.classList.toggle('active', b.dataset.dash === dash);
      });

      const color = conn.lineColor || '#38BDF8';
      box.querySelectorAll('.line-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.lineColor === color);
      });

      const arrow = conn.lineArrow || 'none';
      box.querySelectorAll('.line-arrow-val-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.arrow === (arrow === true ? 'end' : arrow));
      });

      const textInput = $('#line-text-input');
      if (textInput) {
        textInput.value = conn.lineText || '';
      }
    }

    const clientX = (e && typeof e.clientX === 'number') ? e.clientX : 200;
    const clientY = (e && typeof e.clientY === 'number') ? e.clientY : 200;
    box.style.left = `${Math.min(window.innerWidth - 310, Math.max(10, clientX + 10))}px`;
    box.style.top = `${Math.min(window.innerHeight - 300, Math.max(70, clientY - 20))}px`;
    box.classList.remove('hidden');
    this.clampToViewport(box);
    this.renderMap();
  }

  // ==================== PROPERTIES PANEL ====================

  updatePropertiesPanel(nodeId) {
    const node = nodeId ? this.mindmap.findNode(nodeId) : null;
    if (!node) return;

    // Update color swatches
    document.querySelectorAll('#color-picker .color-swatch').forEach(swatch => {
      swatch.classList.toggle('active', (swatch.dataset.color || '') === (node.color || ''));
    });

    // Update notes
    const notesEl = $('#node-notes');
    if (notesEl && document.activeElement !== notesEl) {
      notesEl.value = node.notes || '';
    }
  }

  showPropertiesPanel() {
    $('#properties-panel').classList.add('open');
  }

  hidePropertiesPanel() {
    $('#properties-panel').classList.remove('open');
  }

  // ==================== KEYBOARD SHORTCUTS ====================

  registerKeyboardShortcuts() {
    this.keyboard.registerDefaults({
      addChild: () => {
        const selected = this.mindmap.getSelectedNode() || this.mindmap.root;
        if (selected) {
          const newNode = this.mindmap.addChild(selected.id, this.i18n.t('node.defaultText'));
          if (newNode) {
            this.mindmap.selectNode(newNode.id);
            setTimeout(() => this.startEditing(newNode.id), 100);
          }
        }
      },
      addSibling: () => {
        if (this.isEditing) {
          this.stopEditing();
          return;
        }
        const selected = this.mindmap.getSelectedNode();
        if (selected && selected.id !== this.mindmap.root?.id) {
          const newNode = this.mindmap.addSibling(selected.id, this.i18n.t('node.defaultText'));
          if (newNode) {
            this.mindmap.selectNode(newNode.id);
            setTimeout(() => this.startEditing(newNode.id), 100);
          }
        } else if (this.mindmap.root) {
          const newNode = this.mindmap.addChild(this.mindmap.root.id, this.i18n.t('node.defaultText'));
          if (newNode) {
            this.mindmap.selectNode(newNode.id);
            setTimeout(() => this.startEditing(newNode.id), 100);
          }
        }
      },
      deleteNode: () => {
        const selected = this.mindmap.getSelectedNode();
        if (!selected) {
          showToast(this.i18n.t('toast.noSelection'), 'info', 2000);
          return;
        }
        if (selected.id === this.mindmap.root?.id) {
          showToast(this.i18n.t('toast.cannotDeleteRoot'), 'error', 2000);
          return;
        }
        const parent = this.mindmap.getParent(selected.id);
        this.mindmap.deleteNode(selected.id);
        if (parent) this.mindmap.selectNode(parent.id);
        showToast(this.i18n.t('toast.deleted'), 'info', 2000);
      },
      editNode: () => {
        const selected = this.mindmap.getSelectedNode();
        if (selected) this.startEditing(selected.id);
      },
      cancelEdit: () => {
        if (this.isEditing) {
          const selected = this.mindmap.getSelectedNode();
          if (selected) this.renderer.stopEditing(selected.id, false);
          this.isEditing = false;
          this.keyboard.setEditing(false);
        } else {
          this.mindmap.selectNode(null);
          this.hideContextMenu();
          this.hidePropertiesPanel();
          this.closeAllModals();
        }
      },
      undo: () => this.undo(),
      redo: () => this.redo(),
      save: () => this.saveCurrentMap(),
      openMap: () => this.showOpenMapModal(),
      exportDialog: () => this.showModal('export-modal'),
      toggleCollapse: () => {
        const selected = this.mindmap.getSelectedNode();
        if (selected) this.mindmap.toggleCollapse(selected.id);
      },
      navigateUp: () => this.navigateNode('up'),
      navigateDown: () => this.navigateNode('down'),
      navigateLeft: () => this.navigateNode('left'),
      navigateRight: () => this.navigateNode('right'),
      zoomIn: () => this.canvas.zoomIn(),
      zoomOut: () => this.canvas.zoomOut(),
      fitToView: () => this.centerView(),
      selectAll: () => { /* No-op for now */ },
      copyNode: () => {
        const selected = this.mindmap.getSelectedNode();
        if (selected) {
          this.clipboard = this.mindmap.copySubtree(selected.id);
          showToast(this.i18n.t('toast.copied'), 'success', 2000);
        }
      },
      pasteNode: () => {
        const selected = this.mindmap.getSelectedNode();
        if (selected && this.clipboard) {
          this.mindmap.pasteSubtree(selected.id, this.clipboard);
          showToast(this.i18n.t('toast.pasted'), 'success', 2000);
        }
      },
      showShortcuts: () => this.showModal('shortcuts-modal'),
      setSpacePressed: (pressed) => this.canvas.setSpacePressed(pressed),
    });
  }

  navigateNode(direction) {
    const selected = this.mindmap.getSelectedNode();
    if (!selected) {
      if (this.mindmap.root) this.mindmap.selectNode(this.mindmap.root.id);
      return;
    }

    let target = null;
    switch (direction) {
      case 'up':
        target = this.mindmap.getPreviousSibling(selected.id);
        break;
      case 'down':
        target = this.mindmap.getNextSibling(selected.id);
        break;
      case 'left': {
        const parent = this.mindmap.getParent(selected.id);
        if (parent) {
          target = parent;
        } else if (selected.children?.length > 0 && !selected.collapsed) {
          // At root, collapse
          this.mindmap.toggleCollapse(selected.id);
        }
        break;
      }
      case 'right': {
        if (selected.collapsed) {
          this.mindmap.toggleCollapse(selected.id);
        } else {
          target = this.mindmap.getFirstChild(selected.id);
        }
        break;
      }
    }

    if (target) {
      this.mindmap.selectNode(target.id);
    }
  }

  // ==================== TOOLBAR LISTENERS ====================

  setupToolbarListeners() {
    // New map
    $('#btn-new-map').addEventListener('click', () => {
      this.createNewMap();
      showToast(this.i18n.t('toast.newMap') || 'New map created', 'success');
    });

    // Open map
    $('#btn-open-map').addEventListener('click', () => this.showOpenMapModal());

    // Save
    $('#btn-save-map').addEventListener('click', () => this.saveCurrentMap());

    // Node operations
    $('#btn-add-central-topic')?.addEventListener('click', () => {
      const count = this.mindmap.roots ? this.mindmap.roots.length : 1;
      const spawnX = (count % 2 === 1 ? 1 : -1) * Math.ceil(count / 2) * 320;
      const spawnY = 0;
      const newRoot = this.mindmap.addCentralTopic(`Central Topic ${count + 1}`, spawnX, spawnY);
      if (newRoot) {
        this.mindmap.selectNode(newRoot.id);
        this.canvas.centerOnPoint(spawnX, spawnY, true);
        showToast('+ Central Topic Created', 'success', 2000);
      }
    });

    $('#btn-add-child')?.addEventListener('click', () => {
      const selected = this.mindmap.getSelectedNode() || this.mindmap.root;
      if (selected) {
        const newNode = this.mindmap.addChild(selected.id, this.i18n.t('node.defaultText'));
        if (newNode) {
          this.mindmap.selectNode(newNode.id);
          setTimeout(() => this.startEditing(newNode.id), 100);
        }
      }
    });

    $('#btn-add-sibling')?.addEventListener('click', () => {
      const selected = this.mindmap.getSelectedNode();
      if (selected && !this.mindmap.isRoot(selected.id)) {
        const newNode = this.mindmap.addSibling(selected.id, this.i18n.t('node.defaultText'));
        if (newNode) {
          this.mindmap.selectNode(newNode.id);
          setTimeout(() => this.startEditing(newNode.id), 100);
        }
      } else if (this.mindmap.root) {
        const newNode = this.mindmap.addChild(this.mindmap.root.id, this.i18n.t('node.defaultText'));
        if (newNode) {
          this.mindmap.selectNode(newNode.id);
          setTimeout(() => this.startEditing(newNode.id), 100);
        }
      }
    });

    $('#btn-delete-node')?.addEventListener('click', () => {
      const selected = this.mindmap.getSelectedNode();
      if (selected) {
        const parent = this.mindmap.getParent(selected.id);
        this.mindmap.deleteNode(selected.id);
        if (parent) this.mindmap.selectNode(parent.id);
        showToast(this.i18n.t('toast.deleted'), 'info', 2000);
      }
    });

    $('#btn-add-image')?.addEventListener('click', () => {
      this.triggerImageUpload();
    });

    // Draw Free Line button
    $('#btn-draw-free-line')?.addEventListener('click', () => {
      const selected = this.mindmap.getSelectedNode();
      if (!selected) {
        showToast('Vui lòng chọn 1 Node nguồn trước khi vẽ Line', 'info', 2500);
        return;
      }
      this.connectingSourceNodeId = selected.id;
      this.connectMode = 'freeline';
      const el = this.renderer.nodeElements.get(selected.id);
      if (el) el.classList.add('connecting-source');
      showToast('↗️ Đang ở chế độ Vẽ Line tự do: Click chọn Node mục tiêu để kết nối (hoặc Esc để hủy)!', 'info', 3500);
    });

    // Select All Lines / Line styling box
    $('#btn-select-all-lines')?.addEventListener('click', () => {
      this.allLinesSelected = !this.allLinesSelected;
      // Luôn xóa mọi selection line cụ thể trước đó để tránh việc các nút
      // style chỉ áp dụng lên 1 line cũ thay vì toàn bộ.
      this.selectedLineChildId = null;
      this.selectedConnectionId = null;
      if (this.renderer) this.renderer.selectedConnectionId = null;
      $('#btn-select-all-lines').classList.toggle('active', this.allLinesSelected);
      $('#line-context-box').classList.toggle('hidden', !this.allLinesSelected);
      this.renderMap();
      if (this.allLinesSelected) {
        showToast('Connector Lines Selected', 'info', 2000);
      }
    });

    // Undo / Redo
    $('#btn-undo').addEventListener('click', () => this.undo());
    $('#btn-redo').addEventListener('click', () => this.redo());

    // AI
    $('#btn-ai').addEventListener('click', () => this.showModal('ai-modal'));
    $('#btn-math-editor')?.addEventListener('click', () => this.mathEditor.open());

    // Auto-layout toggle/ Import / GDrive
    $('#btn-export').addEventListener('click', () => this.showModal('export-modal'));
    $('#btn-import').addEventListener('click', () => this.handleImport());
    $('#btn-gdrive').addEventListener('click', () => this.showGDriveModal());

    // View controls & Smart Auto-Layout
    $('#btn-auto-layout').addEventListener('click', () => {
      this.mindmap.smartAutoLayout = !this.mindmap.smartAutoLayout;
      $('#btn-auto-layout').classList.toggle('active', this.mindmap.smartAutoLayout);
      this.mindmap.resetPositions();
      this.renderMap();
      showToast(this.mindmap.smartAutoLayout ? 'Smart Auto-Layout Active' : 'Free Positioning Mode', 'info', 2000);
    });
    $('#btn-fit-view').addEventListener('click', () => this.centerView());
    $('#btn-center-root').addEventListener('click', () => {
      this.canvas.centerOnPoint(0, 0, true);
      if (this.mindmap.root) this.mindmap.selectNode(this.mindmap.root.id);
    });

    // Zoom controls
    $('#btn-zoom-in').addEventListener('click', () => this.canvas.zoomIn());
    $('#btn-zoom-out').addEventListener('click', () => this.canvas.zoomOut());

    // Theme
    $('#btn-theme').addEventListener('click', () => this.theme.toggle());

    // Language
    $('#btn-lang').addEventListener('click', () => {
      this.i18n.toggle();
      this.updateLangLabel();
    });

    // Shortcuts
    $('#btn-shortcuts').addEventListener('click', () => this.showModal('shortcuts-modal'));

    // Map name editing
    const mapNameInput = $('#map-name');
    const updateAndSaveMapName = () => {
      if (!this.currentMapId) return;
      const newName = mapNameInput.value.trim() || this.i18n.t('map.untitled');
      this.currentMapName = newName;
      mapNameInput.value = newName;
      this.saveCurrentMap(false);
    };

    mapNameInput?.addEventListener('input', debounce(updateAndSaveMapName, 300));
    mapNameInput?.addEventListener('change', updateAndSaveMapName);
    mapNameInput?.addEventListener('blur', updateAndSaveMapName);
    mapNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        mapNameInput.blur();
      }
    });
  }

  // ==================== FORMATTING BAR & LINE CONTEXT BOX ====================

  updateFormattingBar(nodeId) {
    const bar = $('#node-formatting-bar');
    if (!bar) return;
    const node = nodeId ? this.mindmap.findNode(nodeId) : null;
    if (!node) {
      bar.classList.add('hidden');
      return;
    }

    const nodeEl = this.renderer.nodeElements.get(nodeId);
    if (!nodeEl) {
      bar.classList.add('hidden');
      return;
    }

    const rect = nodeEl.getBoundingClientRect();
    // Position the bar but don't show it - only checkTextSelection() shows it
    bar.style.left = `${Math.max(10, rect.left + rect.width / 2 - 120)}px`;
    bar.style.top = `${Math.max(60, rect.top - 46)}px`;
    // Don't show bar here - it only appears when user selects text

    const fontSizeSelect = $('#fmt-font-size');
    if (fontSizeSelect) fontSizeSelect.value = node.fontSize ? String(node.fontSize) : '14';

    $('#fmt-bold')?.classList.toggle('active', node.fontWeight === 'bold');
    $('#fmt-italic')?.classList.toggle('active', node.fontStyle === 'italic');
    $('#fmt-underline')?.classList.toggle('active', node.textDecoration === 'underline');
    const textAlign = node.textAlign || 'left';
    $('#fmt-align-left')?.classList.toggle('active', textAlign === 'left');
    $('#fmt-align-center')?.classList.toggle('active', textAlign === 'center');
    $('#fmt-align-right')?.classList.toggle('active', textAlign === 'right');
  }

  setupFormattingBarListeners() {
    let isApplying = false;
    this.savedTextRange = null;

    const applyFormatCommand = (cmd, value = null) => {
      if (isApplying) return;
      isApplying = true;
      try {
        const selectedNode = this.mindmap.getSelectedNode();
        if (!selectedNode) return;

        const nodeEl = this.renderer.nodeElements.get(selectedNode.id);
        const textSpan = nodeEl ? nodeEl.querySelector('.node-text') : null;
        if (!textSpan) return;

        const sel = window.getSelection();
        if (this.savedTextRange) {
          try {
            sel.removeAllRanges();
            sel.addRange(this.savedTextRange);
          } catch (e) {}
        }

        const hasSelection = sel && !sel.isCollapsed && sel.rangeCount > 0 && textSpan.contains(sel.anchorNode);

        if (hasSelection) {
          const wasEditable = textSpan.isContentEditable;
          if (!wasEditable) textSpan.contentEditable = 'true';
          textSpan.focus();

          if (cmd === 'hiliteColor') {
            const targetVal = (value === 'none' || value === 'transparent' || !value) ? '' : value;
            try {
              const range = sel.getRangeAt(0);
              const fragment = range.extractContents();
              const tempDiv = document.createElement('div');
              tempDiv.appendChild(fragment);
              tempDiv.querySelectorAll('*').forEach(c => {
                c.style.backgroundColor = '';
                if (c.tagName === 'SPAN' && (!c.getAttribute('style') || c.getAttribute('style').trim() === '')) {
                  const p = c.parentNode;
                  if (p) { while (c.firstChild) p.insertBefore(c.firstChild, c); p.removeChild(c); }
                }
              });
              let toInsert;
              if (targetVal) {
                const span = document.createElement('span');
                span.style.backgroundColor = targetVal;
                while (tempDiv.firstChild) span.appendChild(tempDiv.firstChild);
                toInsert = span;
              } else {
                const frag = document.createDocumentFragment();
                while (tempDiv.firstChild) frag.appendChild(tempDiv.firstChild);
                toInsert = frag;
              }
              range.insertNode(toInsert);
              const newRange = document.createRange();
              newRange.selectNodeContents(toInsert);
              sel.removeAllRanges();
              sel.addRange(newRange);
              this.savedTextRange = newRange.cloneRange();
            } catch (err) {
              document.execCommand('hiliteColor', false, targetVal || 'transparent');
            }
          } else if (cmd === 'foreColor') {
            const targetVal = (value === 'inherit' || !value) ? '' : value;
            try {
              const range = sel.getRangeAt(0);
              const fragment = range.extractContents();
              const tempDiv = document.createElement('div');
              tempDiv.appendChild(fragment);
              tempDiv.querySelectorAll('*').forEach(c => {
                c.style.color = '';
                c.style.textShadow = '';
                if (c.tagName === 'FONT') c.removeAttribute('color');
                if (c.tagName === 'SPAN' && (!c.getAttribute('style') || c.getAttribute('style').trim() === '')) {
                  const p = c.parentNode;
                  if (p) { while (c.firstChild) p.insertBefore(c.firstChild, c); p.removeChild(c); }
                }
              });
              let toInsert;
              if (targetVal) {
                const span = document.createElement('span');
                span.style.color = targetVal;
                if (targetVal.toLowerCase() === '#ffffff' || targetVal.toLowerCase() === 'white' || targetVal.toLowerCase() === '#f8fafc' || targetVal.toLowerCase() === '#fafafa') {
                  span.style.textShadow = '0 1px 3px rgba(0,0,0,0.9), 0 0 2px #000';
                }
                while (tempDiv.firstChild) span.appendChild(tempDiv.firstChild);
                toInsert = span;
              } else {
                const frag = document.createDocumentFragment();
                while (tempDiv.firstChild) frag.appendChild(tempDiv.firstChild);
                toInsert = frag;
              }
              range.insertNode(toInsert);
              const newRange = document.createRange();
              newRange.selectNodeContents(toInsert);
              sel.removeAllRanges();
              sel.addRange(newRange);
              this.savedTextRange = newRange.cloneRange();
            } catch (err) {
              document.execCommand('foreColor', false, targetVal);
            }
          } else if (cmd === 'fontSize') {
            try {
              const range = sel.getRangeAt(0);
              const span = document.createElement('span');
              span.style.fontSize = `${value}px`;
              span.appendChild(range.extractContents());
              range.insertNode(span);
              const newRange = document.createRange();
              newRange.selectNodeContents(span);
              sel.removeAllRanges();
              sel.addRange(newRange);
              this.savedTextRange = newRange.cloneRange();
            } catch (err) {
              console.warn('fontSize error:', err);
            }
          } else if (cmd === 'fontName' || cmd === 'fontFamily') {
            try {
              const range = sel.getRangeAt(0);
              const span = document.createElement('span');
              span.style.fontFamily = value;
              span.appendChild(range.extractContents());
              range.insertNode(span);
              const newRange = document.createRange();
              newRange.selectNodeContents(span);
              sel.removeAllRanges();
              sel.addRange(newRange);
              this.savedTextRange = newRange.cloneRange();
            } catch (err) {
              console.warn('fontFamily error:', err);
            }
          } else if (cmd === 'justifyLeft' || cmd === 'justifyCenter' || cmd === 'justifyRight') {
            const align = cmd === 'justifyCenter' ? 'center' : (cmd === 'justifyRight' ? 'right' : 'left');
            textSpan.style.textAlign = align;
            this.mindmap.updateNode(selectedNode.id, { textAlign: align });
          } else {
            document.execCommand(cmd, false, value);
          }

          if (!wasEditable) textSpan.contentEditable = 'false';

          const cleanHTML = textSpan.innerHTML;
          this.mindmap.updateNode(selectedNode.id, { text: cleanHTML });
          
          if (sel.rangeCount > 0) {
            this.savedTextRange = sel.getRangeAt(0).cloneRange();
          }
          if (!hasSelection) {
            this.renderMap();
          }
        } else {
          if (cmd === 'hiliteColor') {
            this.mindmap.updateNode(selectedNode.id, { highlightColor: (value === 'none' || !value) ? null : value });
          } else if (cmd === 'foreColor') {
            this.mindmap.updateNode(selectedNode.id, { textColor: (value === 'inherit' || !value) ? null : value });
          } else if (cmd === 'fontSize') {
            const newSize = parseInt(value);
            delete selectedNode.customWidth;
            delete selectedNode.customHeight;
            this.mindmap.updateNode(selectedNode.id, { fontSize: newSize });
          } else if (cmd === 'bold') {
            const isBold = selectedNode.fontWeight === 'bold';
            this.mindmap.updateNode(selectedNode.id, { fontWeight: isBold ? 'normal' : 'bold' });
          } else if (cmd === 'italic') {
            const isItalic = selectedNode.fontStyle === 'italic';
            this.mindmap.updateNode(selectedNode.id, { fontStyle: isItalic ? 'normal' : 'italic' });
          } else if (cmd === 'underline') {
            const isUnderline = selectedNode.textDecoration === 'underline';
            this.mindmap.updateNode(selectedNode.id, { textDecoration: isUnderline ? 'none' : 'underline' });
          } else if (cmd === 'fontName') {
            this.mindmap.updateNode(selectedNode.id, { fontFamily: value });
          } else if (cmd === 'justifyLeft' || cmd === 'justifyCenter' || cmd === 'justifyRight') {
            const align = cmd === 'justifyCenter' ? 'center' : (cmd === 'justifyRight' ? 'right' : 'left');
            this.mindmap.updateNode(selectedNode.id, { textAlign: align });
          }
          this.renderMap();
        }
        this.updateFormattingBar(selectedNode.id);
      } finally {
        setTimeout(() => { isApplying = false; }, 50);
      }
    };

    const saveTextSelectionOnMousedown = (el) => {
      if (!el) return;
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          this.savedTextRange = sel.getRangeAt(0).cloneRange();
        }
      });
    };

    saveTextSelectionOnMousedown($('#fmt-font-family'));
    saveTextSelectionOnMousedown($('#fmt-font-size'));

    $('#fmt-font-family')?.addEventListener('change', (e) => {
      e.stopPropagation();
      applyFormatCommand('fontName', e.target.value);
    });

    $('#fmt-font-size')?.addEventListener('change', (e) => {
      e.stopPropagation();
      applyFormatCommand('fontSize', e.target.value);
    });

    $('#fmt-font-grow')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-font-grow')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = parseInt($('#fmt-font-size')?.value || 14);
      const next = Math.min(36, current + 2);
      if ($('#fmt-font-size')) $('#fmt-font-size').value = String(next);
      applyFormatCommand('fontSize', String(next));
    });

    $('#fmt-font-shrink')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-font-shrink')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = parseInt($('#fmt-font-size')?.value || 14);
      const next = Math.max(10, current - 2);
      if ($('#fmt-font-size')) $('#fmt-font-size').value = String(next);
      applyFormatCommand('fontSize', String(next));
    });

    $('#fmt-bold')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-bold')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('bold'); });
    
    $('#fmt-italic')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-italic')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('italic'); });

    $('#fmt-underline')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-underline')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('underline'); });

    $('#fmt-strike')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-strike')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('strikeThrough'); });

    $('#fmt-subscript')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-subscript')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('subscript'); });

    $('#fmt-superscript')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-superscript')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('superscript'); });

    $('#fmt-align-left')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-align-left')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('justifyLeft'); });
    $('#fmt-align-center')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-align-center')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('justifyCenter'); });
    $('#fmt-align-right')?.addEventListener('mousedown', (e) => e.preventDefault());
    $('#fmt-align-right')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('justifyRight'); });
    $('#fmt-clear')?.addEventListener('click', (e) => { e.stopPropagation(); applyFormatCommand('removeFormat'); });

    const hlBtn = $('#fmt-highlight-btn');
    const hlPalette = $('#fmt-highlight-palette');
    hlBtn?.addEventListener('mousedown', (e) => e.preventDefault());
    hlBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      hlPalette?.classList.toggle('hidden');
      $('#fmt-color-palette')?.classList.add('hidden');
    });

    hlPalette?.querySelectorAll('.palette-swatch').forEach(swatch => {
      swatch.addEventListener('mousedown', (e) => e.preventDefault());
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const hlColor = swatch.dataset.highlight;
        applyFormatCommand('hiliteColor', hlColor);
        hlPalette.classList.add('hidden');
      });
    });

    const colorBtn = $('#fmt-color-btn');
    const colorPalette = $('#fmt-color-palette');
    colorBtn?.addEventListener('mousedown', (e) => e.preventDefault());
    colorBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPalette?.classList.toggle('hidden');
      hlPalette?.classList.add('hidden');
    });

    colorPalette?.querySelectorAll('.palette-swatch').forEach(swatch => {
      swatch.addEventListener('mousedown', (e) => e.preventDefault());
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const tColor = swatch.dataset.color;
        applyFormatCommand('foreColor', tColor);
        colorPalette.classList.add('hidden');
      });
    });

    const checkTextSelection = () => {
      const sel = window.getSelection();
      const bar = $('#node-formatting-bar');
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const nodeTextEl = container.nodeType === 3 ? container.parentNode.closest('.node-text') : container.closest('.node-text');
        if (nodeTextEl) {
          const nodeEl = nodeTextEl.closest('.mindmap-node');
          if (nodeEl) {
            this.savedTextRange = range.cloneRange();
            const rect = range.getBoundingClientRect();
            if (bar) {
              bar.style.left = `${Math.max(10, rect.left + rect.width / 2 - 200)}px`;
              bar.style.top = `${Math.max(60, rect.top - 52)}px`;
              bar.classList.remove('hidden');
              this.clampToViewport(bar);
            }
            return;
          }
        }
      }
      if (bar && !this.mindmap.getSelectedNode() && !this.savedTextRange) {
        bar.classList.add('hidden');
      }
    };

    let lastTouchTime = 0;
    const handleSelectionEnd = (e) => {
      const now = Date.now();
      if (e.type === 'touchend') {
        lastTouchTime = now;
      } else if (e.type === 'mouseup' && lastTouchTime && now - lastTouchTime < 500) {
        return; // Ignore duplicated mouseup after touchend on touch devices
      }
      checkTextSelection();
    };

    document.addEventListener('mouseup', handleSelectionEnd);
    document.addEventListener('touchend', handleSelectionEnd);

    // ESC key listener to exit text selection & formatting mode cleanly
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.savedTextRange = null;
        try { window.getSelection().removeAllRanges(); } catch (err) {}
        this.hideAllContextBoxes();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#fmt-highlight-palette') && !e.target.closest('#fmt-highlight-btn')) {
        hlPalette?.classList.add('hidden');
      }
      if (!e.target.closest('#fmt-color-palette') && !e.target.closest('#fmt-color-btn')) {
        colorPalette?.classList.add('hidden');
      }
    });

    // Global image paste listener on Canvas & Nodes (Ctrl+V image)
    document.addEventListener('paste', async (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.id === 'right-editor-content' || activeEl.closest('#right-editor-panel') || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return; // Skip if user is typing in an input, textarea, or right editor panel
      }

      const items = e.clipboardData ? e.clipboardData.items : [];
      let imagePasted = false;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          imagePasted = true;
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const b64 = await compressImageFile(file, 1200);
            const selected = this.mindmap.getSelectedNode() || this.mindmap.root;
            if (selected) {
              let imagesList = selected.images ? [...selected.images] : (selected.image ? [selected.image] : []);
              imagesList.push({ src: b64, width: 180, height: 120 });
              delete selected.customWidth;
              delete selected.customHeight;
              delete selected.measuredWidth;
              delete selected.measuredHeight;
              this.mindmap.updateNode(selected.id, {
                images: imagesList,
                customWidth: undefined,
                customHeight: undefined
              });
              this.saveCurrentMap(false);
              this.renderMap();
              showToast('📷 Đã tự động dán & tối ưu hình ảnh vào Node!', 'success', 2500);
            }
          }
        }
      }
      if (imagePasted) {
        e.preventDefault();
      }
    });
  }

  setupLineMenuListeners() {
    // Legacy alias redirecting to line context box
  }

  setupLineContextBoxListeners() {
    const box = $('#line-context-box');
    if (!box) return;

    $('#line-box-close')?.addEventListener('click', () => {
      box.classList.add('hidden');
      this.allLinesSelected = false;
      this.selectedLineChildId = null;
      this.selectedConnectionId = null;
      if (this.renderer) this.renderer.selectedConnectionId = null;
      $('#btn-select-all-lines')?.classList.remove('active');
      this.renderMap();
    });

    box.querySelectorAll('.line-val-btn[data-width]').forEach(btn => {
      btn.addEventListener('click', () => {
        box.querySelectorAll('.line-val-btn[data-width]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const width = parseInt(btn.dataset.width);
        if (this.selectedConnectionId) {
          this.mindmap.updateConnection(this.selectedConnectionId, { lineWidth: width });
        } else if (this.selectedLineChildId) {
          this.mindmap.updateNode(this.selectedLineChildId, { lineWidth: width });
        } else {
          this.mindmap.setGlobalLineStyle({ width });
          this.mindmap.getAllNodes().forEach(n => n.lineWidth = width);
        }
        this.renderMap();
      });
    });

    box.querySelectorAll('.line-val-btn[data-opacity]').forEach(btn => {
      btn.addEventListener('click', () => {
        box.querySelectorAll('.line-val-btn[data-opacity]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const opacity = parseFloat(btn.dataset.opacity);
        if (this.selectedConnectionId) {
          this.mindmap.updateConnection(this.selectedConnectionId, { lineOpacity: opacity });
        } else if (this.selectedLineChildId) {
          this.mindmap.updateNode(this.selectedLineChildId, { lineOpacity: opacity });
        } else {
          this.mindmap.setGlobalLineStyle({ opacity });
          this.mindmap.getAllNodes().forEach(n => n.lineOpacity = opacity);
        }
        this.renderMap();
      });
    });

    box.querySelectorAll('.line-val-btn[data-dash]').forEach(btn => {
      btn.addEventListener('click', () => {
        box.querySelectorAll('.line-val-btn[data-dash]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const dash = btn.dataset.dash;
        if (this.selectedConnectionId) {
          this.mindmap.updateConnection(this.selectedConnectionId, { lineDash: dash });
        } else if (this.selectedLineChildId) {
          this.mindmap.updateNode(this.selectedLineChildId, { lineDash: dash });
        } else {
          this.mindmap.setGlobalLineStyle({ dash });
          this.mindmap.getAllNodes().forEach(n => n.lineDash = dash);
        }
        this.renderMap();
      });
    });

    box.querySelectorAll('.line-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        box.querySelectorAll('.line-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const color = swatch.dataset.lineColor;
        if (this.selectedConnectionId) {
          this.mindmap.updateConnection(this.selectedConnectionId, { lineColor: color === 'inherit' ? null : color });
        } else if (this.selectedLineChildId) {
          this.mindmap.updateNode(this.selectedLineChildId, { lineColor: color === 'inherit' ? null : color });
        } else {
          this.mindmap.setGlobalLineStyle({ color: color === 'inherit' ? null : color });
          this.mindmap.getAllNodes().forEach(n => n.lineColor = color === 'inherit' ? null : color);
        }
        this.renderMap();
      });
    });

    box.querySelectorAll('.line-arrow-val-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        box.querySelectorAll('.line-arrow-val-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const arrow = btn.dataset.arrow;
        if (this.selectedConnectionId) {
          this.mindmap.updateConnection(this.selectedConnectionId, { lineArrow: arrow });
        } else if (this.selectedLineChildId) {
          this.mindmap.updateNode(this.selectedLineChildId, { lineArrow: arrow });
        } else {
          this.mindmap.setGlobalLineStyle({ arrow });
          this.mindmap.getAllNodes().forEach(n => n.lineArrow = arrow);
        }
        this.renderMap();
      });
    });

    // Line Text / Label input
    const textInput = $('#line-text-input');
    if (textInput) {
      textInput.addEventListener('input', () => {
        const val = textInput.value;
        if (this.selectedConnectionId) {
          this.mindmap.updateConnection(this.selectedConnectionId, { lineText: val });
          this.renderMap();
        } else if (this.selectedLineChildId) {
          this.mindmap.updateNode(this.selectedLineChildId, { lineText: val });
          this.renderMap();
        }
      });
    }

    $('#btn-delete-line')?.addEventListener('click', () => {
      if (this.selectedConnectionId) {
        this.mindmap.removeConnection(this.selectedConnectionId);
        this.selectedConnectionId = null;
        if (this.renderer) this.renderer.selectedConnectionId = null;
        box.classList.add('hidden');
        showToast('Đã xóa đường nối tự do!', 'success', 2000);
        this.renderMap();
      } else if (this.selectedLineChildId) {
        this.mindmap.detachNode(this.selectedLineChildId);
        this.selectedLineChildId = null;
        box.classList.add('hidden');
        showToast('Tách Node thành công! Node đã trở thành Central Topic tự do.', 'success', 2500);
      } else {
        showToast('Vui lòng chọn 1 line cụ thể để tách node', 'info', 2000);
      }
    });
  }

  // ==================== MODAL MANAGEMENT ====================

  setupModalListeners() {
    // Close modals on overlay click or close button
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-overlay').classList.remove('open');
      });
    });

    // Export options
    document.querySelectorAll('.export-option').forEach(opt => {
      opt.addEventListener('click', async () => {
        const format = opt.dataset.format;
        await this.handleExport(format);
        this.closeAllModals();
      });
    });

    // AI generate
    $('#btn-ai-generate').addEventListener('click', () => this.handleAIGenerate());

    // AI save key
    $('#btn-save-api-key').addEventListener('click', () => {
      const key = $('#ai-api-key').value.trim();
      if (key) {
        this.ai.setApiKey(key);
        showToast(this.i18n.t('toast.saved'), 'success');
      }
    });
  }

  showModal(id) {
    const modal = $(`#${id}`);
    if (modal) modal.classList.add('open');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }

  // ==================== PROPERTIES PANEL LISTENERS ====================

  setupPropertiesPanelListeners() {
    // Color picker
    document.querySelectorAll('#color-picker .color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color || null;
        const selected = this.mindmap.getSelectedNode();
        if (selected) {
          this.mindmap.updateNode(selected.id, { color });
          this.updatePropertiesPanel(selected.id);
        }
      });
    });

    // Icon picker
    document.querySelectorAll('#icon-picker .icon-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const icon = opt.dataset.icon;
        const selected = this.mindmap.getSelectedNode();
        if (selected) {
          this.mindmap.updateNode(selected.id, { icon });
        }
      });
    });

    // Notes textarea
    const notesEl = $('#node-notes');
    notesEl.addEventListener('input', debounce(() => {
      const selected = this.mindmap.getSelectedNode();
      if (selected) {
        this.mindmap.updateNode(selected.id, { notes: notesEl.value });
      }
    }, 500));

    // Close properties panel
    $('#btn-close-props').addEventListener('click', () => this.hidePropertiesPanel());

    // Open properties panel on node select with color/icon click
    // Will show automatically when context menu "color" or "icon" action is used
  }

  // ==================== CONTEXT MENU LISTENERS ====================

  setupContextMenuListeners() {
    const menu = $('#context-menu');

    menu.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.hideContextMenu();

        const selected = this.mindmap.getSelectedNode();
        if (!selected && action !== 'paste') return;

        switch (action) {
          case 'addChild': {
            const newNode = this.mindmap.addChild(selected.id, this.i18n.t('node.defaultText'));
            if (newNode) {
              this.mindmap.selectNode(newNode.id);
              setTimeout(() => this.startEditing(newNode.id), 100);
            }
            break;
          }
          case 'addSibling': {
            if (selected.id !== this.mindmap.root?.id) {
              const newNode = this.mindmap.addSibling(selected.id, this.i18n.t('node.defaultText'));
              if (newNode) {
                this.mindmap.selectNode(newNode.id);
                setTimeout(() => this.startEditing(newNode.id), 100);
              }
            }
            break;
          }
          case 'connect':
            if (selected) {
              this.connectingSourceNodeId = selected.id;
              this.connectMode = 'reparent';
              const el = this.renderer.nodeElements.get(selected.id);
              if (el) el.classList.add('connecting-source');
              showToast('🔗 Đang ở chế độ Nối Node: Click chọn Node mục tiêu để nối line!', 'info', 3500);
            }
            break;
          case 'freeline':
            if (selected) {
              this.connectingSourceNodeId = selected.id;
              this.connectMode = 'freeline';
              const el = this.renderer.nodeElements.get(selected.id);
              if (el) el.classList.add('connecting-source');
              showToast('↗️ Đang ở chế độ Vẽ Line tự do: Click chọn Node mục tiêu để kết nối!', 'info', 3500);
            }
            break;
          case 'edit':
            this.openRightEditorPanel(selected ? selected.id : null);
            break;
          case 'delete':
            if (selected.id === this.mindmap.root?.id) {
              showToast(this.i18n.t('toast.cannotDeleteRoot'), 'error');
              return;
            }
            const parent = this.mindmap.getParent(selected.id);
            this.mindmap.deleteNode(selected.id);
            if (parent) this.mindmap.selectNode(parent.id);
            showToast(this.i18n.t('toast.deleted'), 'info', 2000);
            break;
          case 'color':
          case 'icon':
          case 'notes':
            this.showPropertiesPanel();
            break;
          case 'math':
            this.mathEditor.open(selected ? selected.id : null);
            break;
          case 'image':
            this.triggerImageUpload(selected ? selected.id : null);
            break;
          case 'collapse':
            this.mindmap.toggleCollapse(selected.id);
            break;
          case 'copy':
            this.clipboard = this.mindmap.copySubtree(selected.id);
            showToast(this.i18n.t('toast.copied'), 'success', 2000);
            break;
          case 'paste':
            if (selected && this.clipboard) {
              this.mindmap.pasteSubtree(selected.id, this.clipboard);
              showToast(this.i18n.t('toast.pasted'), 'success', 2000);
            }
            break;
          case 'aiExpand':
            this.handleAIExpand(selected);
            break;
          case 'autofitNode':
            if (selected) {
              this.autofitNode(selected.id);
            }
            break;
          case 'resetPosition':
            if (selected) {
              this.mindmap.resetPositions(selected.id);
              this.renderMap();
            }
            break;
          case 'notes':
            this.showPropertiesPanel();
            setTimeout(() => {
              const notesEl = $('#node-notes');
              if (notesEl) notesEl.focus();
            }, 50);
            break;
        }
      });
    });

    // Close context menu on any click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#context-menu')) {
        this.hideContextMenu();
      }
    });
  }

  // ==================== CANVAS CLICK ====================

  setupCanvasClickListener() {
    const deselectAndExitNode = (e) => {
      if (e && e.target && e.target.closest && e.target.closest('.mindmap-node')) return;

      // IMPORTANT: stopEditing FIRST (before deselect) so it can find the editing node
      if (this.isEditing) {
        this.stopEditing();
      }
      if (this.mindmap && this.mindmap.getSelectedNode()) {
        this.mindmap.selectNode(null);
      }
      this.savedTextRange = null;
      try { window.getSelection().removeAllRanges(); } catch (err) {}
      this.hideAllContextBoxes();
    };

    $('#mindmap-canvas')?.addEventListener('click', deselectAndExitNode);
    $('#mindmap-canvas')?.addEventListener('dblclick', deselectAndExitNode);
    $('#canvas-transform')?.addEventListener('click', deselectAndExitNode);
    $('#canvas-transform')?.addEventListener('dblclick', deselectAndExitNode);

    document.addEventListener('click', (e) => {
      if (e.target.closest('#mindmap-canvas') && !e.target.closest('.mindmap-node')) {
        deselectAndExitNode(e);
      }
      if (!e.target.closest('#line-context-box') && !e.target.closest('#btn-select-all-lines') && !e.target.closest('.connector-path')) {
        $('#line-context-box')?.classList.add('hidden');
      }
      if (!e.target.closest('#node-formatting-bar') && !e.target.closest('.mindmap-node')) {
        $('#node-formatting-bar')?.classList.add('hidden');
      }
      if (!e.target.closest('#context-menu')) {
        this.hideContextMenu();
      }
    });

    document.addEventListener('dblclick', (e) => {
      if (e.target.closest('#mindmap-canvas') && !e.target.closest('.mindmap-node')) {
        deselectAndExitNode(e);
      }
    });

    $('#mindmap-canvas')?.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('.mindmap-node')) {
        e.preventDefault();
        this.hideAllContextBoxes();
      }
    });
  }

  // ==================== AUTOSAVE LISTENER ====================

  setupAutoSaveListener() {
    document.addEventListener('mindflow:autosaved', () => {
      const indicator = $('#save-indicator');
      const status = $('#save-status');
      if (indicator) indicator.classList.remove('unsaved');
      if (status) status.textContent = this.i18n.t('status.autoSaved');
    });
  }


  // ==================== SAVE / LOAD ====================

  saveCurrentMap(showToastMessage = true) {
    if (!this.mindmap) return;
    if (!this.currentMapId) {
      this.currentMapId = generateId();
    }

    this.currentMapName = $('#map-name')?.value?.trim() || this.i18n.t('map.untitled');
    this.storage.saveMap(this.currentMapId, {
      id: this.currentMapId,
      name: this.currentMapName,
      tree: this.mindmap.toJSON(),
    });
    this.storage.setPreference('lastMapId', this.currentMapId);
    if (showToastMessage) {
      showToast('💾 Đã lưu thành công sơ đồ vào hệ thống!', 'success', 2500);
    }

    if (this.gdrive && this.gdrive.isConnected()) {
      this.handleGDriveSave();
    }
  }

  setupGlobalPasteSanitizer() {
    document.addEventListener('paste', (e) => {
      const target = e.target;
      if (target && (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        const textData = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
        if (textData && (textData.includes('katex') || textData.includes('<div class="katex'))) {
          e.preventDefault();
          const cleaned = textData.replace(/<div class="katex-rendered[^"]*">[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/div>/gi, '$1')
                                  .replace(/<span class="katex-display">[\s\S]*?<\/span>/gi, '')
                                  .replace(/<span class="katex">[\s\S]*?<\/span>/gi, '')
                                  .replace(/<div class="katex-rendered[^"]*">[\s\S]*?<\/div>/gi, '');
          if (document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, cleaned);
          } else {
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(document.createTextNode(cleaned));
            }
          }
        }
      }
    });
  }

  triggerImageUpload(targetNodeId = null) {
    const node = targetNodeId ? this.mindmap.findNode(targetNodeId) : (this.mindmap.getSelectedNode() || this.mindmap.root);
    if (!node) {
      showToast('Vui lòng chọn Node để chèn hình ảnh!', 'warning', 2500);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files || files.length === 0) return;

      showToast(`🖼️ Đang nạp và tối ưu ${files.length} hình ảnh...`, 'info', 3000);
      let existingImages = node.images ? [...node.images] : (node.image ? [{ src: node.image, width: 160, height: 100 }] : []);

      for (const file of files) {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.readAsDataURL(file);
        });

        const compressedUrl = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            const maxDim = 1920;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/webp', 0.82));
          };
          img.onerror = () => resolve(dataUrl);
          img.src = dataUrl;
        });

        existingImages.push({ src: compressedUrl, width: 160, height: 100 });
      }

      this.mindmap.updateNode(node.id, {
        images: existingImages,
        customWidth: undefined,
        customHeight: undefined
      });
      this.renderMap();
      this.saveCurrentMap(true);
      showToast(`✅ Đã chèn thành công ${files.length} hình ảnh vào Node!`, 'success', 2500);
    };
    input.click();
  }

  async showOpenMapModal() {
    try {
      this.hideAllContextBoxes();
      const mapList = await this.storage.getMapListAsync();
      const listEl = $('#map-list');
      if (!listEl) return;
      listEl.innerHTML = '';

      if (!mapList || mapList.length === 0) {
        listEl.innerHTML = `<div class="map-list-empty" data-i18n="map.empty">${this.i18n.t('map.empty')}</div>`;
      } else {
        mapList.forEach(map => {
          const dateStr = map.updatedAt ? new Date(map.updatedAt).toLocaleString() : '';
          const isActive = map.id === this.currentMapId;
          const item = document.createElement('div');
          item.className = `map-list-item ${isActive ? 'active-map' : ''}`;
          item.style.cursor = 'pointer';
          item.innerHTML = `
            <div class="map-info">
              <div class="map-name">${map.name || this.i18n.t('map.untitled')} ${isActive ? '<span class="active-badge">● Đang mở</span>' : ''}</div>
              <div class="map-date">${dateStr}</div>
            </div>
            <div class="map-actions">
              <button class="toolbar-btn btn-delete-map" data-map-id="${map.id}" title="${this.i18n.t('map.delete')}" style="width: 28px; height: 28px; color: #EF4444;">
                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          `;

          item.addEventListener('click', async (e) => {
            if (e.target.closest('.btn-delete-map')) return;
            this.closeAllModals();
            await this.loadMapById(map.id);
          });

          const delBtn = item.querySelector('.btn-delete-map');
          delBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
          });
          delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            const targetName = map.name || 'sơ đồ này';
            if (confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn sơ đồ "${targetName}" khỏi hệ thống không?`)) {
              const isDeletingCurrent = (map.id === this.currentMapId);
              this.storage.deleteMap(map.id);
              if (isDeletingCurrent) {
                this.currentMapId = null;
                const remainingMaps = await this.storage.getMapListAsync();
                if (remainingMaps.length > 0) {
                  await this.loadMapById(remainingMaps[0].id);
                } else {
                  this.createNewMap();
                }
              }
              this.showOpenMapModal();
              showToast('🗑️ Đã xóa vĩnh viễn sơ đồ khỏi hệ thống!', 'info', 2500);
            }
          });

          listEl.appendChild(item);
        });
      }

      this.showModal('open-modal');
    } catch (err) {
      console.error('Failed to show open map modal:', err);
      showToast('Có lỗi khi mở danh sách sơ đồ: ' + err.message, 'error', 3000);
    }
  }

  async loadMapById(id) {
    try {
      if (this.currentMapId && this.currentMapId !== id && this.mindmap && this.mindmap.root) {
        try { this.saveCurrentMap(false); } catch (e) {}
      }

      const mapData = (await this.storage.loadMapAsync(id)) || this.storage.loadMap(id);
      if (!mapData) {
        showToast('Không tìm thấy dữ liệu bản đồ!', 'error', 3000);
        return;
      }

      const treeData = mapData.tree || mapData;
      this.currentMapId = id;
      this.currentMapName = mapData.name || (treeData && treeData.name) || this.i18n.t('map.untitled');

      const loadOk = this.mindmap.fromJSON(treeData);
      if (!loadOk) {
        showToast('Không thể nạp dữ liệu sơ đồ!', 'error', 3000);
        return;
      }

      if (this.mindmap.root) {
        this.mindmap.selectNode(this.mindmap.root.id);
      } else {
        this.mindmap.selectNode(null);
      }

      this.nodeEditorHistories?.clear();
      this.history.init(this.mindmap.toJSON());
      this.storage.setPreference('lastMapId', this.currentMapId);
      if ($('#map-name')) $('#map-name').value = this.currentMapName;
      this.renderMap();
      setTimeout(() => this.centerView(), 100);
      showToast(`✅ Đã chuyển sang bản đồ "${this.currentMapName}"`, 'success', 2000);
    } catch (error) {
      console.error('Failed in loadMapById:', error);
      showToast('Có lỗi khi chuyển bản đồ: ' + error.message, 'error', 3000);
    }
  }

  // ==================== EXPORT / IMPORT ====================

  async handleExport(format) {
    if (!this.mindmap.root) return;

    const name = this.currentMapName || 'mindmap';
    try {
      const fullTreeData = this.mindmap.toJSON(true);
      switch (format) {
        case 'png':
          this.exporter.exportPNG($('#canvas-transform'), $('#svg-connectors'), `${name}.png`, this.mindmap.root, this.lastLayoutData, this.lastBounds);
          break;
        case 'svg':
          this.exporter.exportSVG($('#canvas-transform'), $('#svg-connectors'), `${name}.svg`, this.mindmap.root, this.lastLayoutData, this.lastBounds);
          break;
        case 'json':
          this.exporter.exportJSON(fullTreeData, name, `${name}.json`);
          break;
        case 'mindflow':
          await this.exporter.exportCompressed(fullTreeData, name, `${name}.mindflow`);
          break;
        case 'markdown':
          this.exporter.exportMarkdown(this.mindmap.roots && this.mindmap.roots.length > 1 ? this.mindmap.roots : this.mindmap.root, `${name}.md`);
          break;
      }
      showToast(this.i18n.t('toast.exported'), 'success');
    } catch (e) {
      showToast(this.i18n.t('toast.error'), 'error');
      console.error('Export failed:', e);
    }
  }

  async applyImportedResult(result) {
    if (!result || !result.tree) {
      throw new Error('Dữ liệu sơ đồ rỗng hoặc không đúng cấu trúc.');
    }

    if (this.currentMapId && this.mindmap && this.mindmap.root) {
      try { this.saveCurrentMap(false); } catch (e) {}
    }

    this.currentMapId = generateId();
    this.currentMapName = result.name || this.i18n.t('map.untitled');
    if ($('#map-name')) $('#map-name').value = this.currentMapName;

    const loadOk = this.mindmap.fromJSON(result.tree);
    if (!loadOk) {
      throw new Error('Không thể nạp cấu trúc sơ đồ vào MindMap.');
    }

    if (this.mindmap.root) {
      this.mindmap.selectNode(this.mindmap.root.id);
    }
    this.nodeEditorHistories?.clear();
    this.history.init(this.mindmap.toJSON());

    // Immediately persist imported map to storage & database
    this.saveCurrentMap(false);

    this.renderMap();
    setTimeout(() => this.centerView(), 100);
    showToast(`📥 Đã nhập thành công sơ đồ: "${this.currentMapName}"`, 'success', 2500);
    return true;
  }

  async handleImport() {
    try {
      const result = await this.importer.openFileDialog('.mindflow,.json,.md,.txt,.gz', (pct, msg) => {
        showToast(`⏳ [${pct}%] ${msg}`, 'info', 1500);
      });
      if (result) {
        await this.applyImportedResult(result);
      }
    } catch (e) {
      showToast(e.message || this.i18n.t('toast.error'), 'error', 3500);
      console.error('Import failed:', e);
    }
  }

  setupFileDropListener() {
    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    window.addEventListener('drop', async (e) => {
      if (e.target && e.target.closest && (e.target.closest('#right-editor-panel') || e.target.closest('#right-images-gallery'))) {
        return;
      }

      const files = e.dataTransfer ? e.dataTransfer.files : [];
      if (!files || files.length === 0) return;

      const file = files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      const mindmapExts = ['mindflow', 'json', 'md', 'txt', 'gz'];

      if (mindmapExts.includes(ext) || file.type.includes('json') || file.type.includes('markdown') || file.type.includes('text')) {
        e.preventDefault();
        e.stopPropagation();
        try {
          showToast(`⏳ Đang đọc file sơ đồ: ${file.name}...`, 'info', 2000);
          const result = await this.importer.parseFile(file, (pct, msg) => {
            showToast(`⏳ [${pct}%] ${msg}`, 'info', 1500);
          });
          if (result) {
            await this.applyImportedResult(result);
          }
        } catch (err) {
          showToast(err.message || 'Lỗi khi nhập file', 'error', 3500);
          console.error('Drag drop import failed:', err);
        }
      }
    });
  }

  // ==================== AI ====================

  showAIModal() {
    const keyInput = $('#ai-api-key');
    if (this.ai.hasApiKey()) {
      keyInput.value = '••••••••••••••••';
    }
    $('#ai-status').textContent = '';
    this.showModal('ai-modal');
  }

  async handleAIGenerate() {
    const prompt = $('#ai-prompt').value.trim();
    if (!prompt) return;

    if (!this.ai.hasApiKey()) {
      const key = $('#ai-api-key').value.trim();
      if (key && key !== '••••••••••••••••') {
        this.ai.setApiKey(key);
      } else {
        showToast(this.i18n.t('ai.noKey'), 'error');
        return;
      }
    }

    const statusEl = $('#ai-status');
    const btnGenerate = $('#btn-ai-generate');
    statusEl.textContent = this.i18n.t('ai.generating');
    statusEl.style.color = 'var(--color-primary)';
    btnGenerate.disabled = true;

    try {
      const treeData = await this.ai.generateMindmap(prompt);
      if (treeData) {
        this.currentMapId = generateId();
        this.currentMapName = treeData.text || prompt.substring(0, 30);
        this.mindmap.fromJSON(treeData);
        this.mindmap._rebuildNodeMap();

        // Ensure all nodes have IDs
        this.mindmap._traverseTree(this.mindmap.root, (node) => {
          if (!node.id) node.id = generateId();
          if (!node.children) node.children = [];
          if (node.collapsed === undefined) node.collapsed = false;
          if (node.notes === undefined) node.notes = '';
          if (node.x === undefined) { node.x = 0; node.y = 0; }
          if (node.width === undefined) { node.width = 0; node.height = 0; }
        });
        this.mindmap._rebuildNodeMap();

        if (this.mindmap.root) {
          this.mindmap.selectNode(this.mindmap.root.id);
        }

        this.nodeEditorHistories?.clear();
        this.history.init(this.mindmap.toJSON());
        this.storage.setPreference('lastMapId', this.currentMapId);
        $('#map-name').value = this.currentMapName;
        this.renderMap();
        setTimeout(() => this.centerView(), 100);

        this.closeAllModals();
        showToast(this.i18n.t('toast.imported'), 'success');
      }
    } catch (e) {
      statusEl.textContent = e.message || this.i18n.t('ai.error');
      statusEl.style.color = '#EF4444';
      console.error('AI generation failed:', e);
    } finally {
      btnGenerate.disabled = false;
    }
  }

  async handleAIExpand(node) {
    if (!node) return;

    if (!this.ai.hasApiKey()) {
      showToast(this.i18n.t('ai.noKey'), 'error');
      this.showAIModal();
      return;
    }

    showToast(this.i18n.t('ai.generating'), 'info', 5000);

    try {
      const suggestions = await this.ai.expandNode(node.text, node.children || []);
      if (suggestions && suggestions.length > 0) {
        suggestions.forEach(s => {
          const newNode = this.mindmap.addChild(node.id, s.text);
          if (newNode) {
            this.mindmap.updateNode(newNode.id, {
              icon: s.icon || '',
              color: s.color || node.color
            });
          }
        });
        showToast(this.i18n.t('toast.pasted'), 'success');
      }
    } catch (e) {
      showToast(e.message || this.i18n.t('ai.error'), 'error');
      console.error('AI expand failed:', e);
    }
  }

  // ==================== GOOGLE DRIVE ====================

  showGDriveModal() {
    const clientIdInput = $('#gdrive-client-id');
    if (clientIdInput && this.gdrive.clientId) {
      clientIdInput.value = this.gdrive.clientId;
    }

    this.updateGDriveUI();

    // Attach button listeners inside modal
    const btnAuth = $('#btn-gdrive-auth');
    if (btnAuth && !btnAuth._hasDriveListener) {
      btnAuth._hasDriveListener = true;
      btnAuth.addEventListener('click', () => this.handleGDriveAuth());
    }

    const btnSaveClientId = $('#btn-save-gdrive-client-id');
    if (btnSaveClientId && !btnSaveClientId._hasDriveListener) {
      btnSaveClientId._hasDriveListener = true;
      btnSaveClientId.addEventListener('click', () => {
        const val = $('#gdrive-client-id').value.trim();
        if (val) {
          this.gdrive.setClientId(val);
          showToast(this.i18n.t('toast.saved'), 'success');
        }
      });
    }

    const btnSaveToken = $('#btn-save-gdrive-token');
    if (btnSaveToken && !btnSaveToken._hasDriveListener) {
      btnSaveToken._hasDriveListener = true;
      btnSaveToken.addEventListener('click', async () => {
        const rawInput = $('#gdrive-access-token').value;
        const tokenVal = rawInput ? rawInput.replace(/^["']|["']$/g, '').trim() : '';
        if (tokenVal) {
          try {
            await this.gdrive.setToken(tokenVal);
            this.updateGDriveUI();
            showToast('Đã kết nối Google Drive thành công!', 'success');
          } catch (e) {
            showToast(e.message || 'Lỗi kết nối Token Google Drive', 'error');
          }
        } else {
          showToast('Vui lòng nhập Access Token hợp lệ', 'error');
        }
      });
    }

    const btnSaveCurrent = $('#btn-gdrive-save-current');
    if (btnSaveCurrent && !btnSaveCurrent._hasDriveListener) {
      btnSaveCurrent._hasDriveListener = true;
      btnSaveCurrent.addEventListener('click', () => this.handleGDriveSave());
    }

    const btnOpenFile = $('#btn-gdrive-open-file');
    if (btnOpenFile && !btnOpenFile._hasDriveListener) {
      btnOpenFile._hasDriveListener = true;
      btnOpenFile.addEventListener('click', () => this.handleGDriveOpen());
    }

    this.showModal('gdrive-modal');
  }

  updateGDriveUI() {
    const isConnected = this.gdrive.isConnected();
    const userNameEl = $('#gdrive-user-name');
    const userEmailEl = $('#gdrive-user-email');
    const btnAuth = $('#btn-gdrive-auth');

    if (isConnected) {
      if (userNameEl) userNameEl.textContent = this.gdrive.user?.name ? `${this.i18n.t('gdrive.connectedAs')} ${this.gdrive.user.name}` : 'Connected';
      if (userEmailEl) userEmailEl.textContent = this.gdrive.user?.email || 'Google Drive Token Active';
      if (btnAuth) {
        btnAuth.textContent = this.i18n.t('gdrive.disconnect');
        btnAuth.classList.remove('btn-primary');
        btnAuth.classList.add('btn-secondary');
      }
    } else {
      if (userNameEl) userNameEl.textContent = this.i18n.t('gdrive.notConnected');
      if (userEmailEl) userEmailEl.textContent = 'Configure Client ID or Access Token';
      if (btnAuth) {
        btnAuth.textContent = this.i18n.t('gdrive.connect');
        btnAuth.classList.remove('btn-secondary');
        btnAuth.classList.add('btn-primary');
      }
    }
  }

  async handleGDriveAuth() {
    if (this.gdrive.isConnected()) {
      this.gdrive.disconnect();
      this.updateGDriveUI();
      showToast('Disconnected', 'info');
      return;
    }

    const clientIdInput = $('#gdrive-client-id').value.trim();
    if (clientIdInput) {
      this.gdrive.setClientId(clientIdInput);
    }

    if (!this.gdrive.hasClientId()) {
      showToast('Please enter your Google OAuth Client ID first', 'error');
      return;
    }

    try {
      showToast('Opening Google Authorization...', 'info', 3000);
      await this.gdrive.authorize();
      this.updateGDriveUI();
      showToast(this.i18n.t('toast.saved'), 'success');
    } catch (e) {
      showToast(e.message || this.i18n.t('toast.error'), 'error');
    }
  }

  async handleGDriveSave() {
    if (!this.gdrive.isConnected()) {
      if (this.gdrive.hasClientId()) {
        try {
          showToast('Opening Google Authorization (Trust Web)...', 'info', 3000);
          await this.gdrive.authorize();
          this.updateGDriveUI();
        } catch (authErr) {
          showToast(authErr.message || this.i18n.t('gdrive.notConnected'), 'error');
          return;
        }
      } else {
        showToast(this.i18n.t('gdrive.notConnected'), 'error');
        this.showGDriveModal();
        return;
      }
    }

    if (!this.mindmap.root) return;

    showToast(this.i18n.t('gdrive.saving'), 'info', 3000);

    try {
      const name = this.currentMapName || 'Untitled Map';
      const treeData = {
        version: '1.0',
        name: name,
        savedAt: new Date().toISOString(),
        tree: this.mindmap.root
      };

      let result;
      if (!this.currentMapDriveId && this.pendingDriveFolderId) {
        result = await this.gdrive.createFileInFolder(name, JSON.stringify(treeData, null, 2), this.pendingDriveFolderId);
        this.pendingDriveFolderId = null;
      } else {
        result = await this.gdrive.saveFile(name, JSON.stringify(treeData, null, 2), this.currentMapDriveId || null);
      }
      if (result && result.id) {
        this.currentMapDriveId = result.id;
      }
      showToast('Đã lưu sơ đồ lên Google Drive (.mindflow)!', 'success');
    } catch (e) {
      showToast(e.message || this.i18n.t('toast.error'), 'error');
    }
  }

  async handleGDriveOpen() {
    if (!this.gdrive.isConnected()) {
      showToast(this.i18n.t('gdrive.notConnected'), 'error');
      return;
    }

    const listContainer = $('#gdrive-file-list');
    listContainer.style.display = 'block';
    listContainer.innerHTML = '<div class="map-list-empty">Loading Google Drive (.mindflow) files...</div>';

    try {
      const files = await this.gdrive.listFiles();
      listContainer.innerHTML = '';

      if (files.length === 0) {
        listContainer.innerHTML = '<div class="map-list-empty">No .mindflow files found on Google Drive</div>';
        return;
      }

      files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'map-list-item';
        const dateStr = file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : '';
        item.innerHTML = `
          <div class="map-info">
            <div class="map-name">📄 ${file.name}</div>
            <div class="map-date">${dateStr}</div>
          </div>
        `;
        item.addEventListener('click', async () => {
          try {
            showToast(this.i18n.t('gdrive.loading'), 'info', 3000);
            const content = await this.gdrive.loadFile(file.id);
            const tree = content.tree || content;
            this.currentMapId = generateId();
            this.currentMapDriveId = file.id;
            this.currentMapName = content.name || file.name.replace(/\.(mindflow|json)$/i, '');
            this.mindmap.fromJSON(tree);
            if (this.mindmap.root) {
              this.mindmap.selectNode(this.mindmap.root.id);
            }
            this.history.init(this.mindmap.toJSON());
            $('#map-name').value = this.currentMapName;
            this.renderMap();
            setTimeout(() => this.centerView(), 100);
            this.closeAllModals();
            showToast(this.i18n.t('toast.imported'), 'success');
          } catch (err) {
            showToast('Failed to load file from Google Drive', 'error');
          }
        });
        listContainer.appendChild(item);
      });
    } catch (e) {
      listContainer.innerHTML = `<div class="map-list-empty" style="color: #EF4444;">${e.message || 'Failed to list files'}</div>`;
    }
  }

  // ==================== HELPERS ====================

  clampToViewport(element) {
    if (!element || element.classList.contains('hidden')) return;
    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Clamp right
      if (rect.right > vw - 10) {
        element.style.left = `${Math.max(10, vw - rect.width - 10)}px`;
      }
      // Clamp left
      if (rect.left < 10) {
        element.style.left = '10px';
      }
      // Clamp bottom
      if (rect.bottom > vh - 10) {
        element.style.top = `${Math.max(10, vh - rect.height - 10)}px`;
      }
      // Clamp top
      if (rect.top < 10) {
        element.style.top = '10px';
      }
    });
  }

  // ==================== RIGHT EDITOR PANEL ====================

  openRightEditorPanel(nodeId) {
    const node = nodeId ? this.mindmap.findNode(nodeId) : this.mindmap.getSelectedNode();
    if (!node) return;

    this.editingRightNodeId = node.id;
    this.mindmap.selectNode(node.id);
    this.hideAllContextBoxes();

    const drawer = $('#right-editor-panel');
    const content = $('#right-editor-content');

    if (content) {
      let rawText = node.text || '';
      if (rawText.includes('katex-rendered')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = rawText;
        rawText = this.renderer.extractTextWithNewlines(tempDiv);
      }
      const hasHtml = /<\/?(?:span|div|p|b|strong|i|em|u|s|strike|font|img|br|ul|ol|li)\b[^>]*>/i.test(rawText);
      if (hasHtml) {
        content.innerHTML = rawText;
      } else {
        content.innerHTML = rawText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
      }

      // Backward compatibility: Convert existing node.images into inline <img> tags if not already present
      const imagesList = node.images || (node.image ? [typeof node.image === 'string' ? { src: node.image } : node.image] : []);
      if (Array.isArray(imagesList) && imagesList.length > 0) {
        imagesList.forEach(imgObj => {
          const src = typeof imgObj === 'string' ? imgObj : (imgObj ? imgObj.src : null);
          const w = imgObj && imgObj.width ? imgObj.width : 160;
          if (src && !content.innerHTML.includes(src.substring(0, 50))) {
            const img = document.createElement('img');
            img.src = src;
            img.className = 'inline-editor-image';
            img.style.width = `${w}px`;
            img.style.maxWidth = '100%';
            img.style.display = 'inline-block';
            img.style.verticalAlign = 'middle';
            img.style.margin = '4px 6px';
            img.contentEditable = 'false';
            content.appendChild(img);
          }
        });
      }

      content.style.textAlign = node.textAlign || 'left';
    }

    if ($('#right-fmt-font-size')) $('#right-fmt-font-size').value = String(node.fontSize || 14);
    if ($('#right-fmt-font-family')) $('#right-fmt-font-family').value = node.fontFamily || 'Inter';

    const imagesList = node.images || (node.image ? [typeof node.image === 'string' ? { src: node.image } : node.image] : []);
    this.rightEditorImages = deepClone(imagesList);
    this.renderRightEditorImages();

    // Load or initialize persistent undo/redo history for this specific node
    this.loadOrCreateRightEditorHistory(node.id);

    try {
      const savedWidth = parseInt(localStorage.getItem('mindflow_context_box_width'), 10);
      if (savedWidth && savedWidth >= 380 && savedWidth <= window.innerWidth - 40) {
        drawer.style.width = `${savedWidth}px`;
      }
    } catch (err) {}

    drawer?.classList.add('open');
    setTimeout(() => {
      content?.focus();
    }, 50);
  }

  closeRightEditorPanel() {
    const drawer = $('#right-editor-panel');
    if (drawer) {
      drawer.classList.remove('open');
      if (document.activeElement && drawer.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    }
    this.editingRightNodeId = null;
    this.rightEditorImages = [];
    this.rightEditorHistory = null;
    window.focus();
  }

  loadOrCreateRightEditorHistory(nodeId) {
    const contentEl = $('#right-editor-content');
    const currentSnapshot = {
      html: contentEl ? contentEl.innerHTML : '',
      images: deepClone(this.rightEditorImages || []),
      fontSize: $('#right-fmt-font-size')?.value || '14',
      fontFamily: $('#right-fmt-font-family')?.value || 'Inter'
    };
    const currentSnapJson = JSON.stringify(currentSnapshot);

    if (this.nodeEditorHistories.has(nodeId)) {
      this.rightEditorHistory = this.nodeEditorHistories.get(nodeId);
      this.rightEditorHistory.isPerforming = false;

      // If the node content changed externally (e.g. from canvas or global undo), record the transition
      if (this.rightEditorHistory.lastSnapshot !== currentSnapJson) {
        if (this.rightEditorHistory.lastSnapshot !== null) {
          this.rightEditorHistory.undoStack.push(this.rightEditorHistory.lastSnapshot);
          if (this.rightEditorHistory.undoStack.length > 50) {
            this.rightEditorHistory.undoStack.shift();
          }
        }
        this.rightEditorHistory.lastSnapshot = currentSnapJson;
        this.rightEditorHistory.redoStack = [];
      }
    } else {
      this.rightEditorHistory = {
        undoStack: [],
        redoStack: [],
        isPerforming: false,
        lastSnapshot: currentSnapJson
      };
      this.nodeEditorHistories.set(nodeId, this.rightEditorHistory);
    }

    this.updateRightEditorUndoRedoButtons();
  }

  saveRightEditorLocalState() {
    if (!this.rightEditorHistory || this.rightEditorHistory.isPerforming) return;
    const contentEl = $('#right-editor-content');
    if (!contentEl) return;

    const snapshot = {
      html: contentEl.innerHTML,
      images: deepClone(this.rightEditorImages || []),
      fontSize: $('#right-fmt-font-size')?.value || '14',
      fontFamily: $('#right-fmt-font-family')?.value || 'Inter'
    };

    const snapJson = JSON.stringify(snapshot);
    if (this.rightEditorHistory.lastSnapshot === snapJson) return;

    if (this.rightEditorHistory.lastSnapshot !== null) {
      this.rightEditorHistory.undoStack.push(this.rightEditorHistory.lastSnapshot);
      if (this.rightEditorHistory.undoStack.length > 50) {
        this.rightEditorHistory.undoStack.shift();
      }
    }
    this.rightEditorHistory.lastSnapshot = snapJson;
    this.rightEditorHistory.redoStack = [];
    this.updateRightEditorUndoRedoButtons();
  }

  undoRightEditor() {
    if (!this.rightEditorHistory || this.rightEditorHistory.undoStack.length === 0) return;
    this.rightEditorHistory.isPerforming = true;
    try {
      const contentEl = $('#right-editor-content');
      const currentSnapshot = {
        html: contentEl ? contentEl.innerHTML : '',
        images: deepClone(this.rightEditorImages || []),
        fontSize: $('#right-fmt-font-size')?.value || '14',
        fontFamily: $('#right-fmt-font-family')?.value || 'Inter'
      };
      this.rightEditorHistory.redoStack.push(JSON.stringify(currentSnapshot));

      const prevJson = this.rightEditorHistory.undoStack.pop();
      const prev = JSON.parse(prevJson);
      this.rightEditorHistory.lastSnapshot = prevJson;

      if (contentEl) contentEl.innerHTML = prev.html;
      this.rightEditorImages = prev.images || [];
      this.renderRightEditorImages();
      if ($('#right-fmt-font-size')) $('#right-fmt-font-size').value = prev.fontSize || '14';
      if ($('#right-fmt-font-family')) $('#right-fmt-font-family').value = prev.fontFamily || 'Inter';
    } finally {
      this.rightEditorHistory.isPerforming = false;
      this.updateRightEditorUndoRedoButtons();
    }
  }

  redoRightEditor() {
    if (!this.rightEditorHistory || this.rightEditorHistory.redoStack.length === 0) return;
    this.rightEditorHistory.isPerforming = true;
    try {
      const contentEl = $('#right-editor-content');
      const currentSnapshot = {
        html: contentEl ? contentEl.innerHTML : '',
        images: deepClone(this.rightEditorImages || []),
        fontSize: $('#right-fmt-font-size')?.value || '14',
        fontFamily: $('#right-fmt-font-family')?.value || 'Inter'
      };
      this.rightEditorHistory.undoStack.push(JSON.stringify(currentSnapshot));

      const nextJson = this.rightEditorHistory.redoStack.pop();
      const next = JSON.parse(nextJson);
      this.rightEditorHistory.lastSnapshot = nextJson;

      if (contentEl) contentEl.innerHTML = next.html;
      this.rightEditorImages = next.images || [];
      this.renderRightEditorImages();
      if ($('#right-fmt-font-size')) $('#right-fmt-font-size').value = next.fontSize || '14';
      if ($('#right-fmt-font-family')) $('#right-fmt-font-family').value = next.fontFamily || 'Inter';
    } finally {
      this.rightEditorHistory.isPerforming = false;
      this.updateRightEditorUndoRedoButtons();
    }
  }

  updateRightEditorUndoRedoButtons() {
    const undoBtn = $('#right-fmt-undo');
    const redoBtn = $('#right-fmt-redo');
    const canUndo = Boolean(this.rightEditorHistory && this.rightEditorHistory.undoStack.length > 0);
    const canRedo = Boolean(this.rightEditorHistory && this.rightEditorHistory.redoStack.length > 0);
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
  }

  renderRightEditorImages() {
    const gallery = $('#right-images-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';

    if (this.rightEditorImages.length === 0) {
      gallery.innerHTML = '<span style="font-size:12px; color:#94A3B8; opacity:0.7;">Chưa có hình ảnh nào. Bấm "Chèn / Dán Ảnh" hoặc Paste (Ctrl+V) để thêm.</span>';
      return;
    }

    let draggedIndex = null;

    this.rightEditorImages.forEach((imgObj, idx) => {
      const src = typeof imgObj === 'string' ? imgObj : imgObj.src;
      const thumb = document.createElement('div');
      thumb.className = 'right-img-thumb';
      thumb.draggable = true;
      thumb.dataset.index = String(idx);
      thumb.title = `Ảnh #${idx + 1} (Kéo thả hoặc dùng ◀ ▶ để sắp xếp)`;

      // Order badge #1, #2...
      const badge = document.createElement('span');
      badge.className = 'right-img-order-badge';
      badge.textContent = `#${idx + 1}`;
      thumb.appendChild(badge);

      // Image
      const img = document.createElement('img');
      img.src = src;
      img.alt = `Node image ${idx + 1}`;
      thumb.appendChild(img);

      // Delete Button
      const delBtn = document.createElement('button');
      delBtn.className = 'right-img-del';
      delBtn.textContent = '✕';
      delBtn.title = 'Xóa ảnh này';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.saveRightEditorLocalState();
        this.rightEditorImages.splice(idx, 1);
        this.renderRightEditorImages();
        this.saveRightEditorLocalState();
      });
      thumb.appendChild(delBtn);

      // Controls Bar (Move Left, Drag Grip, Move Right)
      const controls = document.createElement('div');
      controls.className = 'right-img-controls';

      // Move Left Button
      const moveLeftBtn = document.createElement('button');
      moveLeftBtn.className = 'right-img-move-btn';
      moveLeftBtn.textContent = '◀';
      moveLeftBtn.title = 'Di chuyển ảnh sang trái (lên trước)';
      if (idx === 0) {
        moveLeftBtn.disabled = true;
      } else {
        moveLeftBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.saveRightEditorLocalState();
          const temp = this.rightEditorImages[idx];
          this.rightEditorImages[idx] = this.rightEditorImages[idx - 1];
          this.rightEditorImages[idx - 1] = temp;
          this.renderRightEditorImages();
          this.saveRightEditorLocalState();
        });
      }
      controls.appendChild(moveLeftBtn);

      // Drag Grip Icon
      const dragGrip = document.createElement('span');
      dragGrip.className = 'right-img-drag-handle';
      dragGrip.textContent = '⠿';
      dragGrip.title = 'Kéo thả để đổi vị trí';
      controls.appendChild(dragGrip);

      // Move Right Button
      const moveRightBtn = document.createElement('button');
      moveRightBtn.className = 'right-img-move-btn';
      moveRightBtn.textContent = '▶';
      moveRightBtn.title = 'Di chuyển ảnh sang phải (ra sau)';
      if (idx === this.rightEditorImages.length - 1) {
        moveRightBtn.disabled = true;
      } else {
        moveRightBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.saveRightEditorLocalState();
          const temp = this.rightEditorImages[idx];
          this.rightEditorImages[idx] = this.rightEditorImages[idx + 1];
          this.rightEditorImages[idx + 1] = temp;
          this.renderRightEditorImages();
          this.saveRightEditorLocalState();
        });
      }
      controls.appendChild(moveRightBtn);

      thumb.appendChild(controls);

      // Drag and Drop Event Listeners
      thumb.addEventListener('dragstart', (e) => {
        draggedIndex = idx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        setTimeout(() => thumb.classList.add('dragging'), 0);
      });

      thumb.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!thumb.classList.contains('drag-over')) {
          thumb.classList.add('drag-over');
        }
      });

      thumb.addEventListener('dragleave', () => {
        thumb.classList.remove('drag-over');
      });

      thumb.addEventListener('drop', (e) => {
        e.preventDefault();
        thumb.classList.remove('drag-over');
        const fromIdx = draggedIndex !== null ? draggedIndex : parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIdx = idx;
        if (!isNaN(fromIdx) && fromIdx !== toIdx && fromIdx >= 0 && fromIdx < this.rightEditorImages.length) {
          this.saveRightEditorLocalState();
          const [movedItem] = this.rightEditorImages.splice(fromIdx, 1);
          this.rightEditorImages.splice(toIdx, 0, movedItem);
          this.renderRightEditorImages();
          this.saveRightEditorLocalState();
        }
      });

      thumb.addEventListener('dragend', () => {
        draggedIndex = null;
        gallery.querySelectorAll('.right-img-thumb').forEach(t => {
          t.classList.remove('dragging');
          t.classList.remove('drag-over');
        });
      });

      gallery.appendChild(thumb);
    });
  }

  applyRightEditorToNode(autoFit = false) {
    if (!this.editingRightNodeId) return;

    const contentEl = $('#right-editor-content');
    if (!contentEl) return;

    let newText = contentEl.innerHTML;
    if (newText.trim() === '' || newText.trim() === '<br>') {
      newText = 'Topic';
    }

    const fontSize = parseInt($('#right-fmt-font-size')?.value || 14);
    const fontFamily = $('#right-fmt-font-family')?.value || 'Inter';
    const textAlign = contentEl.style.textAlign || 'left';

    // Automatically adapt node size to user's text setup
    const updatePayload = {
      text: newText,
      fontSize: fontSize,
      fontFamily: fontFamily,
      textAlign: textAlign,
      images: this.rightEditorImages || [],
      customWidth: undefined,
      customHeight: undefined
    };

    // Single atomic update to node
    this.mindmap.updateNode(this.editingRightNodeId, updatePayload);

    if (autoFit) {
      showToast('📐 ' + (this.i18n ? this.i18n.t('toast.autofitNode') : 'Đã lưu & Tự động căn chỉnh kích thước (Auto-Fit)!'), 'success', 2000);
    } else {
      showToast('💾 ' + (this.i18n ? this.i18n.t('toast.savedNode') : 'Đã lưu thay đổi vào Node!'), 'success', 2000);
    }
    this.closeRightEditorPanel();
    this.renderMap();
  }

  autofitNode(nodeId) {
    const id = nodeId || this.mindmap.selectedNodeId;
    if (!id) return;
    const node = this.mindmap.findNode(id);
    if (!node) return;
    this.mindmap.updateNode(id, {
      customWidth: undefined,
      customHeight: undefined
    });
    this.renderMap();
    showToast('📐 ' + (this.i18n ? this.i18n.t('toast.autofitNode') : 'Đã tự động căn chỉnh kích thước node (Auto-Fit)!'), 'success', 2000);
  }

  setupRightEditorPanelListeners() {
    $('#btn-close-right-editor')?.addEventListener('click', () => this.closeRightEditorPanel());
    $('#btn-cancel-right-editor')?.addEventListener('click', () => this.closeRightEditorPanel());
    $('#btn-apply-right-editor')?.addEventListener('click', () => this.applyRightEditorToNode(false));
    $('#btn-autofit-right-editor')?.addEventListener('click', () => this.applyRightEditorToNode(true));

    // Local Undo / Redo in Context Box
    $('#right-fmt-undo')?.addEventListener('click', () => this.undoRightEditor());
    $('#right-fmt-redo')?.addEventListener('click', () => this.redoRightEditor());

    // Horizontal Drag Resize Handle for Context Box
    const resizeHandle = $('#right-editor-resize-handle');
    const drawer = $('#right-editor-panel');
    let isResizingDrawer = false;
    let startX = 0;
    let startWidth = 0;

    const onResizeStart = (clientX) => {
      isResizingDrawer = true;
      startX = clientX;
      startWidth = drawer ? drawer.offsetWidth : 580;
      drawer?.classList.add('resizing');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    };

    const onResizeMove = (clientX) => {
      if (!isResizingDrawer || !drawer) return;
      const dx = startX - clientX;
      const minW = 380;
      const maxW = Math.max(minW, window.innerWidth - 50);
      const newWidth = Math.min(maxW, Math.max(minW, startWidth + dx));
      drawer.style.width = `${newWidth}px`;
    };

    const onResizeEnd = () => {
      if (isResizingDrawer) {
        isResizingDrawer = false;
        drawer?.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (drawer) {
          try {
            localStorage.setItem('mindflow_context_box_width', String(drawer.offsetWidth));
          } catch (err) {}
        }
      }
    };

    resizeHandle?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onResizeStart(e.clientX);
    });

    document.addEventListener('mousemove', (e) => {
      if (isResizingDrawer) {
        onResizeMove(e.clientX);
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizingDrawer) {
        onResizeEnd();
      }
    });

    // Touch support for dragging resize handle on mobile / tablets
    resizeHandle?.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        onResizeStart(e.touches[0].clientX);
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (isResizingDrawer && e.touches && e.touches[0]) {
        onResizeMove(e.touches[0].clientX);
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (isResizingDrawer) {
        onResizeEnd();
      }
    });

    // Quick Width Toggle Button (Standard 580px vs Wide Mode)
    $('#btn-toggle-width-right-editor')?.addEventListener('click', () => {
      if (!drawer) return;
      const currentWidth = drawer.offsetWidth;
      const isWide = currentWidth >= 700;
      if (isWide) {
        drawer.style.width = '580px';
        try { localStorage.setItem('mindflow_context_box_width', '580'); } catch (err) {}
        showToast('↔ Thu gọn chiều ngang (580px)', 'info', 1500);
      } else {
        const wideW = Math.min(880, Math.round(window.innerWidth * 0.65));
        drawer.style.width = `${wideW}px`;
        try { localStorage.setItem('mindflow_context_box_width', String(wideW)); } catch (err) {}
        showToast('↔ Mở rộng chiều ngang (' + wideW + 'px)', 'info', 1500);
      }
    });

    // Intercept keyboard shortcuts in Context Box ONLY when panel is open
    $('#right-editor-panel')?.addEventListener('keydown', (e) => {
      const drawer = $('#right-editor-panel');
      if (!drawer || !drawer.classList.contains('open')) return;

      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          this.redoRightEditor();
        } else {
          this.undoRightEditor();
        }
      } else if (isCtrl && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        e.stopPropagation();
        this.redoRightEditor();
      } else if (isCtrl && (e.key === 'Enter' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          this.applyRightEditorToNode(true);
        } else {
          this.applyRightEditorToNode(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.closeRightEditorPanel();
      } else if ((isCtrl && e.shiftKey && (e.key === 'e' || e.key === 'E')) || (e.altKey && (e.key === 'w' || e.key === 'W'))) {
        e.preventDefault();
        e.stopPropagation();
        $('#btn-toggle-width-right-editor')?.click();
      }
    });

    const contentEl = $('#right-editor-content');
    const imageInput = $('#right-image-input');
    const imageBtn = $('#right-fmt-image-btn');
    const mathBtn = $('#right-fmt-math-btn');

    // Horizontal scroll support via mouse wheel (or Shift+Wheel)
    contentEl?.addEventListener('wheel', (e) => {
      if (contentEl.scrollWidth > contentEl.clientWidth) {
        if (e.shiftKey || Math.abs(e.deltaX) > 0) return; // browser native horizontal
        // When user scrolls wheel horizontally or if text has horizontal overflow:
        if (Math.abs(e.deltaY) > 0 && e.altKey) {
          contentEl.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }
    }, { passive: false });

    // Debounced local state recording on typing input
    const debouncedInputSave = debounce(() => {
      this.saveRightEditorLocalState();
    }, 400);

    contentEl?.addEventListener('input', () => {
      debouncedInputSave();
    });

    // Smart text editor integration (bullet lists, numbered lists, Tab indentation)
    if (contentEl) {
      attachSmartEditor(contentEl, {
        onSave: () => this.saveRightEditorLocalState()
      });
    }

    const notesEl = $('#node-notes');
    if (notesEl) {
      attachSmartEditor(notesEl);
    }

    imageBtn?.addEventListener('click', () => imageInput?.click());

    imageInput?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const b64 = await compressImageFile(file, 900);
          const img = document.createElement('img');
          img.src = b64;
          img.className = 'inline-editor-image';
          img.style.width = '160px';
          img.style.maxWidth = '100%';
          img.style.display = 'inline-block';
          img.style.verticalAlign = 'middle';
          img.style.margin = '4px 6px';
          img.contentEditable = 'false';
          contentEl.appendChild(img);
          this.saveRightEditorLocalState();
          showToast('📷 Đã chèn hình ảnh vào nội dung!', 'success', 2000);
        }
      }
      imageInput.value = '';
    });

    contentEl?.addEventListener('paste', async (e) => {
      const items = e.clipboardData ? e.clipboardData.items : [];
      let imagePasted = false;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          imagePasted = true;
          e.preventDefault();
          e.stopPropagation();
          const file = items[i].getAsFile();
          if (file) {
            this.saveRightEditorLocalState();
            const b64 = await compressImageFile(file, 900);
            const sel = window.getSelection();
            const img = document.createElement('img');
            img.src = b64;
            img.className = 'inline-editor-image';
            img.style.width = '160px';
            img.style.maxWidth = '100%';
            img.style.display = 'inline-block';
            img.style.verticalAlign = 'middle';
            img.style.margin = '4px 6px';
            img.contentEditable = 'false';

            if (sel && sel.rangeCount > 0 && contentEl.contains(sel.anchorNode)) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(img);
              range.setStartAfter(img);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              this.savedRightRange = range.cloneRange();
            } else {
              contentEl.appendChild(img);
            }
            this.saveRightEditorLocalState();
            showToast('📷 Đã chèn hình ảnh trực tiếp vào dòng chữ!', 'success', 2000);
          }
        }
      }
      if (imagePasted) {
        e.preventDefault();
      }
    });

    // Track selection in Right Editor content
    this.savedRightRange = null;
    const saveSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (contentEl.contains(range.commonAncestorContainer)) {
          this.savedRightRange = range.cloneRange();
        }
      }
    };

    contentEl?.addEventListener('mouseup', saveSelection);
    contentEl?.addEventListener('keyup', saveSelection);

    // Prevent toolbar buttons and swatches from taking focus and clearing selection (EXCLUDE select elements!)
    const panelEl = $('#right-editor-panel');
    panelEl?.querySelectorAll('.right-formatting-toolbar button, .right-formatting-toolbar .palette-swatch').forEach(el => {
      el.addEventListener('mousedown', (e) => e.preventDefault());
    });

    mathBtn?.addEventListener('click', () => {
      if (!this.editingRightNodeId) return;
      this.mathEditor.open(this.editingRightNodeId, (latexFormula) => {
        if (contentEl && latexFormula) {
          this.saveRightEditorLocalState();
          restoreSelection();
          const mathBlock = `\\[ ${latexFormula} \\]`;
          document.execCommand('insertText', false, mathBlock);
          this.saveRightEditorLocalState();
        }
      });
    });

    const restoreSelection = () => {
      contentEl?.focus();
      if (this.savedRightRange) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(this.savedRightRange);
        }
      }
    };

    const applyCmd = (cmd, val = null) => {
      this.saveRightEditorLocalState();
      restoreSelection();
      document.execCommand(cmd, false, val);
      this.saveRightEditorLocalState();
    };

    const applyStyleToSelection = (styleProp, styleVal) => {
      this.saveRightEditorLocalState();
      restoreSelection();
      const sel = window.getSelection();
      const targetVal = (styleVal === 'inherit' || styleVal === 'none' || styleVal === 'transparent' || !styleVal) ? '' : styleVal;

      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);

      if (range.collapsed) {
        // Collapsed cursor: handle color/highlight switching without corrupting contentEl
        let node = sel.anchorNode;
        let parentStyled = null;
        while (node && node !== contentEl) {
          if (node.nodeType === 1 && node.style) {
            if (styleProp === 'color' && (node.style.color || node.tagName === 'FONT')) {
              parentStyled = node;
              break;
            }
            if (styleProp === 'backgroundColor' && node.style.backgroundColor) {
              parentStyled = node;
              break;
            }
          }
          node = node.parentNode;
        }

        if (parentStyled) {
          if (!targetVal) {
            // User clicked Default: exit the styled span cleanly
            const afterR = document.createRange();
            afterR.setStartAfter(parentStyled);
            afterR.collapse(true);
            sel.removeAllRanges();
            sel.addRange(afterR);
            const emptyNode = document.createTextNode('');
            afterR.insertNode(emptyNode);
            afterR.setStartAfter(emptyNode);
            afterR.collapse(true);
            sel.removeAllRanges();
            sel.addRange(afterR);
            this.savedRightRange = afterR.cloneRange();
            this.saveRightEditorLocalState();
            return;
          } else {
            // User wants a new style: break out and start new span
            const afterR = document.createRange();
            afterR.setStartAfter(parentStyled);
            afterR.collapse(true);
            sel.removeAllRanges();
            sel.addRange(afterR);
            const span = document.createElement('span');
            if (styleProp === 'color') span.style.color = targetVal;
            if (styleProp === 'backgroundColor') span.style.backgroundColor = targetVal;
            span.innerHTML = '&#8203;';
            afterR.insertNode(span);
            const newR = document.createRange();
            newR.setStart(span.firstChild, 1);
            newR.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newR);
            this.savedRightRange = newR.cloneRange();
            this.saveRightEditorLocalState();
            return;
          }
        } else if (targetVal) {
          const span = document.createElement('span');
          if (styleProp === 'color') span.style.color = targetVal;
          if (styleProp === 'backgroundColor') span.style.backgroundColor = targetVal;
          span.innerHTML = '&#8203;';
          range.insertNode(span);
          const newR = document.createRange();
          newR.setStart(span.firstChild, 1);
          newR.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newR);
          this.savedRightRange = newR.cloneRange();
          this.saveRightEditorLocalState();
          return;
        }
        return;
      }

      // Has text selected!
      try {
        let parentStyled = null;
        let curr = range.commonAncestorContainer;
        while (curr && curr !== contentEl) {
          if (curr.nodeType === 1 && curr.style) {
            if (styleProp === 'color' && (curr.style.color || curr.tagName === 'FONT')) {
              parentStyled = curr;
              break;
            }
            if (styleProp === 'backgroundColor' && curr.style.backgroundColor) {
              parentStyled = curr;
              break;
            }
          }
          curr = curr.parentNode;
        }

        if (parentStyled) {
          const spanRange = document.createRange();
          spanRange.selectNodeContents(parentStyled);
          const isWhole = (range.compareBoundaryPoints(Range.START_TO_START, spanRange) <= 0 &&
                           range.compareBoundaryPoints(Range.END_TO_END, spanRange) >= 0);
          if (isWhole) {
            if (styleProp === 'color') {
              parentStyled.style.color = targetVal;
              if (targetVal.toLowerCase() === '#ffffff' || targetVal.toLowerCase() === 'white' || targetVal.toLowerCase() === '#fafafa' || targetVal.toLowerCase() === '#f8fafc') {
                parentStyled.style.textShadow = '0 1px 3px rgba(0,0,0,0.9), 0 0 2px #000';
              } else {
                parentStyled.style.textShadow = '';
              }
            } else if (styleProp === 'backgroundColor') {
              parentStyled.style.backgroundColor = targetVal;
            }
            if (!targetVal && (!parentStyled.getAttribute('style') || parentStyled.getAttribute('style').trim() === '')) {
              const p = parentStyled.parentNode;
              if (p) {
                while (parentStyled.firstChild) p.insertBefore(parentStyled.firstChild, parentStyled);
                p.removeChild(parentStyled);
              }
            }
            this.savedRightRange = spanRange.cloneRange();
            this.saveRightEditorLocalState();
            return;
          }
        }

        const fragment = range.extractContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        tempDiv.querySelectorAll('*').forEach(child => {
          if (styleProp === 'color') {
            child.style.color = '';
            child.style.textShadow = '';
            if (child.tagName === 'FONT') child.removeAttribute('color');
          } else if (styleProp === 'backgroundColor') {
            child.style.backgroundColor = '';
          } else if (styleProp === 'fontSize') {
            child.style.fontSize = '';
          } else if (styleProp === 'fontFamily') {
            child.style.fontFamily = '';
          }

          if (child.tagName === 'SPAN' && (!child.getAttribute('style') || child.getAttribute('style').trim() === '')) {
            const p = child.parentNode;
            if (p) {
              while (child.firstChild) p.insertBefore(child.firstChild, child);
              p.removeChild(child);
            }
          }
        });

        let toInsert;
        if (targetVal) {
          const span = document.createElement('span');
          if (styleProp === 'color') {
            span.style.color = targetVal;
            if (targetVal.toLowerCase() === '#ffffff' || targetVal.toLowerCase() === 'white' || targetVal.toLowerCase() === '#fafafa' || targetVal.toLowerCase() === '#f8fafc') {
              span.style.textShadow = '0 1px 3px rgba(0,0,0,0.9), 0 0 2px #000';
            }
          } else if (styleProp === 'backgroundColor') {
            span.style.backgroundColor = targetVal;
          } else if (styleProp === 'fontSize') {
            span.style.fontSize = `${targetVal}px`;
          } else if (styleProp === 'fontFamily') {
            span.style.fontFamily = targetVal;
          }
          while (tempDiv.firstChild) span.appendChild(tempDiv.firstChild);
          toInsert = span;
        } else {
          const frag = document.createDocumentFragment();
          while (tempDiv.firstChild) frag.appendChild(tempDiv.firstChild);
          toInsert = frag;
        }

        range.insertNode(toInsert);
        const newRange = document.createRange();
        newRange.selectNodeContents(toInsert);
        sel.removeAllRanges();
        sel.addRange(newRange);
        this.savedRightRange = newRange.cloneRange();
      } catch (err) {
        console.warn('applyStyleToSelection error:', err);
      }
      this.saveRightEditorLocalState();
    };

    // Save selection before dropdown opens for select elements (DO NOT call e.preventDefault() so select opens!)
    const saveRightSelectionOnMousedown = (el) => {
      if (!el) return;
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          this.savedRightRange = sel.getRangeAt(0).cloneRange();
        }
      });
    };

    saveRightSelectionOnMousedown($('#right-fmt-font-family'));
    saveRightSelectionOnMousedown($('#right-fmt-font-size'));

    // Prevent mousedown from clearing text selection focus for button tools only
    const formatButtons = [
      '#right-fmt-font-grow', '#right-fmt-font-shrink',
      '#right-fmt-bold', '#right-fmt-italic', '#right-fmt-underline', '#right-fmt-strike',
      '#right-fmt-bullet-list', '#right-fmt-numbered-list', '#right-fmt-indent', '#right-fmt-outdent',
      '#right-fmt-align-left', '#right-fmt-align-center', '#right-fmt-align-right',
      '#right-fmt-color-btn', '#right-fmt-highlight-btn'
    ];
    formatButtons.forEach(selector => {
      const el = $(selector);
      el?.addEventListener('mousedown', (e) => e.preventDefault());
    });

    $('#right-fmt-font-family')?.addEventListener('change', (e) => {
      applyStyleToSelection('fontFamily', e.target.value);
    });

    $('#right-fmt-font-size')?.addEventListener('change', (e) => {
      const px = parseInt(e.target.value || 14);
      applyStyleToSelection('fontSize', px);
    });

    const getCurrentSelectedFontSize = () => {
      restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node = sel.getRangeAt(0).startContainer;
        if (node.nodeType === 3) node = node.parentNode;
        const comp = window.getComputedStyle(node);
        if (comp && comp.fontSize) {
          return parseInt(comp.fontSize);
        }
      }
      const select = $('#right-fmt-font-size');
      return parseInt(select?.value || 14);
    };

    $('#right-fmt-font-grow')?.addEventListener('click', () => {
      const current = getCurrentSelectedFontSize();
      const next = Math.min(60, current + 2);
      const select = $('#right-fmt-font-size');
      if (select) select.value = String(next);
      applyStyleToSelection('fontSize', next);
    });

    $('#right-fmt-font-shrink')?.addEventListener('click', () => {
      const current = getCurrentSelectedFontSize();
      const next = Math.max(10, current - 2);
      const select = $('#right-fmt-font-size');
      if (select) select.value = String(next);
      applyStyleToSelection('fontSize', next);
    });

    $('#right-fmt-bold')?.addEventListener('click', () => applyCmd('bold'));
    $('#right-fmt-italic')?.addEventListener('click', () => applyCmd('italic'));
    $('#right-fmt-underline')?.addEventListener('click', () => applyCmd('underline'));
    $('#right-fmt-strike')?.addEventListener('click', () => applyCmd('strikeThrough'));

    $('#right-fmt-bullet-list')?.addEventListener('click', () => {
      this.saveRightEditorLocalState();
      toggleBulletList(contentEl);
      this.saveRightEditorLocalState();
    });

    $('#right-fmt-numbered-list')?.addEventListener('click', () => {
      this.saveRightEditorLocalState();
      toggleNumberedList(contentEl);
      this.saveRightEditorLocalState();
    });

    $('#right-fmt-indent')?.addEventListener('click', () => {
      this.saveRightEditorLocalState();
      indentSelection(contentEl);
      this.saveRightEditorLocalState();
    });

    $('#right-fmt-outdent')?.addEventListener('click', () => {
      this.saveRightEditorLocalState();
      outdentSelection(contentEl);
      this.saveRightEditorLocalState();
    });

    const setRightAlignment = (align) => {
      this.saveRightEditorLocalState();
      restoreSelection();
      contentEl.style.textAlign = align;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && contentEl.contains(sel.anchorNode)) {
        let node = sel.anchorNode;
        while (node && node !== contentEl && node.parentNode !== contentEl) {
          node = node.parentNode;
        }
        if (node && node !== contentEl) {
          if (node.nodeType === 1) {
            node.style.textAlign = align;
          } else {
            const div = document.createElement('div');
            div.style.textAlign = align;
            node.parentNode.insertBefore(div, node);
            div.appendChild(node);
          }
        }
      }
      this.saveRightEditorLocalState();
    };

    $('#right-fmt-align-left')?.addEventListener('click', () => setRightAlignment('left'));
    $('#right-fmt-align-center')?.addEventListener('click', () => setRightAlignment('center'));
    $('#right-fmt-align-right')?.addEventListener('click', () => setRightAlignment('right'));

    const colorBtn = $('#right-fmt-color-btn');
    const colorPal = $('#right-color-palette');
    const hlBtn = $('#right-fmt-highlight-btn');
    const hlPal = $('#right-highlight-palette');

    colorBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPal?.classList.toggle('hidden');
      hlPal?.classList.add('hidden');
    });

    hlBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      hlPal?.classList.toggle('hidden');
      colorPal?.classList.add('hidden');
    });

    colorPal?.querySelectorAll('.palette-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = swatch.dataset.color;
        applyStyleToSelection('color', color === 'inherit' ? '' : color);
        colorPal.classList.add('hidden');
      });
    });

    hlPal?.querySelectorAll('.palette-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const hl = swatch.dataset.highlight;
        applyStyleToSelection('backgroundColor', hl === 'none' ? 'transparent' : hl);
        hlPal.classList.add('hidden');
      });
    });
  }

  updateLangLabel() {
    const label = $('#lang-label');
    label.textContent = this.i18n.getLang().toUpperCase();
  }
}

// ==================== BOOT ====================
const initApp = () => {
  const app = new App();
  window.app = app;
  window.mindflowApp = app;
  app.init();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
