export class Canvas {
  /**
   * @param {HTMLElement} containerElement - The #mindmap-canvas
   * @param {HTMLElement} transformElement - The #canvas-transform
   */
  constructor(containerElement, transformElement) {
    this.container = containerElement;
    this.transform = transformElement;
    this.scale = 1;
    const initialW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const initialH = typeof window !== 'undefined' ? window.innerHeight : 800;
    this.translateX = initialW / 2;
    this.translateY = initialH / 2;
    this.minScale = 0.1;
    this.maxScale = 3;
    
    this.isPanning = false;
    this.lastPanX = 0;
    this.lastPanY = 0;
    this.spacePressed = false;
    
    this.listeners = { change: [] };

    this.handleWheel = this.handleWheel.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  /**
   * Initialize event listeners
   */
  init() {
    this.centerOnPoint(0, 0, false);
    this.container.addEventListener('wheel', this.handleWheel, { passive: false });
    this.container.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    
    // Prevent context menu on right click if needed, or handle middle click
    this.container.addEventListener('contextmenu', (e) => {
      if (this.isPanning) e.preventDefault();
    });

    this.initTouch();
  }

  initTouch() {
    let pinch = null;
    let multiTouch = false;
    const midpoint = touches => {
      const a = touches[0], b = touches[1];
      return {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      };
    };
    const consume = e => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    };
    const startPinch = e => {
      multiTouch = true;
      this.isPanning = false;
      this.onPinchStart?.();
      pinch = null;
      if (e.touches.length !== 2) return;
      const center = midpoint(e.touches);
      if (center.distance < 1) return;
      pinch = {
        distance: center.distance,
        scale: this.scale,
        anchor: this.screenToCanvas(center.x, center.y)
      };
    };
    this.touchEvents = {
      touchstart: e => {
        if (e.touches.length >= 2) {
          consume(e);
          startPinch(e);
        } else if (!multiTouch && !e.target.closest('.mindmap-node')) {
          this.isPanning = true;
          this.lastPanX = e.touches[0].clientX;
          this.lastPanY = e.touches[0].clientY;
        }
      },
      touchmove: e => {
        if (multiTouch || e.touches.length >= 2) {
          consume(e);
          if (e.touches.length !== 2) return;
          if (!pinch) startPinch(e);
          if (!pinch) return;
          const center = midpoint(e.touches);
          const rect = this.container.getBoundingClientRect();
          this.scale = Math.max(this.minScale, Math.min(this.maxScale, pinch.scale * center.distance / pinch.distance));
          this.translateX = center.x - rect.left - pinch.anchor.x * this.scale;
          this.translateY = center.y - rect.top - pinch.anchor.y * this.scale;
          this.applyTransform();
        } else if (e.touches.length === 1 && this.isPanning) {
          if (e.cancelable) e.preventDefault();
          const touch = e.touches[0];
          this.translateX += touch.clientX - this.lastPanX;
          this.translateY += touch.clientY - this.lastPanY;
          this.lastPanX = touch.clientX;
          this.lastPanY = touch.clientY;
          this.applyTransform();
        }
      },
      touchend: e => {
        if (!multiTouch) {
          this.isPanning = false;
          return;
        }
        consume(e);
        pinch = null;
        if (!e.touches.length) multiTouch = false;
      },
      touchcancel: e => {
        if (multiTouch) consume(e);
        else this.onPinchStart?.();
        this.isPanning = false;
        multiTouch = false;
        pinch = null;
      }
    };
    for (const [type, handler] of Object.entries(this.touchEvents)) {
      this.container.addEventListener(type, handler, { capture: true, passive: false });
    }
  }

  handleWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = this.scale * zoomFactor;
      this.zoomAtPoint(newScale, e.clientX, e.clientY);
    } else {
      // Pan on wheel
      this.translateX -= e.deltaX;
      this.translateY -= e.deltaY;
      this.applyTransform();
    }
  }

  handleMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
      e.preventDefault();
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.container.style.cursor = 'grabbing';
    }
  }

  handleMouseMove(e) {
    if (!this.isPanning) return;
    const dx = e.clientX - this.lastPanX;
    const dy = e.clientY - this.lastPanY;
    
    this.translateX += dx;
    this.translateY += dy;
    this.lastPanX = e.clientX;
    this.lastPanY = e.clientY;
    
    this.applyTransform();
  }

  handleMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.container.style.cursor = this.spacePressed ? 'grab' : '';
    }
  }

  /**
   * Apply current transform to the transform element
   */
  applyTransform(animate = false) {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      if (animate) {
        this.transform.style.transition = 'transform 0.2s ease-out';
        setTimeout(() => {
          this.transform.style.transition = '';
        }, 200);
      }
      
      this.transform.style.transform = `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.scale})`;
      this.emit('change', { scale: this.scale, translateX: this.translateX, translateY: this.translateY });
    });
  }

  /**
   * Zoom to a specific point
   */
  zoomAtPoint(newScale, clientX, clientY) {
    const clampedScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    if (clampedScale === this.scale) return;

    const rect = this.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Calculate new translate to keep point under cursor
    const scaleRatio = clampedScale / this.scale;
    this.translateX = x - (x - this.translateX) * scaleRatio;
    this.translateY = y - (y - this.translateY) * scaleRatio;
    
    this.scale = clampedScale;
    this.applyTransform();
  }

  /**
   * Zoom in by step
   */
  zoomIn(step = 0.15) {
    const rect = this.container.getBoundingClientRect();
    this.zoomAtPoint(this.scale * (1 + step), rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  /**
   * Zoom out by step
   */
  zoomOut(step = 0.15) {
    const rect = this.container.getBoundingClientRect();
    this.zoomAtPoint(this.scale * (1 - step), rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  /**
   * Fit the entire mindmap in view
   */
  fitToView(bounds, padding = 80) {
    if (!bounds || bounds.maxX === undefined) return;
    
    const rect = this.container.getBoundingClientRect();
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    if (contentWidth === 0 || contentHeight === 0) return;

    const scaleX = (rect.width - padding * 2) / contentWidth;
    const scaleY = (rect.height - padding * 2) / contentHeight;
    const newScale = Math.min(scaleX, scaleY, 1); // Max scale 1
    
    this.scale = Math.max(this.minScale, newScale);
    
    const centerX = bounds.minX + contentWidth / 2;
    const centerY = bounds.minY + contentHeight / 2;
    
    this.translateX = rect.width / 2 - centerX * this.scale;
    this.translateY = rect.height / 2 - centerY * this.scale;
    
    this.applyTransform(true);
  }

  /**
   * Center on a specific point
   */
  centerOnPoint(x, y, animate = false) {
    const rect = this.container ? this.container.getBoundingClientRect() : null;
    const width = (rect && rect.width > 0) ? rect.width : (window.innerWidth || 1200);
    const height = (rect && rect.height > 0) ? rect.height : (window.innerHeight || 800);
    
    this.translateX = width / 2 - x * this.scale;
    this.translateY = height / 2 - y * this.scale;

    if (animate) {
      this.transform.style.transition = 'transform 0.2s ease-out';
      setTimeout(() => { this.transform.style.transition = ''; }, 200);
    } else {
      this.transform.style.transition = '';
    }

    this.transform.style.transform = `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.scale})`;
    this.emit('change', { scale: this.scale, translateX: this.translateX, translateY: this.translateY });
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  screenToCanvas(screenX, screenY) {
    const rect = this.container.getBoundingClientRect();
    const x = (screenX - rect.left - this.translateX) / this.scale;
    const y = (screenY - rect.top - this.translateY) / this.scale;
    return { x, y };
  }

  /**
   * Convert canvas coordinates to screen coordinates
   */
  canvasToScreen(canvasX, canvasY) {
    const rect = this.container.getBoundingClientRect();
    const x = canvasX * this.scale + this.translateX + rect.left;
    const y = canvasY * this.scale + this.translateY + rect.top;
    return { x, y };
  }

  /**
   * Get current zoom percentage
   */
  getZoomPercent() {
    return Math.round(this.scale * 100);
  }

  /**
   * Set space key state
   */
  setSpacePressed(pressed) {
    if (this.spacePressed === pressed) return;
    this.spacePressed = pressed;
    if (!this.isPanning) {
      this.container.style.cursor = pressed ? 'grab' : '';
    }
  }

  /**
   * Reset to default view
   */
  resetView() {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.applyTransform(true);
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  destroy() {
    for (const [type, handler] of Object.entries(this.touchEvents ?? {})) {
      this.container.removeEventListener(type, handler, true);
    }
    this.container.removeEventListener('wheel', this.handleWheel);
    this.container.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }
}
