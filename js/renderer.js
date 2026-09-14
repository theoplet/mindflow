import { $, createElement, compressImageFile, createBezierEasing } from './utils.js';
import { handleSmartTab, handleSmartEnter, handleSmartSpace, handleSmartBackspace, handleSmartInput } from './smart_editor.js';

export class Renderer {
  constructor(canvasElement, svgElement) {
    this.canvas = canvasElement;
    this.nodesContainer = document.getElementById('nodes-container') || canvasElement;
    this.svg = svgElement;
    this.nodeElements = new Map();
    this.connectorElements = new Map();
    
    // Callbacks
    this.onNodeClick = null;
    this.onNodeDoubleClick = null;
    this.onNodeContextMenu = null;
    this.onNodeDragStart = null;
    this.onNodeDragMove = null;
    this.onNodeDragEnd = null;
    this.onNodeTextChange = null;
    this.onCollapseToggle = null;
    this.onNodeResize = null;
    this.onNodeImagesUpdate = null;
    this.onLineClick = null;
    this.onFreeLineClick = null;
    this.selectedConnectionId = null;
    this.currentConnections = [];

    // Easing & Animation Sync State
    this.easeCubic = createBezierEasing(0.16, 1, 0.3, 1);
    this.lastRenderedPositions = new Map();
    this.connectorAnimFrame = null;

    // Drag State
    this.dragState = {
      isDragging: false,
      dragNodeId: null,
      startX: 0,
      startY: 0,
      initialLeft: 0,
      initialTop: 0,
      currentClientX: null,
      currentClientY: null,
      currentDropTargetEl: null,
      rafPending: null,
      timeout: null
    };

    // Bind event handlers
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    
    this.initDragDrop();
  }

  /**
   * Full render of entire mindmap tree
   */
  /**
   * Full render of entire mindmap tree(s)
   */
  renderTree(rootNode, layoutData, globalLineStyle = {}, allLinesSelected = false, connections = []) {
    if (!layoutData) return;
    this.currentRootNode = rootNode;
    this.currentLayoutData = layoutData;
    this.globalLineStyle = globalLineStyle;
    this.allLinesSelected = allLinesSelected;
    this.currentConnections = connections || [];

    const currentLayoutIds = new Set(layoutData.map(item => item.id));

    // 1. Remove DOM elements no longer in layout
    for (const [nodeId, element] of this.nodeElements.entries()) {
      if (!currentLayoutIds.has(nodeId)) {
        element.remove();
        this.nodeElements.delete(nodeId);
      }
    }

    // 2. Render/Update DOM nodes
    layoutData.forEach(layoutInfo => {
      const node = layoutInfo.node;
      if (!node) return;
      let element = this.nodeElements.get(node.id);
      if (element) {
        this.updateNodeElement(node, layoutInfo);
      } else {
        this.createNodeElement(node, layoutInfo);
      }
    });

    // 3. Render SVG Connectors with synchronized animation
    if (this.connectorAnimFrame) {
      cancelAnimationFrame(this.connectorAnimFrame);
      this.connectorAnimFrame = null;
    }

    // Check if any existing node changed positions
    let hasMoved = false;
    if (this.lastRenderedPositions && this.lastRenderedPositions.size > 0 && !this.dragState.isDragging) {
      for (const l of layoutData) {
        const prev = this.lastRenderedPositions.get(l.id);
        if (prev && (Math.abs(prev.x - l.x) > 1 || Math.abs(prev.y - l.y) > 1)) {
          hasMoved = true;
          break;
        }
      }
    }

    if (!hasMoved) {
      this.renderConnectors(rootNode, layoutData, this.currentConnections);
      this.lastRenderedPositions = new Map(layoutData.map(l => [l.id, { x: l.x, y: l.y, width: l.width, height: l.height }]));
    } else {
      const startTime = performance.now();
      const duration = 300; // Matches CSS transition duration (300ms)
      const oldPositions = new Map(this.lastRenderedPositions);

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease = this.easeCubic ? this.easeCubic(progress) : progress;

        const interpolatedLayout = layoutData.map(l => {
          const old = oldPositions.get(l.id);
          if (!old) return l; // New nodes are already at target position
          const curX = old.x + (l.x - old.x) * ease;
          const curY = old.y + (l.y - old.y) * ease;
          const curW = old.width + ((l.width || old.width) - old.width) * ease;
          const curH = old.height + ((l.height || old.height) - old.height) * ease;
          return {
            ...l,
            x: curX,
            y: curY,
            width: curW,
            height: curH
          };
        });

        this.renderConnectors(rootNode, interpolatedLayout, this.currentConnections);

        if (progress < 1) {
          this.connectorAnimFrame = requestAnimationFrame(step);
        } else {
          this.connectorAnimFrame = null;
          this.renderConnectors(rootNode, layoutData, this.currentConnections);
          this.lastRenderedPositions = new Map(layoutData.map(l => [l.id, { x: l.x, y: l.y, width: l.width, height: l.height }]));
        }
      };

      this.connectorAnimFrame = requestAnimationFrame(step);
    }
  }

  /**
   * Create DOM element for a node
   */
  createNodeElement(node, layoutInfo) {
    const isRoot = layoutInfo.depth === 0;
    const element = document.createElement('div');
    element.className = `mindmap-node ${isRoot ? 'root-node' : ''} animate-node-appear`;
    element.dataset.nodeId = node.id;
    
    element.style.position = 'absolute';
    element.style.left = `${layoutInfo.x}px`;
    element.style.top = `${layoutInfo.y}px`;
    if (layoutInfo.width) element.style.width = `${layoutInfo.width}px`;
    if (layoutInfo.height) {
      element.style.minHeight = `${layoutInfo.height}px`;
      element.style.height = node.customHeight ? `${node.customHeight}px` : 'auto';
    }

    if (node.color && !isRoot) {
      element.style.borderLeft = `3px solid ${node.color}`;
    }

    // Top-Left Icon Badge
    if (node.icon) {
      const iconBadge = document.createElement('div');
      iconBadge.className = 'node-icon-badge';
      iconBadge.textContent = node.icon;
      element.appendChild(iconBadge);
    }

    // Top-Right Notes Badge & Popover
    if (node.notes) {
      const notesBadge = document.createElement('div');
      notesBadge.className = 'node-notes-badge';
      notesBadge.textContent = '📝';
      notesBadge.title = 'Click to view notes';
      element.appendChild(notesBadge);

      const notesPopover = document.createElement('div');
      notesPopover.className = 'node-notes-popover';
      notesPopover.textContent = node.notes;
      element.appendChild(notesPopover);

      notesBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        notesPopover.classList.toggle('open');
        if (notesPopover.classList.contains('open')) {
          notesPopover.classList.remove('popover-left');
          const rect = notesPopover.getBoundingClientRect();
          if (rect.right > window.innerWidth - 12) {
            notesPopover.classList.add('popover-left');
          }
        }
      });
    }

    // Node Images (Multiple & Resizable)
    const imagesList = node.images || (node.image ? [node.image] : []);
    if (imagesList.length > 0) {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'node-images-container';
      imagesList.forEach((srcObj, idx) => {
        imgContainer.appendChild(this.renderImageWrapper(srcObj, idx, node));
      });
      element.appendChild(imgContainer);
    }

    // Node Header & Text
    const header = document.createElement('div');
    header.className = 'node-header';

    const textSpan = document.createElement('span');
    textSpan.className = 'node-text';
    textSpan.contentEditable = 'false';
    textSpan.innerHTML = this.formatNodeText(node.text);

    if (this.containsRealMath(node.text)) {
      element.classList.add('has-math');
    }

    // Apply Node Formatting Properties
    if (node.fontSize) textSpan.style.fontSize = `${node.fontSize}px`;
    if (node.fontFamily) textSpan.style.fontFamily = node.fontFamily;
    if (node.highlightColor && node.highlightColor !== 'none') {
      textSpan.style.backgroundColor = node.highlightColor;
      textSpan.style.padding = '2px 6px';
      textSpan.style.borderRadius = '3px';
      textSpan.style.color = '#0F172A';
    } else if (node.textColor && node.textColor !== 'inherit') {
      textSpan.style.color = node.textColor;
      const tc = node.textColor.toLowerCase();
      if (tc === '#ffffff' || tc === '#fafafa' || tc === '#f8fafc' || tc === 'white' || tc === 'rgb(255, 255, 255)') {
        textSpan.style.textShadow = '0 1px 3px rgba(0,0,0,0.9), 0 0 2px #000';
      } else {
        textSpan.style.textShadow = '';
      }
    }
    if (node.fontWeight) textSpan.style.fontWeight = node.fontWeight;
    if (node.fontStyle) textSpan.style.fontStyle = node.fontStyle;
    if (node.textDecoration) textSpan.style.textDecoration = node.textDecoration;
    if (node.textAlign) textSpan.style.textAlign = node.textAlign;

    header.appendChild(textSpan);
    element.appendChild(header);

    // Collapse toggle (Outset)
    if (node.children && node.children.length > 0) {
      const toggle = document.createElement('button');
      toggle.className = 'collapse-toggle';
      toggle.textContent = node.collapsed ? '+' : '-';
      toggle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onCollapseToggle) this.onCollapseToggle(node.id);
      });
      element.appendChild(toggle);

      if (node.collapsed) {
        const badge = document.createElement('span');
        badge.className = 'child-count';
        badge.textContent = node.children.length.toString();
        element.appendChild(badge);
      }
    }

    // Resize Handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.title = 'Resize Node';
    element.appendChild(resizeHandle);

    // Mouse Drag Resize
    const initResize = (clientX, clientY) => {
      const startWidth = element.offsetWidth;
      const startHeight = element.offsetHeight;
      const startX = clientX;
      const startY = clientY;
      const scale = this.getCanvasScale ? this.getCanvasScale() : 1.0;

      const onMove = (moveEvt) => {
        const currentX = moveEvt.clientX || (moveEvt.touches && moveEvt.touches[0].clientX);
        const currentY = moveEvt.clientY || (moveEvt.touches && moveEvt.touches[0].clientY);
        if (!currentX || !currentY) return;

        const newW = Math.max(120, startWidth + (currentX - startX) / scale);
        const newH = Math.max(40, startHeight + (currentY - startY) / scale);
        element.style.width = `${newW}px`;
        element.style.height = `${newH}px`;
        if (this.onNodeResize) this.onNodeResize(node.id, newW, newH);
      };

      const onEnd = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
    };

    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      initResize(e.clientX, e.clientY);
    });

    resizeHandle.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      if (e.touches && e.touches[0]) {
        initResize(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

// Paste Images or Formatted Text onto Node
    element.addEventListener('paste', (e) => {
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      if (items) {
        let hasImage = false;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            e.stopPropagation();
            hasImage = true;
            const blob = items[i].getAsFile();
            if (blob) {
              compressImageFile(blob, 1200).then((compressedSrc) => {
                const currentImages = Array.isArray(node.images) ? [...node.images] : (node.image ? [node.image] : []);
                currentImages.push({ src: compressedSrc, width: 160, height: 100 });
                if (this.onNodeImagesUpdate) {
                  this.onNodeImagesUpdate(node.id, currentImages);
                }
              });
            }
          }
        }
        if (hasImage) return;
      }

      if (textSpan.isContentEditable) {
        e.preventDefault();
        const text = clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }
    });

    // Touch Interaction State
    let touchTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTapTime = 0;

    element.addEventListener('touchstart', (e) => {
      if (e.target.closest('.collapse-toggle') || e.target.closest('.resize-handle') || e.target.closest('.node-notes-badge') || textSpan.isContentEditable) return;
      
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;

      touchTimer = setTimeout(() => {
        if (this.onNodeContextMenu) {
          this.onNodeContextMenu(node.id, { clientX: touchStartX, clientY: touchStartY });
        }
      }, 1000);

      this.dragState.dragNodeId = node.id;
      this.dragState.startX = touch.clientX;
      this.dragState.startY = touch.clientY;
      this.dragState.initialLeft = parseFloat(element.style.left) || 0;
      this.dragState.initialTop = parseFloat(element.style.top) || 0;
      this.dragState.isDragging = false;
    }, { passive: false });

    element.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      if (Math.abs(touch.clientX - touchStartX) > 10 || Math.abs(touch.clientY - touchStartY) > 10) {
        clearTimeout(touchTimer);
      }
      this.handleMouseMove(e);
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
      clearTimeout(touchTimer);
      
      const now = Date.now();
      if (now - lastTapTime < 300) {
        if (this.onNodeDoubleClick) this.onNodeDoubleClick(node.id);
      } else {
        if (this.onNodeClick) this.onNodeClick(node.id);
      }
      lastTapTime = now;

      this.handleMouseUp(e);
    });

    element.addEventListener('click', (e) => {
      e.stopPropagation();
      // Prevent click from putting caret into text if not in editing mode
      if (!textSpan.isContentEditable || textSpan.contentEditable === 'false') {
        window.getSelection()?.removeAllRanges();
      }
      if (this.onNodeClick) this.onNodeClick(node.id);
    });

    element.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.onNodeDoubleClick) this.onNodeDoubleClick(node.id);
    });

    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.dragState.timeout) {
        clearTimeout(this.dragState.timeout);
        this.dragState.timeout = null;
      }
      this.dragState.dragNodeId = null;
      this.dragState.isDragging = false;
      if (this.onNodeContextMenu) this.onNodeContextMenu(node.id, e);
    });

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only drag on left click (button 0)
      if (e.target.closest('.collapse-toggle') || e.target.closest('.resize-handle') || e.target.closest('.node-notes-badge')) return;
      // If currently editing this node, allow normal text interaction
      if (textSpan.isContentEditable && textSpan.contentEditable !== 'false') return;
      // Prevent browser from placing cursor/selecting text on single click
      e.preventDefault();
      e.stopPropagation();
      
      this.dragState.dragNodeId = node.id;
      this.dragState.startX = e.clientX;
      this.dragState.startY = e.clientY;
      this.dragState.initialLeft = parseFloat(element.style.left) || 0;
      this.dragState.initialTop = parseFloat(element.style.top) || 0;
      this.dragState.isDragging = false;
    });

    this.nodeElements.set(node.id, element);
    this.nodesContainer.appendChild(element);
    return element;
  }

  /**
   * Update existing node element
   */
  updateNodeElement(node, layoutInfo) {
    const element = this.nodeElements.get(node.id);
    if (!element) return;

    element.style.left = `${layoutInfo.x}px`;
    element.style.top = `${layoutInfo.y}px`;
    if (layoutInfo.width) element.style.width = `${layoutInfo.width}px`;
    if (layoutInfo.height) {
      element.style.minHeight = `${layoutInfo.height}px`;
      element.style.height = node.customHeight ? `${node.customHeight}px` : 'auto';
    }

    const isRoot = layoutInfo.depth === 0;
    
    // Update text & formatting
    const textSpan = element.querySelector('.node-text');
    if (textSpan && !textSpan.isContentEditable) {
      const formatted = this.formatNodeText(node.text);
      if (textSpan.innerHTML !== formatted) {
        textSpan.innerHTML = formatted;
      }
      if (this.containsRealMath(node.text)) {
        element.classList.add('has-math');
      } else {
        element.classList.remove('has-math');
      }
      textSpan.style.fontSize = node.fontSize ? `${node.fontSize}px` : '';
      textSpan.style.fontFamily = node.fontFamily || '';
      if (node.highlightColor && node.highlightColor !== 'none') {
        textSpan.style.backgroundColor = node.highlightColor;
        textSpan.style.padding = '2px 6px';
        textSpan.style.borderRadius = '3px';
        textSpan.style.color = '#0F172A';
      } else if (node.textColor && node.textColor !== 'inherit') {
        textSpan.style.backgroundColor = '';
        textSpan.style.padding = '';
        textSpan.style.borderRadius = '';
        textSpan.style.color = node.textColor;
        const tc = node.textColor.toLowerCase();
        if (tc === '#ffffff' || tc === '#fafafa' || tc === '#f8fafc' || tc === 'white' || tc === 'rgb(255, 255, 255)') {
          textSpan.style.textShadow = '0 1px 3px rgba(0,0,0,0.9), 0 0 2px #000';
        } else {
          textSpan.style.textShadow = '';
        }
      } else {
        textSpan.style.backgroundColor = '';
        textSpan.style.padding = '';
        textSpan.style.borderRadius = '';
        textSpan.style.color = '';
        textSpan.style.textShadow = '';
      }
      textSpan.style.fontWeight = node.fontWeight || 'normal';
      textSpan.style.fontStyle = node.fontStyle || 'normal';
      textSpan.style.textDecoration = node.textDecoration || 'none';
      textSpan.style.textAlign = node.textAlign || 'left';
    }

    // Update top-left icon badge
    let iconBadge = element.querySelector('.node-icon-badge');
    if (node.icon) {
      if (!iconBadge) {
        iconBadge = document.createElement('div');
        iconBadge.className = 'node-icon-badge';
        element.appendChild(iconBadge);
      }
      iconBadge.textContent = node.icon;
    } else if (iconBadge) {
      iconBadge.remove();
    }

    // Update notes badge & popover
    let notesBadge = element.querySelector('.node-notes-badge');
    let notesPopover = element.querySelector('.node-notes-popover');
    if (node.notes) {
      if (!notesBadge) {
        notesBadge = document.createElement('div');
        notesBadge.className = 'node-notes-badge';
        notesBadge.textContent = '📝';
        notesBadge.title = 'Click to view notes';
        element.appendChild(notesBadge);

        notesPopover = document.createElement('div');
        notesPopover.className = 'node-notes-popover';
        element.appendChild(notesPopover);

        notesBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          notesPopover.classList.toggle('open');
          if (notesPopover.classList.contains('open')) {
            notesPopover.classList.remove('popover-left');
            const rect = notesPopover.getBoundingClientRect();
            if (rect.right > window.innerWidth - 12) {
              notesPopover.classList.add('popover-left');
            }
          }
        });
      }
      if (notesPopover) notesPopover.textContent = node.notes;
    } else {
      if (notesBadge) notesBadge.remove();
      if (notesPopover) notesPopover.remove();
    }

    // Update images container
    let imgContainer = element.querySelector('.node-images-container');
    const imagesList = node.images || (node.image ? [node.image] : []);
    if (imagesList.length > 0) {
      if (!imgContainer) {
        imgContainer = document.createElement('div');
        imgContainer.className = 'node-images-container';
        element.insertBefore(imgContainer, element.querySelector('.node-header'));
      }
      imgContainer.innerHTML = '';
      imagesList.forEach((srcObj, idx) => {
        imgContainer.appendChild(this.renderImageWrapper(srcObj, idx, node));
      });
    } else if (imgContainer) {
      imgContainer.remove();
    }

    // Update collapse toggle
    let toggle = element.querySelector('.collapse-toggle');
    let badge = element.querySelector('.child-count');
    
    if (node.children && node.children.length > 0) {
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.className = 'collapse-toggle';
        toggle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onCollapseToggle) this.onCollapseToggle(node.id);
        });
        element.appendChild(toggle);
      }
      toggle.textContent = node.collapsed ? '+' : '-';
      
      if (node.collapsed) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'child-count';
          element.appendChild(badge);
        }
        badge.textContent = node.children.length.toString();
      } else if (badge) {
        badge.remove();
      }
    } else {
      if (toggle) toggle.remove();
      if (badge) badge.remove();
    }

    // Update colors
    const wasSelected = element.classList.contains('selected');
    const wasEditing = element.classList.contains('editing');
    const hadMath = element.classList.contains('has-math');
    element.className = `mindmap-node ${isRoot ? 'root-node' : ''}`;
    if (wasSelected) element.classList.add('selected');
    if (wasEditing) element.classList.add('editing');
    if (hadMath) element.classList.add('has-math');
    if (node.color) {
      if (!isRoot) {
        element.style.borderLeft = `3px solid ${node.color}`;
      } else {
        element.style.borderLeft = '';
      }
    } else {
      element.style.borderLeft = '';
    }
  }

  renderImageWrapper(srcObj, idx, node) {
    const src = typeof srcObj === 'string' ? srcObj : srcObj.src;
    const w = typeof srcObj === 'object' ? srcObj.width : null;
    const h = typeof srcObj === 'object' ? srcObj.height : null;

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'node-image-wrapper';

    const img = document.createElement('img');
    img.className = 'node-image-item';
    img.src = src;
    img.style.width = w ? `${w}px` : '160px';
    if (h) img.style.height = `${h}px`;
    imgWrapper.appendChild(img);

    // Image Resize Handle at bottom-right corner of image wrapper!
    const imgResizeHandle = document.createElement('div');
    imgResizeHandle.className = 'img-resize-handle';
    imgResizeHandle.title = 'Kéo để phóng to / thu nhỏ hình ảnh này';
    imgWrapper.appendChild(imgResizeHandle);

    const initImgResize = (clientX, clientY) => {
      const startW = img.offsetWidth || 160;
      const startH = img.offsetHeight || 100;
      const startX = clientX;
      const startY = clientY;
      const scale = this.getCanvasScale ? this.getCanvasScale() : 1.0;
      const aspectRatio = startW / (startH || 1);

      const onMove = (moveEvt) => {
        const currX = moveEvt.clientX || (moveEvt.touches && moveEvt.touches[0].clientX);
        const currY = moveEvt.clientY || (moveEvt.touches && moveEvt.touches[0].clientY);
        if (!currX || !currY) return;

        const deltaX = (currX - startX) / scale;
        const newW = Math.max(60, Math.min(800, startW + deltaX));
        const newH = Math.max(40, Math.round(newW / aspectRatio));

        img.style.width = `${newW}px`;
        img.style.height = `${newH}px`;
      };

      const onEnd = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);

        const finalW = img.offsetWidth;
        const finalH = img.offsetHeight;
        if (this.onImageResize) {
          this.onImageResize(node.id, idx, finalW, finalH);
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
    };

    imgResizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      initImgResize(e.clientX, e.clientY);
    });

    imgResizeHandle.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      if (e.touches && e.touches[0]) {
        initImgResize(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    return imgWrapper;
  }

  /**
   * Render SVG Connectors for root(s)
   */
  renderConnectors(rootNode, layoutData, connections = null) {
    const activePaths = new Set();
    const layoutMap = new Map();
    layoutData.forEach(info => layoutMap.set(info.id, info));

    const gStyle = this.globalLineStyle || {};
    const conns = connections !== null ? connections : (this.currentConnections || []);

    const traverse = (node) => {
      if (!node || node.collapsed || !node.children) return;
      
      const parentInfo = layoutMap.get(node.id);
      if (!parentInfo) return;

      node.children.forEach(child => {
        const childInfo = layoutMap.get(child.id);
        if (!childInfo) return;

        const pathId = `${node.id}-${child.id}`;
        const hitPathId = `${pathId}-hit`;
        activePaths.add(pathId);
        activePaths.add(hitPathId);
        
        const pw = parentInfo.width || 100;
        const ph = parentInfo.height || 40;
        const cw = childInfo.width || 100;
        const ch = childInfo.height || 40;

        const connectorInfo = this.getConnectorPath(
          parentInfo.x, parentInfo.y, pw, ph,
          childInfo.x, childInfo.y, cw, ch
        );
        const pathData = connectorInfo.d;
        const midX = connectorInfo.midX;
        const midY = connectorInfo.midY;

        let pathElement = this.connectorElements.get(pathId);
        let hitPath = this.connectorElements.get(hitPathId);
        if (!pathElement) {
          pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          pathElement.setAttribute('class', 'connector-path');
          pathElement.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onLineClick) {
              this.onLineClick(node.id, child.id, pathElement, e);
            }
          });
          this.svg.appendChild(pathElement);
          this.connectorElements.set(pathId, pathElement);

          // Transparent hit area for easier clicking
          hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          hitPath.setAttribute('class', 'connector-hit-area');
          hitPath.setAttribute('stroke', 'transparent');
          hitPath.setAttribute('stroke-width', '16');
          hitPath.setAttribute('fill', 'none');
          hitPath.setAttribute('opacity', '0');
          hitPath.style.pointerEvents = 'stroke';
          hitPath.style.cursor = 'pointer';
          hitPath.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onLineClick) {
              this.onLineClick(node.id, child.id, pathElement, e);
            }
          });
          this.svg.appendChild(hitPath);
          this.connectorElements.set(hitPathId, hitPath);
        }

        pathElement.setAttribute('d', pathData);
        if (hitPath) hitPath.setAttribute('d', pathData);

        // Styling Line Properties
        const lineW = child.lineWidth || gStyle.width || 2;
        const lineOp = child.lineOpacity !== null && child.lineOpacity !== undefined ? child.lineOpacity : (gStyle.opacity !== undefined ? gStyle.opacity : 1.0);
        const lineD = child.lineDash || gStyle.dash || 'solid';
        const lineColor = child.lineColor || gStyle.color || node.color || 'var(--color-border)';

        pathElement.setAttribute('stroke', lineColor);
        pathElement.setAttribute('stroke-width', `${lineW}`);
        pathElement.setAttribute('opacity', `${lineOp}`);

        if (lineD === 'dashed') {
          pathElement.setAttribute('stroke-dasharray', '6 6');
        } else if (lineD === 'dotted') {
          pathElement.setAttribute('stroke-dasharray', '2 4');
        } else {
          pathElement.removeAttribute('stroke-dasharray');
        }

        pathElement.setAttribute('class', `connector-path ${lineD} ${this.allLinesSelected ? 'selected-connector' : ''}`);

        const arrowDir = child.lineArrow || gStyle.arrow || 'none';
        if (arrowDir === 'end' || arrowDir === true) {
          pathElement.setAttribute('marker-end', 'url(#arrow-end)');
          pathElement.removeAttribute('marker-start');
        } else if (arrowDir === 'start') {
          pathElement.setAttribute('marker-start', 'url(#arrow-start)');
          pathElement.removeAttribute('marker-end');
        } else if (arrowDir === 'both') {
          pathElement.setAttribute('marker-end', 'url(#arrow-end)');
          pathElement.setAttribute('marker-start', 'url(#arrow-start)');
        } else {
          pathElement.removeAttribute('marker-end');
          pathElement.removeAttribute('marker-start');
        }

        // Render Line Text Label if present
        const labelGroupId = `${pathId}-label`;
        activePaths.add(labelGroupId);
        let labelGroup = this.connectorElements.get(labelGroupId);

        if (child.lineText && String(child.lineText).trim()) {
          const textVal = String(child.lineText).trim();
          if (!labelGroup) {
            labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelGroup.setAttribute('class', 'connector-label-group');

            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('class', 'connector-label-bg');

            const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textEl.setAttribute('class', 'connector-label-text');

            labelGroup.appendChild(bgRect);
            labelGroup.appendChild(textEl);

            labelGroup.addEventListener('click', (e) => {
              e.stopPropagation();
              if (this.onLineClick) {
                this.onLineClick(node.id, child.id, pathElement, e);
              }
            });

            this.svg.appendChild(labelGroup);
            this.connectorElements.set(labelGroupId, labelGroup);
          }

          const bgRect = labelGroup.querySelector('.connector-label-bg');
          const textEl = labelGroup.querySelector('.connector-label-text');

          textEl.textContent = textVal;
          textEl.setAttribute('x', `${midX}`);
          textEl.setAttribute('y', `${midY + 4}`);

          const textWidth = Math.max(34, textVal.length * 7.5 + 16);
          const textHeight = 22;

          bgRect.setAttribute('x', `${midX - textWidth / 2}`);
          bgRect.setAttribute('y', `${midY - textHeight / 2}`);
          bgRect.setAttribute('width', `${textWidth}`);
          bgRect.setAttribute('height', `${textHeight}`);
          bgRect.setAttribute('stroke', lineColor);
          labelGroup.style.display = 'block';
        } else {
          if (labelGroup) {
            labelGroup.style.display = 'none';
          }
        }

        traverse(child);
      });
    };

    if (Array.isArray(rootNode)) {
      rootNode.forEach(r => traverse(r));
    } else if (rootNode) {
      traverse(rootNode);
    }

    // Render Free Connections
    this.renderFreeConnections(conns, layoutMap, activePaths);

    for (const [pathId, element] of this.connectorElements.entries()) {
      if (!activePaths.has(pathId)) {
        element.remove();
        this.connectorElements.delete(pathId);
      }
    }
  }

  /**
   * Render Free Connections between independent nodes
   */
  renderFreeConnections(connections, layoutMap, activePaths) {
    if (!Array.isArray(connections) || connections.length === 0) return;

    connections.forEach(conn => {
      const fromInfo = layoutMap.get(conn.fromId);
      const toInfo = layoutMap.get(conn.toId);
      if (!fromInfo || !toInfo) return;

      const pathId = `free-${conn.id}`;
      const hitPathId = `${pathId}-hit`;
      activePaths.add(pathId);
      activePaths.add(hitPathId);

      const fw = fromInfo.width || 100;
      const fh = fromInfo.height || 40;
      const tw = toInfo.width || 100;
      const th = toInfo.height || 40;

      const connectorInfo = this.getConnectorPath(
        fromInfo.x, fromInfo.y, fw, fh,
        toInfo.x, toInfo.y, tw, th
      );
      const pathData = connectorInfo.d;
      const midX = connectorInfo.midX;
      const midY = connectorInfo.midY;

      let pathElement = this.connectorElements.get(pathId);
      let hitPath = this.connectorElements.get(hitPathId);

      if (!pathElement) {
        pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElement.setAttribute('class', 'free-connector-path');
        pathElement.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onFreeLineClick) {
            this.onFreeLineClick(conn.id, pathElement, e);
          }
        });
        this.svg.appendChild(pathElement);
        this.connectorElements.set(pathId, pathElement);

        hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitPath.setAttribute('class', 'free-connector-hit-area');
        hitPath.style.pointerEvents = 'stroke';
        hitPath.style.cursor = 'pointer';
        hitPath.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onFreeLineClick) {
            this.onFreeLineClick(conn.id, pathElement, e);
          }
        });
        this.svg.appendChild(hitPath);
        this.connectorElements.set(hitPathId, hitPath);
      }

      pathElement.setAttribute('d', pathData);
      if (hitPath) hitPath.setAttribute('d', pathData);

      const lineW = conn.lineWidth || 2;
      const lineOp = conn.lineOpacity !== null && conn.lineOpacity !== undefined ? conn.lineOpacity : 1.0;
      const lineD = conn.lineDash || 'solid';
      const lineColor = conn.lineColor || '#38BDF8';

      pathElement.setAttribute('stroke', lineColor);
      pathElement.setAttribute('stroke-width', `${lineW}`);
      pathElement.setAttribute('opacity', `${lineOp}`);

      if (lineD === 'dashed') {
        pathElement.setAttribute('stroke-dasharray', '6 6');
      } else if (lineD === 'dotted') {
        pathElement.setAttribute('stroke-dasharray', '2 4');
      } else {
        pathElement.removeAttribute('stroke-dasharray');
      }

      const isSelected = this.selectedConnectionId === conn.id;
      pathElement.setAttribute('class', `free-connector-path ${lineD} ${isSelected ? 'selected-connector' : ''}`);

      const arrowDir = conn.lineArrow || 'none';
      if (arrowDir === 'end' || arrowDir === true) {
        pathElement.setAttribute('marker-end', 'url(#arrow-end)');
        pathElement.removeAttribute('marker-start');
      } else if (arrowDir === 'start') {
        pathElement.setAttribute('marker-start', 'url(#arrow-start)');
        pathElement.removeAttribute('marker-end');
      } else if (arrowDir === 'both') {
        pathElement.setAttribute('marker-end', 'url(#arrow-end)');
        pathElement.setAttribute('marker-start', 'url(#arrow-start)');
      } else {
        pathElement.removeAttribute('marker-end');
        pathElement.removeAttribute('marker-start');
      }

      // Line Text Label
      const labelGroupId = `${pathId}-label`;
      activePaths.add(labelGroupId);
      let labelGroup = this.connectorElements.get(labelGroupId);

      if (conn.lineText && String(conn.lineText).trim()) {
        const textVal = String(conn.lineText).trim();
        if (!labelGroup) {
          labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          labelGroup.setAttribute('class', 'connector-label-group');

          const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bgRect.setAttribute('class', 'connector-label-bg');

          const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          textEl.setAttribute('class', 'connector-label-text');

          labelGroup.appendChild(bgRect);
          labelGroup.appendChild(textEl);

          labelGroup.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onFreeLineClick) {
              this.onFreeLineClick(conn.id, pathElement, e);
            }
          });

          this.svg.appendChild(labelGroup);
          this.connectorElements.set(labelGroupId, labelGroup);
        }

        const bgRect = labelGroup.querySelector('.connector-label-bg');
        const textEl = labelGroup.querySelector('.connector-label-text');

        textEl.textContent = textVal;
        textEl.setAttribute('x', `${midX}`);
        textEl.setAttribute('y', `${midY + 4}`);

        const textWidth = Math.max(34, textVal.length * 7.5 + 16);
        const textHeight = 22;

        bgRect.setAttribute('x', `${midX - textWidth / 2}`);
        bgRect.setAttribute('y', `${midY - textHeight / 2}`);
        bgRect.setAttribute('width', `${textWidth}`);
        bgRect.setAttribute('height', `${textHeight}`);
        bgRect.setAttribute('stroke', lineColor);
        labelGroup.style.display = 'block';
      } else {
        if (labelGroup) {
          labelGroup.style.display = 'none';
        }
      }
    });
  }

  /**
   * Calculate cubic Bezier path
   */
  getConnectorPath(px, py, pw, ph, cx, cy, cw, ch) {
    const parentCenterX = px + pw / 2;
    const parentCenterY = py + ph / 2;
    const childCenterX = cx + cw / 2;
    const childCenterY = cy + ch / 2;

    let startX, startY, endX, endY;

    if (childCenterX >= parentCenterX) {
      startX = px + pw;
      startY = parentCenterY;
      endX = cx;
      endY = childCenterY;
    } else {
      startX = px;
      startY = parentCenterY;
      endX = cx + cw;
      endY = childCenterY;
    }

    const dx = endX - startX;
    const controlOffset = Math.max(Math.abs(dx) * 0.5, 30);

    const cp1x = childCenterX >= parentCenterX ? startX + controlOffset : startX - controlOffset;
    const cp2x = childCenterX >= parentCenterX ? endX - controlOffset : endX + controlOffset;

    // Cubic Bezier midpoint at t = 0.5
    const midX = 0.125 * startX + 0.375 * cp1x + 0.375 * cp2x + 0.125 * endX;
    const midY = 0.5 * startY + 0.5 * endY;

    return {
      d: `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`,
      midX,
      midY
    };
  }

  initDragDrop() {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd);
    document.addEventListener('touchcancel', this.handleTouchEnd);
  }

  handleTouchMove(e) {
    if (this.dragState.isDragging && e.cancelable) {
      e.preventDefault();
    }
    this.handleMouseMove(e);
  }

  handleTouchEnd(e) {
    this.handleMouseUp(e);
  }

  findNodeInTree(root, nodeId) {
    if (!root) return null;
    if (Array.isArray(root)) {
      for (const r of root) {
        const found = this.findNodeInTree(r, nodeId);
        if (found) return found;
      }
      return null;
    }
    if (root.id === nodeId) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = this.findNodeInTree(child, nodeId);
        if (found) return found;
      }
    }
    return null;
  }

  isDescendantOf(ancestorId, targetId) {
    if (!ancestorId || !targetId || ancestorId === targetId) return false;
    const ancestor = this.findNodeInTree(this.currentRootNode, ancestorId);
    if (!ancestor || !ancestor.children) return false;
    return !!this.findNodeInTree(ancestor.children, targetId);
  }

  startDrag(nodeId, e) {
    const element = this.nodeElements.get(nodeId);
    if (!element) return;
    
    this.dragState.isDragging = true;
    if (this.connectorAnimFrame) {
      cancelAnimationFrame(this.connectorAnimFrame);
      this.connectorAnimFrame = null;
    }

    const addDraggingClass = (nId, isRoot = false) => {
      const el = this.nodeElements.get(nId);
      if (el) {
        el.classList.add('dragging');
        if (isRoot) {
          el.classList.add('drag-root');
        } else {
          el.classList.add('drag-subtree');
        }
      }
      const n = this.findNodeInTree(this.currentRootNode, nId);
      if (n && !n.collapsed && n.children) {
        n.children.forEach(c => addDraggingClass(c.id, false));
      }
    };
    addDraggingClass(nodeId, true);
    
    if (this.onNodeDragStart) {
      this.onNodeDragStart(nodeId);
    }
  }

  cancelDragState() {
    if (this.dragState.timeout) {
      clearTimeout(this.dragState.timeout);
      this.dragState.timeout = null;
    }
    if (this.dragState.rafPending) {
      cancelAnimationFrame(this.dragState.rafPending);
      this.dragState.rafPending = null;
    }
    if (this.dragState.currentDropTargetEl) {
      this.dragState.currentDropTargetEl.classList.remove('drop-target');
      this.dragState.currentDropTargetEl = null;
    }
    if (this.dragState.dragNodeId) {
      const removeDraggingClass = (nId) => {
        const el = this.nodeElements.get(nId);
        if (el) el.classList.remove('dragging', 'drag-root', 'drag-subtree');
        const n = this.findNodeInTree(this.currentRootNode, nId);
        if (n && !n.collapsed && n.children) {
          n.children.forEach(c => removeDraggingClass(c.id));
        }
      };
      removeDraggingClass(this.dragState.dragNodeId);
    }
    this.nodeElements.forEach(el => el.classList.remove('drop-target'));
    this.dragState.dragNodeId = null;
    this.dragState.isDragging = false;
  }

  handleMouseMove(e) {
    if (!this.dragState.dragNodeId) return;

    // Verify left mouse button is pressed (bitmask 1) for mouse events
    if (e.type === 'mousemove' && e.buttons !== undefined && (e.buttons & 1) === 0) {
      this.cancelDragState();
      return;
    }

    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (clientX === null || clientY === null) return;

    this.dragState.currentClientX = clientX;
    this.dragState.currentClientY = clientY;

    if (!this.dragState.isDragging) {
      const scale = this.getCanvasScale ? this.getCanvasScale() : 1.0;
      const dx = (clientX - this.dragState.startX) / scale;
      const dy = (clientY - this.dragState.startY) / scale;
      if (Math.sqrt(dx * dx + dy * dy) > 4) {
        if (this.dragState.timeout) {
          clearTimeout(this.dragState.timeout);
          this.dragState.timeout = null;
        }
        this.startDrag(this.dragState.dragNodeId, e);
      }
      return;
    }

    // Schedule high-performance rAF drag frame to lock to display refresh rate
    if (!this.dragState.rafPending) {
      this.dragState.rafPending = requestAnimationFrame(() => {
        this.dragState.rafPending = null;
        this.updateDragStep();
      });
    }
  }

  updateDragStep() {
    if (!this.dragState.isDragging || !this.dragState.dragNodeId) return;

    const scale = this.getCanvasScale ? this.getCanvasScale() : 1.0;
    const clientX = this.dragState.currentClientX;
    const clientY = this.dragState.currentClientY;
    if (clientX === null || clientY === null) return;

    const dx = (clientX - this.dragState.startX) / scale;
    const dy = (clientY - this.dragState.startY) / scale;
    const newX = this.dragState.initialLeft + dx;
    const newY = this.dragState.initialTop + dy;

    // 1. Live update position of dragged DOM element & connected SVG lines + subtree
    const draggedEl = this.nodeElements.get(this.dragState.dragNodeId);
    if (draggedEl) {
      draggedEl.style.left = `${newX}px`;
      draggedEl.style.top = `${newY}px`;
      this.updateLiveConnectors(this.dragState.dragNodeId, newX, newY);
    }

    // 2. Efficient drop target detection (ignoring dragged node & its subtree)
    let targetElement = document.elementFromPoint ? document.elementFromPoint(clientX, clientY)?.closest('.mindmap-node') : null;
    let targetId = targetElement ? targetElement.dataset.nodeId : null;

    // Do not allow dropping onto self or onto any of its own descendants
    if (targetId && (targetId === this.dragState.dragNodeId || this.isDescendantOf(this.dragState.dragNodeId, targetId))) {
      targetElement = null;
      targetId = null;
    }

    if (targetElement !== this.dragState.currentDropTargetEl) {
      if (this.dragState.currentDropTargetEl) {
        this.dragState.currentDropTargetEl.classList.remove('drop-target');
      }
      if (targetElement) {
        targetElement.classList.add('drop-target');
      }
      this.dragState.currentDropTargetEl = targetElement;
    }

    if (this.onNodeDragMove) {
      this.onNodeDragMove(this.dragState.dragNodeId, newX, newY);
    }
  }

  updateLiveConnectors(nodeId, newX, newY) {
    const layoutData = this.currentLayoutData;
    if (!layoutData) return;

    const layoutMap = new Map();
    layoutData.forEach(info => layoutMap.set(info.id, { ...info }));

    const currentInfo = layoutMap.get(nodeId);
    if (!currentInfo) return;

    const deltaX = newX - currentInfo.x;
    const deltaY = newY - currentInfo.y;

    const updateSubtreePositions = (nId) => {
      const info = layoutMap.get(nId);
      if (info) {
        info.x += deltaX;
        info.y += deltaY;
        const el = this.nodeElements.get(nId);
        if (el && nId !== nodeId) {
          el.style.left = `${info.x}px`;
          el.style.top = `${info.y}px`;
        }
      }
      const n = this.findNodeInTree(this.currentRootNode, nId);
      if (n && !n.collapsed && n.children) {
        n.children.forEach(child => updateSubtreePositions(child.id));
      }
    };

    updateSubtreePositions(nodeId);

    if (this.currentRootNode) {
      this.renderConnectors(this.currentRootNode, Array.from(layoutMap.values()), this.currentConnections);
    }
  }

  handleMouseUp(e) {
    if (this.dragState.timeout) {
      clearTimeout(this.dragState.timeout);
      this.dragState.timeout = null;
    }

    if (this.dragState.rafPending) {
      cancelAnimationFrame(this.dragState.rafPending);
      this.dragState.rafPending = null;
    }

    if (this.dragState.isDragging) {
      const clientX = e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : this.dragState.currentClientX || this.dragState.startX);
      const clientY = e.clientY !== undefined ? e.clientY : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : this.dragState.currentClientY || this.dragState.startY);

      const scale = this.getCanvasScale ? this.getCanvasScale() : 1.0;
      const dx = (clientX - this.dragState.startX) / scale;
      const dy = (clientY - this.dragState.startY) / scale;
      const finalX = this.dragState.initialLeft + dx;
      const finalY = this.dragState.initialTop + dy;

      let targetElement = document.elementFromPoint ? document.elementFromPoint(clientX, clientY)?.closest('.mindmap-node') : null;
      let targetId = targetElement ? targetElement.dataset.nodeId : null;

      if (targetId && (targetId === this.dragState.dragNodeId || this.isDescendantOf(this.dragState.dragNodeId, targetId))) {
        targetElement = null;
        targetId = null;
      }
      
      const removeDraggingClass = (nId) => {
        const el = this.nodeElements.get(nId);
        if (el) el.classList.remove('dragging', 'drag-root', 'drag-subtree');
        const n = this.findNodeInTree(this.currentRootNode, nId);
        if (n && !n.collapsed && n.children) {
          n.children.forEach(c => removeDraggingClass(c.id));
        }
      };
      removeDraggingClass(this.dragState.dragNodeId);
      
      if (this.dragState.currentDropTargetEl) {
        this.dragState.currentDropTargetEl.classList.remove('drop-target');
        this.dragState.currentDropTargetEl = null;
      }
      this.nodeElements.forEach(el => el.classList.remove('drop-target'));

      // If dropped onto a target, record current visual drop coordinates in lastRenderedPositions
      // so layout transition animates connectors starting from the exact drop position!
      if (targetId && targetId !== this.dragState.dragNodeId) {
        const updateLastPos = (nId, curX, curY) => {
          const el = this.nodeElements.get(nId);
          const w = el ? (parseFloat(el.style.width) || el.offsetWidth || 100) : 100;
          const h = el ? (parseFloat(el.style.height) || el.offsetHeight || 40) : 40;
          this.lastRenderedPositions.set(nId, { x: curX, y: curY, width: w, height: h });
          const n = this.findNodeInTree(this.currentRootNode, nId);
          if (n && !n.collapsed && n.children) {
            n.children.forEach(c => {
              const childEl = this.nodeElements.get(c.id);
              if (childEl) {
                const cx = parseFloat(childEl.style.left) || 0;
                const cy = parseFloat(childEl.style.top) || 0;
                updateLastPos(c.id, cx, cy);
              }
            });
          }
        };
        updateLastPos(this.dragState.dragNodeId, finalX, finalY);
      }

      if (this.onNodeDragEnd) {
        this.onNodeDragEnd(
          this.dragState.dragNodeId,
          targetId !== this.dragState.dragNodeId ? targetId : null,
          { canvasX: finalX, canvasY: finalY, x: clientX, y: clientY }
        );
      }
      
      this.dragState.isDragging = false;
    }
    this.dragState.dragNodeId = null;
  }

  extractTextWithNewlines(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);

    // Remove KaTeX rendered DOM markup to avoid dumping MathML text into raw string
    clone.querySelectorAll('.katex-rendered').forEach(katexEl => {
      const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]');
      if (annotation) {
        katexEl.replaceWith(document.createTextNode(annotation.textContent));
      }
    });

    // Replace <br> tags with \n text nodes
    clone.querySelectorAll('br').forEach(br => {
      br.replaceWith(document.createTextNode('\n'));
    });

    // Replace <div> and <p> blocks with \n + text
    clone.querySelectorAll('div, p').forEach(block => {
      block.prepend(document.createTextNode('\n'));
    });

    let str = clone.textContent || clone.innerText || '';
    str = str.replace(/\r\n/g, '\n');
    if (str.startsWith('\n') && element.innerHTML && !element.innerHTML.trim().startsWith('<br') && !element.innerHTML.trim().startsWith('<div') && !element.innerHTML.trim().startsWith('<p')) {
      str = str.substring(1);
    }
    return str;
  }

  startEditing(nodeId) {
    const element = this.nodeElements.get(nodeId);
    if (!element) return;
    
    const textSpan = element.querySelector('.node-text');
    if (!textSpan) return;

    this.editingNodeId = nodeId;
    const node = this.findNodeInTree(this.currentRootNode, nodeId);
    if (node) {
      this.editingInitialText = node.text || '';
      textSpan.setAttribute('data-raw', this.editingInitialText);
      const safeHtml = (this.editingInitialText || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      textSpan.innerHTML = safeHtml;
    }

    textSpan.contentEditable = 'true';
    element.classList.add('editing');
    textSpan.focus();

    // Select all content inside textSpan for easy typing
    try {
      const range = document.createRange();
      range.selectNodeContents(textSpan);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (err) {}

    const cleanupListeners = () => {
      textSpan.removeEventListener('keydown', handleKeyDown);
      textSpan.removeEventListener('input', handleInput);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        handleSmartTab(textSpan, e);
      } else if (e.key === ' ') {
        handleSmartSpace(textSpan, e);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        cleanupListeners();
        this.stopEditing(nodeId, true);
      } else if (e.key === 'Enter' && e.shiftKey) {
        // Shift+Enter creates a new line in canvas node: apply smart enter!
        handleSmartEnter(textSpan, e);
      } else if (e.key === 'Backspace') {
        handleSmartBackspace(textSpan, e);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cleanupListeners();
        this.stopEditing(nodeId, false);
      }
    };

    const handleInput = (e) => {
      handleSmartInput(textSpan, e);
    };

    textSpan.addEventListener('keydown', handleKeyDown);
    textSpan.addEventListener('input', handleInput);
  }

  stopEditing(nodeId, save = true) {
    if (!nodeId) nodeId = this.editingNodeId;
    if (!nodeId) return;

    const element = this.nodeElements.get(nodeId);
    if (element) {
      element.classList.remove('editing');
      const textSpan = element.querySelector('.node-text');
      if (textSpan) {
        textSpan.contentEditable = 'false';
        if (save && this.onNodeTextChange) {
          const rawAttr = textSpan.getAttribute('data-raw');
          let cleanText = this.extractTextWithNewlines(textSpan);

          // If contenteditable was closed without typing changes
          if (rawAttr && (cleanText === rawAttr || cleanText.replace(/[\s\\]+/g, '') === rawAttr.replace(/[\s\\]+/g, ''))) {
            cleanText = rawAttr;
          }

          this.onNodeTextChange(nodeId, cleanText);
        }
      }
    }
    this.editingNodeId = null;
    this.editingInitialText = null;
  }

  renderKaTeX(rawFormula, isDisplay) {
    if (!rawFormula) return '';
    
    // Clean up HTML tags & unescape entities for valid TeX parsing
    let formula = String(rawFormula)
      .replace(/<br\s*\/?>/gi, '\\\\ ')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    if (!this.katexCache) this.katexCache = new Map();
    const cacheKey = `${isDisplay ? 'D' : 'I'}:${formula}`;
    if (this.katexCache.has(cacheKey)) {
      return this.katexCache.get(cacheKey);
    }

    try {
      const html = window.katex.renderToString(formula.trim(), { displayMode: isDisplay, throwOnError: false });
      const rendered = isDisplay ? `<div class="katex-rendered katex-block">${html}</div>` : `<span class="katex-rendered">${html}</span>`;
      if (this.katexCache.size > 2000) {
        const firstKey = this.katexCache.keys().next().value;
        this.katexCache.delete(firstKey);
      }
      this.katexCache.set(cacheKey, rendered);
      return rendered;
    } catch (e) {
      return isDisplay ? `<div class="katex-rendered katex-block" style="color:red">Lỗi LaTeX: ${e.message}</div>` : `<span class="katex-rendered" style="color:red">Lỗi LaTeX</span>`;
    }
  }

  looksLikeInlineMath(formula) {
    if (!formula || typeof formula !== 'string') return false;
    const trimmed = formula.trim();
    if (!trimmed) return false;
    // Markdown/LaTeX standard: $ formula $ with leading/trailing spaces is plain text, not inline math
    if (formula.startsWith(' ') || formula.endsWith(' ')) return false;
    // LaTeX command or syntax chars (\, ^, _, {, })
    if (/[\\^_{}]/.test(trimmed)) return true;
    // Vietnamese or non-ascii accented language letters
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(trimmed)) return false;
    // Multiple natural language words (2+ letters followed by space and another word)
    if (/[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/.test(trimmed)) return false;
    // Math expression: letters, digits, operators, brackets, relations, punctuation, whitespace
    return /^[a-zA-Z0-9+\-*/=().,<>\s]+$/.test(trimmed);
  }

  containsRealMath(rawText) {
    if (!rawText) return false;
    const text = String(rawText);
    if (text.includes('$$') || text.includes('\\[') || text.includes('\\(') || text.includes('\\begin{')) {
      return true;
    }
    if (text.trim().startsWith('\\')) {
      return true;
    }
    const mathRegex = /(?<!\\)\$([^$\n]+?)\$/g;
    let match;
    while ((match = mathRegex.exec(text)) !== null) {
      if (this.looksLikeInlineMath(match[1])) {
        return true;
      }
    }
    return false;
  }

  formatNodeText(rawText) {
    if (!rawText) return '';
    let text = String(rawText);

    const escapeText = (str) => {
      if (!str) return '';
      const tagRegex = /(<\/?(?:span|div|p|b|strong|i|em|u|s|strike|font|img|br|ul|ol|li)\b[^>]*>)/gi;
      const parts = str.split(tagRegex);
      return parts.map((part, idx) => {
        if (idx % 2 === 1) {
          return part;
        }
        return part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
      }).join('');
    };

    if (!window.katex) {
      return escapeText(text);
    }

    // 1. Fallback for raw single LaTeX command
    if (!text.includes('$$') && !text.includes('\\[') && !text.includes('\\(') && !text.includes('$') && text.trim().startsWith('\\')) {
      return this.renderKaTeX(text.trim(), true);
    }

    // 2. Fast regex pattern matching for block and inline KaTeX math
    const mathRegex = /(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\2\}|(?<!\\)\$[^$\n]+?\$)/g;

    let lastIdx = 0;
    let result = '';
    let match;

    while ((match = mathRegex.exec(text)) !== null) {
      const preceding = text.substring(lastIdx, match.index);
      result += escapeText(preceding);

      const fullMatch = match[0];
      let formula = '';
      let isDisplay = false;

      if (fullMatch.startsWith('\\[') && fullMatch.endsWith('\\]')) {
        formula = fullMatch.slice(2, -2);
        isDisplay = true;
      } else if (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) {
        formula = fullMatch.slice(2, -2);
        isDisplay = true;
      } else if (fullMatch.startsWith('\\(') && fullMatch.endsWith('\\)')) {
        formula = fullMatch.slice(2, -2);
        isDisplay = false;
      } else if (fullMatch.startsWith('\\begin{')) {
        formula = fullMatch;
        isDisplay = true;
      } else if (fullMatch.startsWith('$') && fullMatch.endsWith('$')) {
        formula = fullMatch.slice(1, -1);
        isDisplay = false;
        if (!this.looksLikeInlineMath(formula)) {
          // Not real math (e.g. currency "$5 và $10"), keep original text
          result += escapeText(fullMatch);
          lastIdx = mathRegex.lastIndex;
          continue;
        }
      }

      if (formula) {
        result += this.renderKaTeX(formula, isDisplay);
      } else {
        result += escapeText(fullMatch);
      }

      lastIdx = mathRegex.lastIndex;
    }

    const tail = text.substring(lastIdx);
    result += escapeText(tail);

    return result;
  }

  updateSelection(oldSelectedId, newSelectedId) {
    if (oldSelectedId) {
      const oldEl = this.nodeElements.get(oldSelectedId);
      if (oldEl) oldEl.classList.remove('selected');
    }
    if (newSelectedId) {
      const newEl = this.nodeElements.get(newSelectedId);
      if (newEl) newEl.classList.add('selected');
    }
  }

  destroy() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    this.nodeElements.clear();
    this.connectorElements.clear();
    this.nodesContainer.innerHTML = '';
    this.svg.innerHTML = '';
  }
}
