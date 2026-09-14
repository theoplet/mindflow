/**
 * MindFlow Smart Text Editor Engine
 * Handles bullet lists (*, -, •), numbered lists (1., 2.), fast Tab indentation, and markdown triggers.
 */

/**
 * Extract line information relative to the current cursor position in a container.
 * Accurately detects line boundaries in contenteditable whether using <div>, <p>, <br>, or text nodes.
 */
export function getCurrentLineInfo(container) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);

  if (!container.contains(range.commonAncestorContainer)) return null;

  // 1. Check if cursor is inside a top-level block child inside container (like <div> or <p>)
  let lineEl = range.startContainer;
  while (lineEl && lineEl.parentNode && lineEl.parentNode !== container) {
    lineEl = lineEl.parentNode;
  }

  let lineBeforeCursor = '';
  if (lineEl && lineEl !== container && lineEl.nodeType === 1) {
    const lineRange = document.createRange();
    lineRange.setStart(lineEl, 0);
    lineRange.setEnd(range.startContainer, range.startOffset);
    lineBeforeCursor = lineRange.toString();
  } else {
    // 2. Flat container with <br> or text nodes: clone contents up to cursor and check innerText
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    try {
      preRange.setEnd(range.startContainer, range.startOffset);
    } catch (err) {
      return null;
    }
    const clone = preRange.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(clone);
    const textBefore = tempDiv.innerText !== undefined ? tempDiv.innerText : preRange.toString();
    const lastNl = Math.max(textBefore.lastIndexOf('\n'), textBefore.lastIndexOf('\r'));
    lineBeforeCursor = lastNl >= 0 ? textBefore.substring(lastNl + 1) : textBefore;
  }

  return {
    range,
    lineEl,
    lineBeforeCursor
  };
}

/**
 * Handle Enter key: continues bullet or numbered list, or exits list if line is empty marker
 */
export function handleSmartEnter(container, e) {
  const info = getCurrentLineInfo(container);
  if (!info) return false;

  const line = info.lineBeforeCursor;
  const lineEl = info.lineEl;
  const sel = window.getSelection();

  // 1. Bullet list: matches e.g. "   • text", "  * text", " - text"
  const bulletMatch = line.match(/^(\s*)([•\*\-])\s*(.*)$/);
  if (bulletMatch) {
    const indent = bulletMatch[1] || '';
    const content = bulletMatch[3];

    if (content.trim().length === 0) {
      // Empty bullet item: user wants to exit bullet list
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (lineEl && lineEl !== container && lineEl.nodeType === 1) {
        lineEl.innerHTML = '<br>';
        const newR = document.createRange();
        newR.setStart(lineEl, 0);
        newR.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newR);
      } else {
        const toDelete = line.length;
        for (let i = 0; i < toDelete; i++) sel.modify('extend', 'backward', 'character');
        document.execCommand('delete', false, null);
      }
      return true;
    } else {
      // Continue bullet list on next line
      if (e) { e.preventDefault(); e.stopPropagation(); }
      document.execCommand('insertText', false, '\n' + indent + '• ');
      return true;
    }
  }

  // 2. Numbered list: matches e.g. "   1. text" or " 1) text"
  const numMatch = line.match(/^(\s*)(\d+)([\.\)])\s*(.*)$/);
  if (numMatch) {
    const indent = numMatch[1] || '';
    const num = parseInt(numMatch[2], 10);
    const delim = numMatch[3];
    const content = numMatch[4];

    if (content.trim().length === 0) {
      // Empty number item: user wants to exit numbered list
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (lineEl && lineEl !== container && lineEl.nodeType === 1) {
        lineEl.innerHTML = '<br>';
        const newR = document.createRange();
        newR.setStart(lineEl, 0);
        newR.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newR);
      } else {
        const toDelete = line.length;
        for (let i = 0; i < toDelete; i++) sel.modify('extend', 'backward', 'character');
        document.execCommand('delete', false, null);
      }
      return true;
    } else {
      // Continue numbered list
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const nextNum = num + 1;
      document.execCommand('insertText', false, '\n' + indent + nextNum + delim + ' ');
      return true;
    }
  }

  return false;
}

/**
 * Handle Tab & Shift+Tab for quick spacing and indent / outdent
 */
export function handleSmartTab(container, e) {
  e.preventDefault();
  e.stopPropagation();

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const isShift = e.shiftKey;

  if (range.collapsed) {
    if (!isShift) {
      // Fast spacing: insert 4 spaces
      document.execCommand('insertText', false, '    ');
    } else {
      // Shift+Tab: outdent current line
      const info = getCurrentLineInfo(container);
      if (info) {
        const line = info.lineBeforeCursor;
        const leading = line.match(/^ {1,4}|\t/);
        if (leading && leading[0].length > 0) {
          for (let i = 0; i < leading[0].length; i++) sel.modify('extend', 'backward', 'character');
          document.execCommand('delete', false, null);
        }
      }
    }
  } else {
    // Multi-line selection indent / outdent
    const selectedText = sel.toString();
    const lines = selectedText.split('\n');

    let modifiedText;
    if (!isShift) {
      modifiedText = lines.map(line => '    ' + line).join('\n');
    } else {
      modifiedText = lines.map(line => line.replace(/^( {1,4}|\t)/, '')).join('\n');
    }
    document.execCommand('insertText', false, modifiedText);
  }
}

/**
 * Handle Space key: auto-converts typed "* " or "- " at line start into "• "
 */
export function handleSmartSpace(container, e) {
  const info = getCurrentLineInfo(container);
  if (!info) return false;

  const match = info.lineBeforeCursor.match(/^(\s*)([\*\-])$/);
  if (match) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const sel = window.getSelection();
    sel.modify('extend', 'backward', 'character');
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, '• ');
    return true;
  }
  return false;
}

/**
 * Handle Backspace at the start of a list item
 */
export function handleSmartBackspace(container, e) {
  const info = getCurrentLineInfo(container);
  if (!info) return false;

  const line = info.lineBeforeCursor;
  // If line is exactly a list marker followed by cursor (e.g. "• ", "* ", "1. ")
  const markerOnlyMatch = line.match(/^(\s*)([•\*\-]|\d+[\.\)])\s$/);
  if (markerOnlyMatch) {
    e.preventDefault();
    e.stopPropagation();
    const toDelete = line.length;
    const sel = window.getSelection();
    for (let i = 0; i < toDelete; i++) {
      sel.modify('extend', 'backward', 'character');
    }
    document.execCommand('delete', false, null);
    return true;
  }
  return false;
}

/**
 * Toggle bullet list for selected text or current line
 */
export function toggleBulletList(container) {
  container.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  if (range.collapsed) {
    const info = getCurrentLineInfo(container);
    if (!info) {
      document.execCommand('insertText', false, '• ');
      return;
    }

    const line = info.lineBeforeCursor;
    const bulletMatch = line.match(/^(\s*)([•\*\-])\s*(.*)$/);
    if (bulletMatch) {
      // Toggle OFF: remove bullet
      const toDelete = line.length;
      for (let i = 0; i < toDelete; i++) sel.modify('extend', 'backward', 'character');
      document.execCommand('delete', false, null);
      if (bulletMatch[3]) document.execCommand('insertText', false, bulletMatch[1] + bulletMatch[3]);
    } else {
      // Toggle ON: insert bullet at cursor
      document.execCommand('insertText', false, '• ');
    }
  } else {
    const selectedText = sel.toString();
    const lines = selectedText.split('\n');
    const allHaveBullet = lines.every(l => /^\s*[•\*\-]\s/.test(l));

    let newText;
    if (allHaveBullet) {
      newText = lines.map(l => l.replace(/^(\s*)[•\*\-]\s+/, '$1')).join('\n');
    } else {
      newText = lines.map(l => {
        const m = l.match(/^(\s*)(.*)$/);
        return (m ? m[1] : '') + '• ' + (m ? m[2] : l);
      }).join('\n');
    }
    document.execCommand('insertText', false, newText);
  }
}

/**
 * Toggle numbered list for selected text or current line
 */
export function toggleNumberedList(container) {
  container.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  if (range.collapsed) {
    const info = getCurrentLineInfo(container);
    if (!info) {
      document.execCommand('insertText', false, '1. ');
      return;
    }

    const line = info.lineBeforeCursor;
    const numMatch = line.match(/^(\s*)(\d+[\.\)])\s*(.*)$/);
    if (numMatch) {
      // Toggle OFF: remove number
      const toDelete = line.length;
      for (let i = 0; i < toDelete; i++) sel.modify('extend', 'backward', 'character');
      document.execCommand('delete', false, null);
      if (numMatch[3]) document.execCommand('insertText', false, numMatch[1] + numMatch[3]);
    } else {
      // Toggle ON: insert "1. " at cursor
      document.execCommand('insertText', false, '1. ');
    }
  } else {
    const selectedText = sel.toString();
    const lines = selectedText.split('\n');
    const allHaveNum = lines.every(l => /^\s*\d+[\.\)]\s/.test(l));

    let newText;
    if (allHaveNum) {
      newText = lines.map(l => l.replace(/^(\s*)\d+[\.\)]\s+/, '$1')).join('\n');
    } else {
      let count = 1;
      newText = lines.map(l => {
        const m = l.match(/^(\s*)(.*)$/);
        const indent = m ? m[1] : '';
        const body = m ? m[2] : l;
        return `${indent}${count++}. ${body}`;
      }).join('\n');
    }
    document.execCommand('insertText', false, newText);
  }
}

/**
 * Indent current line or selection by 4 spaces
 */
export function indentSelection(container) {
  container.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  if (range.collapsed) {
    document.execCommand('insertText', false, '    ');
  } else {
    const selectedText = sel.toString();
    const lines = selectedText.split('\n');
    const indented = lines.map(line => '    ' + line).join('\n');
    document.execCommand('insertText', false, indented);
  }
}

/**
 * Outdent current line or selection by up to 4 spaces
 */
export function outdentSelection(container) {
  container.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  if (range.collapsed) {
    const info = getCurrentLineInfo(container);
    if (info) {
      const line = info.lineBeforeCursor;
      const leading = line.match(/^ {1,4}|\t/);
      if (leading && leading[0].length > 0) {
        for (let i = 0; i < leading[0].length; i++) sel.modify('extend', 'backward', 'character');
        document.execCommand('delete', false, null);
      }
    }
  } else {
    const selectedText = sel.toString();
    const lines = selectedText.split('\n');
    const outdented = lines.map(line => line.replace(/^( {1,4}|\t)/, '')).join('\n');
    document.execCommand('insertText', false, outdented);
  }
}

/**
 * Attach smart text editing listeners to any contenteditable or textarea element
 */
export function attachSmartEditor(element, options = {}) {
  if (!element) return;

  const isTextarea = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';

  if (isTextarea) {
    // Textarea handling for Tab and Shift+Tab indentation
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = element.selectionStart;
        const end = element.selectionEnd;
        const val = element.value;

        if (start === end) {
          if (!e.shiftKey) {
            element.value = val.substring(0, start) + '    ' + val.substring(end);
            element.selectionStart = element.selectionEnd = start + 4;
          }
        } else {
          const sel = val.substring(start, end);
          const lines = sel.split('\n');
          let modified;
          if (!e.shiftKey) {
            modified = lines.map(l => '    ' + l).join('\n');
            element.value = val.substring(0, start) + modified + val.substring(end);
            element.selectionStart = start;
            element.selectionEnd = start + modified.length;
          } else {
            modified = lines.map(l => l.replace(/^( {1,4}|\t)/, '')).join('\n');
            element.value = val.substring(0, start) + modified + val.substring(end);
            element.selectionStart = start;
            element.selectionEnd = start + modified.length;
          }
        }
        if (options.onSave) options.onSave();
      }
    });
    return;
  }

  // Contenteditable element handling
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      handleSmartTab(element, e);
      if (options.onSave) options.onSave();
    } else if (e.key === ' ') {
      const handled = handleSmartSpace(element, e);
      if (handled && options.onSave) options.onSave();
    } else if (e.key === 'Enter') {
      if (!options.allowEnter || options.allowEnter(e)) {
        const handled = handleSmartEnter(element, e);
        if (handled && options.onSave) options.onSave();
      }
    } else if (e.key === 'Backspace') {
      const handled = handleSmartBackspace(element, e);
      if (handled && options.onSave) options.onSave();
    }
  });

  // Fallback on input for mobile or virtual keyboards
  element.addEventListener('input', (e) => {
    handleSmartInput(element, options);
  });
}

/**
 * Fallback input handler for virtual/mobile keyboards
 */
export function handleSmartInput(element, options = {}) {
  const info = getCurrentLineInfo(element);
  if (!info) return;
  const match = info.lineBeforeCursor.match(/^(\s*)([\*\-])\s$/);
  if (match) {
    const sel = window.getSelection();
    sel.modify('extend', 'backward', 'character');
    sel.modify('extend', 'backward', 'character');
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, '• ');
    if (options.onSave) options.onSave();
  }
}

