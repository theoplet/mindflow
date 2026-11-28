import { $ } from './utils.js';

export class MathEditor {
  constructor(app) {
    this.app = app;
    this.modal = $('#math-modal');
    this.textarea = $('#math-input-latex');
    this.preview = $('#math-live-preview');
    this.activeNodeId = null;
  }

  init() {
    this.setupTabListeners();
    this.setupSymbolListeners();
    this.setupInputListeners();
    this.setupActionListeners();
  }

  open(nodeId = null, callback = null) {
    if (!this.modal) return;
    this.activeNodeId = nodeId || (this.app.mindmap.getSelectedNode() ? this.app.mindmap.getSelectedNode().id : null);
    this.onInsertCallback = callback;
    
    let initialText = '';
    if (this.activeNodeId && !callback) {
      const node = this.app.mindmap.findNode(this.activeNodeId);
      if (node) initialText = node.text || '';
    }

    if (this.textarea) {
      this.textarea.value = initialText;
    }

    this.updatePreview();
    this.modal.classList.add('open');
    setTimeout(() => this.textarea?.focus(), 100);
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('open');
    this.activeNodeId = null;
    this.onInsertCallback = null;
  }

  setupTabListeners() {
    const tabs = document.querySelectorAll('.math-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const targetTab = tab.dataset.tab;
        const grids = document.querySelectorAll('.math-symbol-grid');
        grids.forEach(grid => {
          grid.style.display = (grid.id === `math-grid-${targetTab}`) ? 'grid' : 'none';
        });
      });
    });
  }

  setupSymbolListeners() {
    document.querySelectorAll('.math-sym-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const latex = btn.dataset.latex;
        if (latex && this.textarea) {
          this.insertAtCursor(this.textarea, latex);
          this.updatePreview();
        }
      });
    });
  }

  setupInputListeners() {
    this.textarea?.addEventListener('input', () => this.updatePreview());
  }

  setupActionListeners() {
    $('#btn-close-math-modal')?.addEventListener('click', () => this.close());
    const insert = (append) => {
      const latex = this.getFormula();
      if (!latex || !this.isValid) return;
      const value = latex.delimited ? latex.raw : '\\[' + latex.source + '\\]';
      if (this.onInsertCallback) {
        this.onInsertCallback(value);
      } else if (this.activeNodeId) {
        const node = this.app.mindmap.findNode(this.activeNodeId);
        this.app.mindmap.updateNode(this.activeNodeId, {
          text: append && node?.text ? node.text + '\n' + value : value
        });
        this.app.renderMap();
      }
      this.close();
    };
    $('#btn-insert-math')?.addEventListener('click', () => insert(false));
    $('#btn-append-math')?.addEventListener('click', () => insert(true));
  }

  getFormula() {
    const raw = this.textarea?.value.trim();
    if (!raw) return null;
    for (const [open, close, display] of [['\\[', '\\]', true], ['$$', '$$', true], ['\\(', '\\)', false], ['$', '$', false]]) {
      if (raw.startsWith(open) && raw.endsWith(close) && raw.length > open.length + close.length) {
        return { raw, source: raw.slice(open.length, -close.length).trim(), delimited: true, display };
      }
    }
    return { raw, source: raw, delimited: false, display: true };
  }

  insertAtCursor(field, value) {
    if (field.selectionStart || field.selectionStart === 0) {
      const startPos = field.selectionStart;
      const endPos = field.selectionEnd;
      field.value = field.value.substring(0, startPos) + value + field.value.substring(endPos, field.value.length);
      field.selectionStart = startPos + value.length;
      field.selectionEnd = startPos + value.length;
    } else {
      field.value += value;
    }
    field.focus();
  }

  updatePreview() {
    if (!this.preview || !this.textarea) return;
    const formula = this.getFormula();
    this.isValid = false;
    if (!formula) {
      this.preview.textContent = '(Công thức sẽ hiển thị tại đây)';
    } else if (window.katex) {
      try {
        window.katex.render(formula.source, this.preview, { displayMode: formula.display, throwOnError: true, maxExpand: 1000 });
        this.isValid = true;
      } catch (error) {
        this.preview.textContent = 'Lỗi cú pháp LaTeX: ' + error.message;
      }
    } else {
      this.preview.textContent = 'Chưa tải được KaTeX. Hãy tải lại trang.';
    }
    for (const id of ['#btn-insert-math', '#btn-append-math']) {
      const button = $(id);
      if (button) button.disabled = !this.isValid;
    }
  }
}
