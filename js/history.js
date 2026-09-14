import { deepClone } from './utils.js';

export class History {
  constructor(maxStates = 100) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxStates = maxStates;
    this.isPerforming = false;
    this.lastStateJson = null;
    this.listeners = new Map([['change', new Set()]]);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (err) {
          console.error('History listener error:', err);
        }
      }
    }
  }

  /**
   * Set initial baseline state on map load or map creation
   */
  init(initialState) {
    this.undoStack = [];
    this.redoStack = [];
    this.lastStateJson = initialState ? JSON.stringify(initialState) : null;
    this.emitChange();
  }

  /**
   * Record a new state mutation
   */
  push(state) {
    if (this.isPerforming || !state) return;

    const stateJson = typeof state === 'string' ? state : JSON.stringify(state);

    // Prevent duplicate consecutive states
    if (this.lastStateJson === stateJson) {
      return;
    }

    // Push previous baseline state onto undo stack
    if (this.lastStateJson !== null) {
      this.undoStack.push(this.lastStateJson);
      if (this.undoStack.length > this.maxStates) {
        this.undoStack.shift();
      }
    }

    this.lastStateJson = stateJson;
    this.redoStack = [];
    this.emitChange();
  }

  /**
   * Undo to previous state
   */
  undo(currentState) {
    if (!this.canUndo()) return null;

    this.isPerforming = true;
    try {
      const currentJson = currentState
        ? (typeof currentState === 'string' ? currentState : JSON.stringify(currentState))
        : this.lastStateJson;

      const previousStateJson = this.undoStack.pop();
      if (!previousStateJson) return null;

      if (currentJson) {
        this.redoStack.push(currentJson);
      }

      this.lastStateJson = previousStateJson;
      this.emitChange();

      return typeof previousStateJson === 'string' ? JSON.parse(previousStateJson) : previousStateJson;
    } finally {
      this.isPerforming = false;
    }
  }

  /**
   * Redo to next undone state
   */
  redo(currentState) {
    if (!this.canRedo()) return null;

    this.isPerforming = true;
    try {
      const currentJson = currentState
        ? (typeof currentState === 'string' ? currentState : JSON.stringify(currentState))
        : this.lastStateJson;

      const nextStateJson = this.redoStack.pop();
      if (!nextStateJson) return null;

      if (currentJson) {
        this.undoStack.push(currentJson);
      }

      this.lastStateJson = nextStateJson;
      this.emitChange();

      return typeof nextStateJson === 'string' ? JSON.parse(nextStateJson) : nextStateJson;
    } finally {
      this.isPerforming = false;
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.lastStateJson = null;
    this.emitChange();
  }

  emitChange() {
    this.emit('change', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length
    });
  }
}
