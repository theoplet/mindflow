export class Layout {
  constructor(options = {}) {
    this.horizontalGap = options.horizontalGap || 80;
    this.verticalGap = options.verticalGap || 16;
    this.rootPadding = options.rootPadding || 60;
  }

  computeLayout(rootInput) {
    if (!rootInput) return { nodes: new Map(), bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };

    const roots = Array.isArray(rootInput) ? rootInput : [rootInput];
    if (roots.length === 0) return { nodes: new Map(), bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };

    const allNodesMap = new Map();

    roots.forEach((rootNode, index) => {
      const nodeMap = new Map();

      // 1. Measure nodes
      const measure = (node, depth = 0) => {
        const size = this.estimateNodeSize(node, depth === 0);
        nodeMap.set(node.id, { x: 0, y: 0, width: size.width, height: size.height, node: node });
        
        if (!node.collapsed && node.children) {
          node.children.forEach(child => measure(child, depth + 1));
        }
      };
      measure(rootNode);

      // 2. Separate root's children
      const visibleChildren = rootNode.collapsed ? [] : (rootNode.children || []);
      const { left, right } = this.balanceChildren(visibleChildren, nodeMap);

      const rootData = nodeMap.get(rootNode.id);
      
      // Default root position (top-left)
      const defaultRootX = index * 450;
      const defaultRootY = 0;
      rootData.x = rootNode.customX !== undefined ? rootNode.customX : defaultRootX;
      rootData.y = rootNode.customY !== undefined ? rootNode.customY : defaultRootY;

      // 3 & 4. Layout children relative to root top-left
      if (right.length > 0) {
        const rightTotalHeight = right.reduce((sum, child) => sum + this.getSubtreeHeight(child, nodeMap) + this.verticalGap, -this.verticalGap);
        let currentY = (rootData.y + rootData.height / 2) - rightTotalHeight / 2;
        right.forEach(child => {
          const height = this.getSubtreeHeight(child, nodeMap);
          this.layoutSubtree(child, 'right', rootData.x + rootData.width + this.rootPadding, currentY + height / 2, nodeMap);
          currentY += height + this.verticalGap;
        });
      }

      if (left.length > 0) {
        const leftTotalHeight = left.reduce((sum, child) => sum + this.getSubtreeHeight(child, nodeMap) + this.verticalGap, -this.verticalGap);
        let currentY = (rootData.y + rootData.height / 2) - leftTotalHeight / 2;
        left.forEach(child => {
          const height = this.getSubtreeHeight(child, nodeMap);
          this.layoutSubtree(child, 'left', rootData.x - this.rootPadding, currentY + height / 2, nodeMap);
          currentY += height + this.verticalGap;
        });
      }

      // 6. Post-process custom & relative position overrides for subtrees
      const applyCustomPositions = (node, parentData = null, deltaX = 0, deltaY = 0) => {
        const data = nodeMap.get(node.id);
        if (!data) return;

        let currentDeltaX = deltaX;
        let currentDeltaY = deltaY;

        if (node.relativeX !== undefined && node.relativeY !== undefined && parentData) {
          const targetX = parentData.x + node.relativeX;
          const targetY = parentData.y + node.relativeY;
          currentDeltaX = targetX - data.x;
          currentDeltaY = targetY - data.y;
        } else if (node.customX !== undefined && node.customY !== undefined && node.id !== rootNode.id) {
          currentDeltaX = node.customX - data.x;
          currentDeltaY = node.customY - data.y;
        }

        data.x += currentDeltaX;
        data.y += currentDeltaY;

        if (!node.collapsed && node.children) {
          node.children.forEach(child => applyCustomPositions(child, data, currentDeltaX, currentDeltaY));
        }
      };
      applyCustomPositions(rootNode);

      // Merge into allNodesMap
      nodeMap.forEach((val, key) => allNodesMap.set(key, val));
    });

    // Calculate overall bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allNodesMap.forEach(data => {
      minX = Math.min(minX, data.x);
      maxX = Math.max(maxX, data.x + data.width);
      minY = Math.min(minY, data.y);
      maxY = Math.max(maxY, data.y + data.height);
    });

    if (minX === Infinity) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

    return { nodes: allNodesMap, bounds: { minX, minY, maxX, maxY } };
  }

  estimateNodeSize(node, isRoot = false) {
    if (node.customWidth && node.customHeight) {
      return { width: node.customWidth, height: node.customHeight };
    }
    if (node.measuredWidth && node.measuredHeight) {
      return { width: node.measuredWidth, height: node.measuredHeight };
    }

    const fontSize = node.fontSize || (isRoot ? 18 : 14);
    const charWidth = fontSize * 0.58;
    const paddingX = isRoot ? 48 : 28;
    const paddingY = isRoot ? 24 : 16;
    
    // Strip HTML markup tags if any, but preserve text inside <...> if not valid HTML tags
    let rawText = node.text || '';
    if (rawText.includes('katex-rendered')) {
      rawText = rawText.replace(/<[^>]*>/g, '');
    }
    const textLen = Math.max(1, rawText.length);

    const textStr = node.text || '';
    const hasMath = textStr.includes('\\') || textStr.includes('$');
    const isComplexMath = hasMath && (textStr.includes('\\begin') || textStr.includes('\\frac') || textStr.includes('\\int') || textStr.includes('\\sum') || textStr.includes('\\matrix') || textStr.includes('pmatrix') || textStr.includes('\\partial') || textStr.includes('\\lim'));

    // Target max width for comfortable line wrapping
    let targetMaxWidth = isRoot ? 440 : 340;
    if (isComplexMath) {
      targetMaxWidth = 650;
    } else if (hasMath) {
      targetMaxWidth = 480;
    }

    let width = Math.max(100, Math.min(targetMaxWidth, textLen * charWidth + paddingX * 2));
    if (hasMath) {
      width = Math.max(380, width);
    }
    if (node.icon) width += 28;

    const availableTextWidth = Math.max(60, width - paddingX * 2);
    
    // Count explicit linebreaks (<br>, \n, <p>)
    const explicitLines = (textStr.match(/<br\s*\/?>|\n|<\/p>/gi) || []).length;
    const wrapLines = Math.ceil((textLen * charWidth) / availableTextWidth) || 1;
    const totalLines = Math.max(wrapLines, explicitLines + 1);

    let height = totalLines * fontSize * 1.6 + paddingY * 2;

    if (isComplexMath) {
      height = Math.max(height, 140);
    } else if (hasMath) {
      height = Math.max(height, 80);
    } else {
      height = Math.max(height, isRoot ? 64 : 48);
    }

    const imagesList = node.images || (node.image ? [{ src: node.image, width: 160, height: 100 }] : []);
    if (imagesList.length > 0) {
      const imgRows = Math.ceil(imagesList.length / 3);
      const rowH = 115;
      height += imgRows * (rowH + 8);
      width = Math.max(width, imagesList.length >= 3 ? 460 : imagesList.length * 150 + paddingX * 2);
    }

    if (node.customWidth) width = node.customWidth;
    if (node.customHeight) height = node.customHeight;

    return { width: Math.ceil(width), height: Math.ceil(height) };
  }

  layoutSubtree(node, direction, startX, startY, nodeMap) {
    const data = nodeMap.get(node.id);
    data.x = direction === 'right' ? startX : startX - data.width;
    data.y = startY - data.height / 2;

    if (!node.collapsed && node.children && node.children.length > 0) {
      const childrenHeight = node.children.reduce((sum, child) => sum + this.getSubtreeHeight(child, nodeMap) + this.verticalGap, -this.verticalGap);
      let currentY = startY - childrenHeight / 2;
      
      const childStartX = direction === 'right' 
        ? data.x + data.width + this.horizontalGap 
        : data.x - this.horizontalGap;

      node.children.forEach(child => {
        const height = this.getSubtreeHeight(child, nodeMap);
        this.layoutSubtree(child, direction, childStartX, currentY + height / 2, nodeMap);
        currentY += height + this.verticalGap;
      });
    }
  }

  getSubtreeHeight(node, nodeMap) {
    const data = nodeMap.get(node.id);
    if (!data) return 0;
    
    if (node.collapsed || !node.children || node.children.length === 0) {
      return data.height;
    }
    
    const childrenHeight = node.children.reduce((sum, child) => sum + this.getSubtreeHeight(child, nodeMap), 0);
    const gapsHeight = (node.children.length - 1) * this.verticalGap;
    
    return Math.max(data.height, childrenHeight + gapsHeight);
  }

  balanceChildren(children, nodeMap) {
    const left = [];
    const right = [];
    
    if (!children || children.length === 0) return { left, right };
    
    children.forEach(child => {
      if (child.side === 'left') {
        left.push(child);
      } else {
        right.push(child);
      }
    });
    
    return { left, right };
  }
}

