/**
 * Utility functions for MindFlow
 */

/**
 * Generates a UUID v4 string
 * @returns {string} UUID string
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Debounce function
 * @param {Function} fn 
 * @param {number} delay 
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function
 * @param {Function} fn 
 * @param {number} limit 
 * @returns {Function}
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Clamp a number between min and max
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deep clone an object
 * @param {Object} obj 
 * @returns {Object}
 */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Document querySelector shorthand
 * @param {string} selector 
 * @returns {Element|null}
 */
export function $(selector) {
  return document.querySelector(selector);
}

/**
 * Document querySelectorAll shorthand
 * @param {string} selector 
 * @returns {NodeList}
 */
export function $$(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Create a DOM element with attributes and children
 * @param {string} tag 
 * @param {Object} attrs 
 * @param {Array<Element|string>} children 
 * @returns {Element}
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      for (const [dataKey, dataVal] of Object.entries(value)) {
        el.dataset[dataKey] = dataVal;
      }
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }
  return el;
}

/**
 * Show a toast notification
 * @param {string} message 
 * @param {string} type 'success', 'error', 'info'
 * @param {number} duration 
 */
export function showToast(message, type = 'info', duration = 3000) {
  let container = $('#toast-container');
  if (!container) {
    container = createElement('div', { id: 'toast-container', className: 'toast-container' });
    document.body.appendChild(container);
  }

  const toast = createElement('div', { className: `toast toast-${type}` }, [message]);
  container.appendChild(toast);
  
  // Trigger reflow for animation
  void toast.offsetWidth;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    let removed = false;
    const removeToast = () => {
      if (removed) return;
      removed = true;
      toast.remove();
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    };
    toast.addEventListener('transitionend', removeToast, { once: true });
    // Safety fallback if transitionend does not fire (e.g. background tab / reduced motion)
    setTimeout(removeToast, 400);
  }, duration);
}

/**
 * Convert hex color to HSL
 * @param {string} hex 
 * @returns {Object} {h, s, l}
 */
export function hexToHSL(hex) {
  if (!hex || typeof hex !== 'string') return { h: 0, s: 0, l: 0 };
  hex = hex.replace(/^#/, '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return { h: 0, s: 0, l: 0 };

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  if (isNaN(r) || isNaN(g) || isNaN(b)) return { h: 0, s: 0, l: 0 };

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Adjust brightness of a hex color
 * @param {string} hex 
 * @param {number} percent 
 * @returns {string} adjusted hex color
 */
export function adjustBrightness(hex, percent) {
  if (!hex || typeof hex !== 'string') return '#6C5CE7';
  hex = hex.replace(/^#/, '').trim();
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return '#' + hex;
  
  const num = parseInt(hex, 16);
  if (isNaN(num)) return '#6C5CE7';
  const amt = Math.round(2.55 * percent);
  let r = (num >> 16) + amt;
  let g = (num >> 8 & 0x00FF) + amt;
  let b = (num & 0x0000FF) + amt;

  r = clamp(r, 0, 255);
  g = clamp(g, 0, 255);
  b = clamp(b, 0, 255);

  return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Read and compress an image file or blob into an optimized Data URL
 * Prevents massive uncompressed Data URLs from bloating the mindmap DOM and JSON
 * @param {File|Blob} file 
 * @param {number} maxDim 
 * @param {number} quality 
 * @returns {Promise<string>}
 */
export function compressImageFile(file, maxDim = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        let w = img.width || 100;
        let h = img.height || 100;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const webp = canvas.toDataURL('image/webp', quality);
          if (webp && webp.startsWith('data:image/webp')) {
            return resolve(webp);
          }
        } catch (err) {}
        try {
          return resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          return resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Creates a cubic-bezier easing function matching CSS cubic-bezier(x1, y1, x2, y2)
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {(t: number) => number}
 */
export function createBezierEasing(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(t) { return ((ax * t + bx) * t + cx) * t; }
  function sampleCurveY(t) { return ((ay * t + by) * t + cy) * t; }
  function sampleCurveDerivativeX(t) { return (3 * ax * t + 2 * bx) * t + cx; }

  function solveCurveX(x) {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xEst = sampleCurveX(t) - x;
      if (Math.abs(xEst) < 1e-5) return t;
      const d = sampleCurveDerivativeX(t);
      if (Math.abs(d) < 1e-5) break;
      t = t - xEst / d;
    }
    let t0 = 0, t1 = 1;
    t = x;
    for (let j = 0; j < 10; j++) {
      const xEst = sampleCurveX(t);
      if (Math.abs(xEst - x) < 1e-5) return t;
      if (x > xEst) t0 = t;
      else t1 = t;
      t = (t1 + t0) * 0.5;
    }
    return t;
  }

  return function(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleCurveY(solveCurveX(t));
  };
}

