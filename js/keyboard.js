export class Keyboard {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this.isEditing = false;
    
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.spacePressCallback = null;
  }

  /**
   * Initialize keyboard event listener
   */
  init() {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  handleKeyDown(e) {
    if (!this.enabled) return;

    const isFormInput = e.target && (
      (e.target.tagName === 'INPUT' && e.target.type !== 'range') ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'SELECT' ||
      e.target.isContentEditable ||
      (e.target.closest('#right-editor-panel') && document.getElementById('right-editor-panel')?.classList.contains('open')) ||
      e.target.closest('.modal-content') ||
      e.target.closest('#properties-panel')
    );

    if (isFormInput) {
      if (e.key === 'Escape') {
        const handler = this.shortcuts.get('escape');
        if (handler) handler(e);
      }
      return;
    }

    if (e.key.toLowerCase() === ' ') {
      if (!this.isEditing && this.spacePressCallback) {
        this.spacePressCallback(true);
      }
    }

    const combo = this._getComboString(e);

    // In editing mode, only allow certain keys
    if (this.isEditing) {
      const allowedEdits = ['escape', 'enter', 'tab'];
      if (!allowedEdits.includes(combo)) return;
    }

    const handler = this.shortcuts.get(combo);
    if (handler) {
      e.preventDefault();
      handler(e);
    }
  }

  handleKeyUp(e) {
    if (e.key.toLowerCase() === ' ') {
      if (this.spacePressCallback) {
        this.spacePressCallback(false);
      }
    }
  }

  _getComboString(e) {
    let keys = [];
    if (e.ctrlKey || e.metaKey) keys.push('ctrl');
    if (e.shiftKey) keys.push('shift');
    if (e.altKey) keys.push('alt');
    
    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    
    if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
      keys.push(key);
    }
    
    return keys.join('+');
  }

  /**
   * Register a keyboard shortcut
   */
  register(combo, handler, description = '') {
    this.shortcuts.set(combo.toLowerCase(), handler);
    handler.description = description;
  }

  /**
   * Register all default mindmap shortcuts
   */
  registerDefaults(callbacks) {
    if (callbacks.addChild) this.register('tab', callbacks.addChild, 'Add child node');
    // Enter key shortcut removed as requested - users can add branch via right-click menu or Tab
    if (callbacks.deleteNode) {
      this.register('delete', callbacks.deleteNode, 'Delete selected node');
      this.register('backspace', callbacks.deleteNode, 'Delete selected node');
    }
    if (callbacks.editNode) {
      this.register('space', callbacks.editNode, 'Edit node text');
      this.register('f2', callbacks.editNode, 'Edit node text');
    }
    if (callbacks.cancelEdit) this.register('escape', callbacks.cancelEdit, 'Cancel / Deselect');
    if (callbacks.undo) this.register('ctrl+z', callbacks.undo, 'Undo');
    if (callbacks.redo) {
      this.register('ctrl+y', callbacks.redo, 'Redo');
      this.register('ctrl+shift+z', callbacks.redo, 'Redo');
    }
    if (callbacks.save) this.register('ctrl+s', callbacks.save, 'Save map');
    if (callbacks.openMap) this.register('ctrl+o', callbacks.openMap, 'Open map');
    if (callbacks.exportDialog) this.register('ctrl+e', callbacks.exportDialog, 'Export map');
    if (callbacks.toggleCollapse) this.register('/', callbacks.toggleCollapse, 'Collapse/Expand branch');
    if (callbacks.navigateUp) this.register('arrowup', callbacks.navigateUp, 'Navigate up');
    if (callbacks.navigateDown) this.register('arrowdown', callbacks.navigateDown, 'Navigate down');
    if (callbacks.navigateLeft) this.register('arrowleft', callbacks.navigateLeft, 'Navigate left / Go to parent');
    if (callbacks.navigateRight) this.register('arrowright', callbacks.navigateRight, 'Navigate right / Go to child');
    if (callbacks.zoomIn) this.register('ctrl+=', callbacks.zoomIn, 'Zoom in');
    if (callbacks.zoomOut) this.register('ctrl+-', callbacks.zoomOut, 'Zoom out');
    if (callbacks.fitToView) this.register('ctrl+0', callbacks.fitToView, 'Fit to view');
    if (callbacks.selectAll) this.register('ctrl+a', callbacks.selectAll, 'Select all nodes');
    if (callbacks.copyNode) this.register('ctrl+c', callbacks.copyNode, 'Copy node branch');
    if (callbacks.pasteNode) this.register('ctrl+v', callbacks.pasteNode, 'Paste node branch');
    if (callbacks.showShortcuts) this.register('?', callbacks.showShortcuts, 'Show keyboard shortcuts');
    
    if (callbacks.setSpacePressed) {
      this.spacePressCallback = callbacks.setSpacePressed;
    }
  }

  /**
   * Set editing mode
   */
  setEditing(editing) {
    this.isEditing = editing;
  }

  /**
   * Get all registered shortcuts with descriptions
   */
  getShortcutList() {
    const list = [];
    for (const [combo, handler] of this.shortcuts.entries()) {
      if (handler.description) {
        list.push({ combo, description: handler.description });
      }
    }
    return list;
  }

  /**
   * Enable/disable all shortcuts
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }
}
