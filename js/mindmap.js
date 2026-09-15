import { generateId, deepClone } from './utils.js';

export class MindMap {
  constructor() {
    this.roots = [];
    this.nodeMap = new Map();
    this.selectedNodeId = null;
    this.listeners = new Map();
    this.globalLineStyle = {
      width: 2,
      opacity: 1,
      dash: 'solid',
      color: null
    };
    this.smartAutoLayout = true;
    this.connections = [];
  }

  get root() {
    return this.roots[0] || null;
  }

  set root(node) {
    if (node) {
      if (!this.roots.includes(node)) {
        this.roots[0] = node;
      }
    } else {
      this.roots = [];
    }
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
        callback(data);
      }
    }
  }

  // ==================== FREE LINE CONNECTIONS ====================

  addConnection(fromId, toId, style = {}) {
    if (!fromId || !toId || fromId === toId) return null;
    const existing = this.connections.find(c => 
      (c.fromId === fromId && c.toId === toId) || 
      (c.fromId === toId && c.toId === fromId)
    );
    if (existing) return existing;

    const connection = {
      id: generateId(),
      fromId,
      toId,
      lineWidth: style.lineWidth || 2,
      lineOpacity: style.lineOpacity !== undefined ? style.lineOpacity : 1.0,
      lineDash: style.lineDash || 'solid',
      lineColor: style.lineColor || null,
      lineArrow: style.lineArrow || 'none',
      lineText: style.lineText || ''
    };
    this.connections.push(connection);
    this.emit('structureChanged', { root: this.root, roots: this.roots, connections: this.connections });
    return connection;
  }

  removeConnection(connectionId) {
    const initialLen = this.connections.length;
    this.connections = this.connections.filter(c => c.id !== connectionId);
    if (this.connections.length !== initialLen) {
      this.emit('structureChanged', { root: this.root, roots: this.roots, connections: this.connections });
      return true;
    }
    return false;
  }

  updateConnection(connectionId, props = {}) {
    const conn = this.connections.find(c => c.id === connectionId);
    if (!conn) return false;
    Object.assign(conn, props);
    this.emit('structureChanged', { root: this.root, roots: this.roots, connections: this.connections });
    return true;
  }

  getConnectionsForNode(nodeId) {
    return this.connections.filter(c => c.fromId === nodeId || c.toId === nodeId);
  }

  createDefault() {
    this.roots = [];
    const root = this.createNode('Central Topic', null, '🧠');
    this.roots.push(root);
    this.nodeMap.set(root.id, root);
    
    this.addChild(root.id, 'Topic 1');
    this.addChild(root.id, 'Topic 2');
    this.addChild(root.id, 'Topic 3');
    
    this.selectNode(root.id);
    this.emit('structureChanged', { root: this.root, roots: this.roots });
    return root;
  }

  createNode(text, color = null, icon = '') {
    const id = generateId();
    return {
      id,
      text,
      children: [],
      color: color || null,
      icon,
      collapsed: false,
      notes: '',
      images: [],
      // Text Formatting
      fontSize: undefined,      // e.g. 14, 16, 18, 20, 24
      highlightColor: null,     // e.g. '#FEF08A', '#BBF7D0', '#FBCFE8', '#BAE6FD', '#FED7AA'
      textColor: null,          // e.g. '#EF4444', '#3B82F6', etc.
      fontWeight: 'normal',     // 'normal' | 'bold'
      fontStyle: 'normal',      // 'normal' | 'italic'
      textDecoration: 'none',   // 'none' | 'underline'
      // Line Styling
      lineWidth: null,          // 1, 2, 3, 5, 8
      lineOpacity: null,        // 0.3, 0.6, 1.0
      lineDash: null,           // 'solid' | 'dashed' | 'dotted'
      lineColor: null,
      lineArrow: false,
      lineText: '',
      x: undefined, y: undefined,
      width: undefined, height: undefined,
      customX: undefined,
      customY: undefined,
      customWidth: undefined,
      customHeight: undefined,
      relativeX: undefined,
      relativeY: undefined
    };
  }

  addCentralTopic(text = 'Central Topic', x = 0, y = 0) {
    const newRoot = this.createNode(text, null, '💡');
    newRoot.customX = x;
    newRoot.customY = y;
    this.roots.push(newRoot);
    this._rebuildNodeMap();
    this.selectNode(newRoot.id);
    this.emit('nodeAdded', { parentId: null, node: newRoot });
    this.emit('structureChanged', { root: this.root, roots: this.roots });
    return newRoot;
  }

  detachNode(nodeId) {
    if (this.isRoot(nodeId)) return false;
    const node = this.findNode(nodeId);
    if (!node) return false;

    const parent = this.getParent(nodeId);
    if (parent) {
      parent.children = parent.children.filter(c => c.id !== nodeId);
    }

    delete node.relativeX;
    delete node.relativeY;
    if (node.x !== undefined) node.customX = node.x;
    if (node.y !== undefined) node.customY = node.y;

    this.roots.push(node);
    this._rebuildNodeMap();
    this.selectNode(node.id);
    this.emit('structureChanged', { root: this.root, roots: this.roots });
    return true;
  }

  addChild(parentId, text = 'New Topic') {
    const parent = this.findNode(parentId);
    if (!parent) return null;
    
    const newNode = this.createNode(text, null);
    parent.children.push(newNode);
    this.nodeMap.set(newNode.id, newNode);
    
    if (parent.collapsed) {
      parent.collapsed = false;
    }
    
    this.emit('nodeAdded', { parentId, node: newNode });
    this.emit('structureChanged', { root: this.root, roots: this.roots });
    return newNode;
  }

  addSibling(nodeId, text = 'New Topic') {
    if (this.isRoot(nodeId)) return null;
    
    const parent = this.getParent(nodeId);
    if (!parent) return null;
    
    const siblingIndex = parent.children.findIndex(c => c.id === nodeId);
    const newNode = this.createNode(text, null);
    
    parent.children.splice(siblingIndex + 1, 0, newNode);
    this.nodeMap.set(newNode.id, newNode);
    
    this.emit('nodeAdded', { parentId: parent.id, node: newNode });
    this.emit('structureChanged', { root: this.root, roots: this.roots });
    return newNode;
  }

  deleteNode(nodeId) {
    const isRoot = this.isRoot(nodeId);
    if (isRoot) {
      if (this.roots.length <= 1) {
        // Reset root contents instead of deleting the only root
        const root = this.findNode(nodeId);
        if (root) {
          root.text = 'Central Topic';
          root.children = [];
          this._rebuildNodeMap();
          this.emit('structureChanged', { root: this.root, roots: this.roots });
          return true;
        }
        return false;
      }
      // Remove root node
      this.roots = this.roots.filter(r => r.id !== nodeId);
      const subtree = this.getSubtree(nodeId);
      const deletedIds = new Set(subtree.map(n => n.id));
      this.connections = this.connections.filter(c => !deletedIds.has(c.fromId) && !deletedIds.has(c.toId));
      for (const n of subtree) {
        this.nodeMap.delete(n.id);
      }
      if (this.selectedNodeId === nodeId) {
        this.selectNode(this.roots[0]?.id || null);
      }
      this.emit('nodeDeleted', { nodeId, parentId: null });
      this.emit('structureChanged', { root: this.root, roots: this.roots, connections: this.connections });
      return true;
    }
    
    const node = this.findNode(nodeId);
    if (!node) return false;
    
    const parent = this.getParent(nodeId);
    if (parent) {
      parent.children = parent.children.filter(c => c.id !== nodeId);
    }
    
    const subtree = this.getSubtree(nodeId);
    const deletedIds = new Set(subtree.map(n => n.id));
    this.connections = this.connections.filter(c => !deletedIds.has(c.fromId) && !deletedIds.has(c.toId));
    for (const n of subtree) {
      this.nodeMap.delete(n.id);
    }
    
    if (this.selectedNodeId === nodeId) {
      this.selectNode(parent ? parent.id : this.root?.id || null);
    }
    
    this.emit('nodeDeleted', { nodeId, parentId: parent ? parent.id : null });
    this.emit('structureChanged', { root: this.root, roots: this.roots });
    return true;
  }

  isRoot(nodeId) {
    return this.roots.some(r => r.id === nodeId);
  }

  moveNode(nodeId, newParentId) {
    if (this.isRoot(nodeId)) return false;
    if (nodeId === newParentId) return false;
    
    const node = this.findNode(nodeId);
    const newParent = this.findNode(newParentId);
    if (!node || !newParent) return false;
    
    let curr = newParent;
    let guard = 0;
    while (curr && guard++ < 100) {
      if (curr.id === nodeId) return false;
      curr = this.getParent(curr.id);
    }
    
    const oldParent = this.getParent(nodeId);
    if (oldParent) {
      oldParent.children = oldParent.children.filter(c => c.id !== nodeId);
    }
    
    newParent.children.push(node);
    if (newParent.collapsed) newParent.collapsed = false;
    
    this.emit('nodeMoved', { nodeId, oldParentId: oldParent ? oldParent.id : null, newParentId });
    this.emit('structureChanged', { root: this.root, roots: this.roots });
    return true;
  }

  updateNode(nodeId, props) {
    const node = this.findNode(nodeId);
    if (!node) return false;
    
    let structureChanged = false;
    for (const [key, value] of Object.entries(props)) {
      if (node[key] !== value) {
        if (value === undefined) {
          delete node[key];
        } else {
          node[key] = value;
        }
        structureChanged = true;
      }
    }

    delete node.measuredWidth;
    delete node.measuredHeight;
    
    this.emit('nodeUpdated', { nodeId, node });
    if (structureChanged) {
      this.emit('structureChanged', { root: this.root, roots: this.roots });
    }
    return true;
  }

  setNodePosition(nodeId, absoluteX, absoluteY, parentAbsoluteX = null, parentAbsoluteY = null) {
    const node = this.findNode(nodeId);
    if (!node) return false;

    if (parentAbsoluteX !== null && parentAbsoluteY !== null && !this.isRoot(node.id)) {
      node.relativeX = Math.round(absoluteX - parentAbsoluteX);
      node.relativeY = Math.round(absoluteY - parentAbsoluteY);
      delete node.customX;
      delete node.customY;
    } else {
      node.customX = Math.round(absoluteX);
      node.customY = Math.round(absoluteY);
      delete node.relativeX;
      delete node.relativeY;
    }

    this.emit('nodeUpdated', { nodeId, node });
    this.emit('structureChanged', { root: this.root, roots: this.roots });
    return true;
  }

  resetPositions(nodeId = null) {
    if (nodeId) {
      const node = this.findNode(nodeId);
      if (node) {
        delete node.customX;
        delete node.customY;
        delete node.relativeX;
        delete node.relativeY;
        delete node.customWidth;
        delete node.customHeight;
        delete node.measuredWidth;
        delete node.measuredHeight;
      }
    } else {
      this.roots.forEach(root => {
        this._traverseTree(root, (node) => {
          delete node.customX;
          delete node.customY;
          delete node.relativeX;
          delete node.relativeY;
          delete node.customWidth;
          delete node.customHeight;
          delete node.measuredWidth;
          delete node.measuredHeight;
        });
      });
    }
    this.emit('structureChanged', { root: this.root, roots: this.roots });
  }

  toggleCollapse(nodeId) {
    const node = this.findNode(nodeId);
    if (node && node.children.length > 0) {
      return this.updateNode(nodeId, { collapsed: !node.collapsed });
    }
    return false;
  }

  findNode(nodeId) {
    return this.nodeMap.get(nodeId) || null;
  }

  getParent(nodeId) {
    if (this.isRoot(nodeId)) return null;
    let foundParent = null;
    this.roots.forEach(root => {
      this._traverseTree(root, (node) => {
        if (node.children.some(c => c.id === nodeId)) {
          foundParent = node;
        }
      });
    });
    return foundParent;
  }

  getSiblings(nodeId) {
    const parent = this.getParent(nodeId);
    if (!parent) return [];
    return parent.children.filter(c => c.id !== nodeId);
  }

  getDepth(nodeId) {
    let depth = 0;
    let curr = this.findNode(nodeId);
    let guard = 0;
    while (curr && !this.isRoot(curr.id) && guard++ < 100) {
      depth++;
      curr = this.getParent(curr.id);
    }
    return depth;
  }

  getNodeCount() {
    return this.nodeMap.size;
  }

  getAllNodes() {
    return Array.from(this.nodeMap.values());
  }

  getSubtree(nodeId) {
    const node = this.findNode(nodeId);
    if (!node) return [];
    const subtree = [];
    this._traverseTree(node, (n) => subtree.push(n));
    return subtree;
  }

  selectNode(nodeId) {
    if (this.selectedNodeId !== nodeId) {
      const oldSelected = this.selectedNodeId;
      this.selectedNodeId = nodeId;
      this.emit('selectionChanged', { nodeId, oldSelectedId: oldSelected });
    }
  }

  getSelectedNode() {
    return this.selectedNodeId ? this.findNode(this.selectedNodeId) : null;
  }

  getFirstChild(nodeId) {
    const node = this.findNode(nodeId);
    return (node && node.children.length > 0) ? node.children[0] : null;
  }

  getLastChild(nodeId) {
    const node = this.findNode(nodeId);
    return (node && node.children.length > 0) ? node.children[node.children.length - 1] : null;
  }

  getPreviousSibling(nodeId) {
    const parent = this.getParent(nodeId);
    if (!parent) return null;
    const index = parent.children.findIndex(c => c.id === nodeId);
    return index > 0 ? parent.children[index - 1] : null;
  }

  getNextSibling(nodeId) {
    const parent = this.getParent(nodeId);
    if (!parent) return null;
    const index = parent.children.findIndex(c => c.id === nodeId);
    return index !== -1 && index < parent.children.length - 1 ? parent.children[index + 1] : null;
  }

  toJSON(dedupeImages = true) {
    if (!this.roots || this.roots.length === 0) return { roots: [] };

    if (!dedupeImages) {
      return {
        roots: deepClone(this.roots),
        connections: deepClone(this.connections || []),
        globalLineStyle: this.globalLineStyle ? { ...this.globalLineStyle } : null,
        smartAutoLayout: this.smartAutoLayout
      };
    }

    // Deduplicate large base64 image strings (> 30KB) across tree into imagePool to prevent V8 512MB string overflow
    const imagePool = {};
    let imgCounter = 0;

    const processNode = (node) => {
      if (!node) return node;
      const copy = { ...node };

      if (Array.isArray(copy.images)) {
        copy.images = copy.images.map(img => {
          const src = typeof img === 'string' ? img : (img ? img.src : null);
          const width = img && img.width ? img.width : 160;
          const height = img && img.height ? img.height : 100;

          if (src && src.length > 30000) {
            let existingKey = Object.keys(imagePool).find(k => imagePool[k] === src);
            if (!existingKey) {
              existingKey = 'img_pool_' + (++imgCounter);
              imagePool[existingKey] = src;
            }
            return { imgRef: existingKey, width, height };
          }
          return img;
        });
      }

      if (Array.isArray(copy.children)) {
        copy.children = copy.children.map(processNode);
      }
      return copy;
    };

    const cleanRoots = this.roots.map(processNode);
    return {
      roots: cleanRoots,
      connections: deepClone(this.connections || []),
      imagePool: Object.keys(imagePool).length > 0 ? imagePool : undefined,
      globalLineStyle: this.globalLineStyle ? { ...this.globalLineStyle } : null,
      smartAutoLayout: this.smartAutoLayout
    };
  }

  fromJSON(json, emitEvent = true) {
    try {
      let data = json;
      let maxParse = 5;
      while (typeof data === 'string' && maxParse-- > 0) {
        data = JSON.parse(data);
      }
      if (!data) return false;

      // Restore imagePool references if present
      if (data.imagePool) {
        const resolveImages = (node) => {
          if (!node) return;
          if (Array.isArray(node.images)) {
            node.images = node.images.map(img => {
              if (img && img.imgRef && data.imagePool[img.imgRef]) {
                return { src: data.imagePool[img.imgRef], width: img.width || 160, height: img.height || 100 };
              }
              return img;
            });
          }
          if (Array.isArray(node.children)) {
            node.children.forEach(resolveImages);
          }
        };
        if (Array.isArray(data.roots)) {
          data.roots.forEach(resolveImages);
        } else if (Array.isArray(data)) {
          data.forEach(resolveImages);
        }
      }

      const normalizeNode = (node) => {
        if (!node || typeof node !== 'object') return null;
        const text = node.text || node.title || node.name || node.label || node.topic || 'Topic';
        const id = node.id || generateId();
        const rawChildren = Array.isArray(node.children) ? node.children : (Array.isArray(node.topics) ? node.topics : (Array.isArray(node.subtopics) ? node.subtopics : []));
        const children = rawChildren.map(normalizeNode).filter(Boolean);
        return {
          ...node,
          id,
          text,
          children
        };
      };

      if (Array.isArray(data.roots)) {
        this.roots = data.roots.map(normalizeNode).filter(Boolean);
        if (data.globalLineStyle) this.globalLineStyle = data.globalLineStyle;
        if (typeof data.smartAutoLayout === 'boolean') this.smartAutoLayout = data.smartAutoLayout;
      } else if (Array.isArray(data)) {
        this.roots = data.map(normalizeNode).filter(Boolean);
      } else if (data.tree) {
        return this.fromJSON(data.tree, emitEvent);
      } else if (data.root) {
        return this.fromJSON(data.root, emitEvent);
      } else if (data.id || data.text || data.title || data.name || data.children || data.topics) {
        const singleRoot = normalizeNode(data);
        this.roots = singleRoot ? [singleRoot] : [];
      } else {
        return false;
      }

      if (this.roots.length === 0) {
        this.createDefault();
      }

      if (Array.isArray(data.connections)) {
        this.connections = deepClone(data.connections);
      } else {
        this.connections = [];
      }

      this._rebuildNodeMap();
      if (!this.selectedNodeId || !this.nodeMap.has(this.selectedNodeId)) {
        this.selectedNodeId = this.roots[0] ? this.roots[0].id : null;
      }

      if (emitEvent) {
        this.emit('structureChanged', { root: this.root, roots: this.roots });
      }
      return true;
    } catch (error) {
      console.error('Failed to load mindmap from JSON:', error);
      return false;
    }
  }

  _smartCloneNode(node) {
    if (!node) return node;
    const copy = {
      id: generateId(),
      text: this._stripKaTeXHTML(node.text || ''),
      color: node.color,
      textColor: node.textColor,
      fontSize: node.fontSize,
      fontFamily: node.fontFamily,
      bold: node.bold,
      italic: node.italic,
      underline: node.underline,
      strikethrough: node.strikethrough,
      align: node.align,
      highlightColor: node.highlightColor,
      icon: node.icon,
      notes: node.notes,
      collapsed: false
    };

    if (node.images) {
      copy.images = node.images;
    } else if (node.image) {
      copy.image = node.image;
    }

    if (node.customWidth) copy.customWidth = node.customWidth;
    if (node.customHeight) copy.customHeight = node.customHeight;

    if (Array.isArray(node.children) && node.children.length > 0) {
      copy.children = node.children.map(child => this._smartCloneNode(child));
    } else {
      copy.children = [];
    }

    return copy;
  }

  copySubtree(nodeId) {
    const node = this.findNode(nodeId);
    if (!node) return null;
    return this._smartCloneNode(node);
  }

  _stripKaTeXHTML(text) {
    if (!text || typeof text !== 'string') return text || '';
    if (!text.includes('katex')) return text;
    return text.replace(/<div class="katex-rendered[^"]*">[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/div>/gi, '$1')
               .replace(/<span class="katex-display">[\s\S]*?<\/span>/gi, '')
               .replace(/<span class="katex">[\s\S]*?<\/span>/gi, '')
               .replace(/<div class="katex-rendered[^"]*">[\s\S]*?<\/div>/gi, '');
  }

  _cleanSubtree(node) {
    if (!node) return node;
    if (typeof node.text === 'string') {
      node.text = this._stripKaTeXHTML(node.text);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(c => this._cleanSubtree(c));
    }
    return node;
  }

  pasteSubtree(parentId, subtreeData) {
    if (!subtreeData) return null;
    const clone = this._smartCloneNode(subtreeData);

    const parent = parentId ? this.findNode(parentId) : null;
    if (parent) {
      if (!Array.isArray(parent.children)) parent.children = [];
      parent.children.push(clone);
      if (parent.collapsed) parent.collapsed = false;
      this._rebuildNodeMap();
      this.emit('nodeAdded', { parentId, node: clone });
    } else {
      // Paste as new Central Topic root
      const origX = subtreeData.customX !== undefined ? subtreeData.customX : (subtreeData.x || 0);
      const origY = subtreeData.customY !== undefined ? subtreeData.customY : (subtreeData.y || 0);
      clone.customX = origX + 60;
      clone.customY = origY + 60;
      this.roots.push(clone);
      this._rebuildNodeMap();
      this.emit('nodeAdded', { parentId: null, node: clone });
    }

    this.emit('structureChanged', { root: this.root, roots: this.roots });
    return clone;
  }

  setGlobalLineStyle(style = {}) {
    this.globalLineStyle = { ...this.globalLineStyle, ...style };
    this.emit('structureChanged', { root: this.root, roots: this.roots });
  }

  _rebuildNodeMap() {
    this.nodeMap.clear();
    this.roots.forEach(root => {
      if (root) {
        this._traverseTree(root, (node) => {
          this.nodeMap.set(node.id, node);
        });
      }
    });
  }

  _traverseTree(node, callback, depth = 0) {
    if (!node) return;
    callback(node, depth);
    if (node.children) {
      for (const child of node.children) {
        this._traverseTree(child, callback, depth + 1);
      }
    }
  }
}

