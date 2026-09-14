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
    const hasMathDelimiters = (str) => /^(\\+\[|\$\$|\$|\\+\(|\\begin)/.test(str.trim());

    $('#btn-insert-math')?.addEventListener('click', () => {
      let latexText = this.textarea ? this.textarea.value.trim() : '';
      if (latexText) {
        if (this.onInsertCallback) {
          this.onInsertCallback(latexText);
        } else if (this.activeNodeId) {
          if (!hasMathDelimiters(latexText)) {
            latexText = `\\[ ${latexText} \\]`;
          }
          this.app.mindmap.updateNode(this.activeNodeId, { text: latexText });
          this.app.renderMap();
        }
      }
      this.close();
    });

    $('#btn-append-math')?.addEventListener('click', () => {
      let latexText = this.textarea ? this.textarea.value.trim() : '';
      if (latexText) {
        if (this.onInsertCallback) {
          this.onInsertCallback(latexText);
        } else if (this.activeNodeId) {
          if (!hasMathDelimiters(latexText)) {
            latexText = `\\[ ${latexText} \\]`;
          }
          const node = this.app.mindmap.findNode(this.activeNodeId);
          const currentText = node ? (node.text || '') : '';
          const newText = currentText ? `${currentText}\n${latexText}` : latexText;
          this.app.mindmap.updateNode(this.activeNodeId, { text: newText });
          this.app.renderMap();
        }
      }
      this.close();
    });
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
    const val = this.textarea.value.trim();

    if (!val) {
      this.preview.innerHTML = '<span style="color: var(--color-text-muted); font-size: 13px;">(Công thức sẽ hiển thị tại đây)</span>';
      return;
    }

    if (window.katex) {
      try {
        let cleanVal = val;

        // Strip delimiters if user pasted \[ ... \], $$ ... $$, \( ... \), $ ... $
        cleanVal = cleanVal
          .replace(/^\\\[\s*/, '').replace(/\s*\\\]$/, '')
          .replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '')
          .replace(/^\\\(\s*/, '').replace(/\s*\\\)$/, '')
          .replace(/^\$\s*/, '').replace(/\s*\$$/, '');

        const html = window.katex.renderToString(cleanVal, { displayMode: true, throwOnError: false });
        this.preview.innerHTML = html;
      } catch (err) {
        this.preview.innerHTML = `<span style="color: #EF4444; font-size: 13px;">Lỗi cú pháp LaTeX: ${err.message}</span>`;
      }
    } else {
      this.preview.textContent = val;
    }
  }
}
