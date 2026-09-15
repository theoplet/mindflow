/**
 * Exporter class to handle exporting mindmaps to various formats.
 */
/**
 * Word-wrap text to fit within maxWidth using 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} text 
 * @param {number} maxWidth 
 * @returns {string[]} Lines of wrapped text
 */
function wrapTextLines(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split(/\r?\n/);
  const result = [];

  for (const para of paragraphs) {
    if (!para) {
      result.push('');
      continue;
    }

    const words = para.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else if (metrics.width > maxWidth && !currentLine) {
        // Single long word exceeds maxWidth: break by character
        let sub = '';
        for (const ch of word) {
          if (ctx.measureText(sub + ch).width > maxWidth && sub) {
            result.push(sub);
            sub = ch;
          } else {
            sub += ch;
          }
        }
        currentLine = sub;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      result.push(currentLine);
    }
  }

  return result.length > 0 ? result : [''];
}

/**
 * Render the mindmap DOM and SVG onto an offscreen 2D HTMLCanvasElement.
 * @param {Object} options
 * @param {HTMLElement} options.canvasEl - Container of .mindmap-node elements
 * @param {HTMLElement} options.svgEl - Container of .connector-path elements
 * @param {Object} [options.bounds] - { minX, minY, maxX, maxY }
 * @param {string} [options.background] - Background color
 * @param {number} [options.maxDimension=4096] - Maximum width/height allowed
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderMapToCanvas({ canvasEl, svgEl, bounds = null, background = null, maxDimension = 4096 }) {
  if (!canvasEl) {
    throw new Error('renderMapToCanvas: canvasEl is required');
  }

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  // Fallback bounding box if bounds not provided
  let minX = bounds ? bounds.minX : -400;
  let minY = bounds ? bounds.minY : -300;
  let maxX = bounds ? bounds.maxX : 400;
  let maxY = bounds ? bounds.maxY : 300;

  // Auto-calculate bounds from nodes if bounds not supplied or invalid
  const nodeEls = canvasEl.querySelectorAll('.mindmap-node');
  if ((!bounds || minX >= maxX || minY >= maxY) && nodeEls.length > 0) {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (const el of nodeEls) {
      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const w = el.offsetWidth || 140;
      const h = el.offsetHeight || 44;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + w);
      maxY = Math.max(maxY, top + h);
    }
  }
  if (!isFinite(minX)) minX = -400;
  if (!isFinite(minY)) minY = -300;
  if (!isFinite(maxX)) maxX = 400;
  if (!isFinite(maxY)) maxY = 300;

  const padding = 80;
  const rawWidth = Math.max(800, maxX - minX + padding * 2);
  const rawHeight = Math.max(600, maxY - minY + padding * 2);

  // Apply maxDimension scaling
  let scale = 1.0;
  const maxDim = Math.max(rawWidth, rawHeight);
  if (maxDimension && maxDim > maxDimension) {
    scale = maxDimension / maxDim;
  }

  const canvasWidth = Math.max(100, Math.round(rawWidth * scale));
  const canvasHeight = Math.max(100, Math.round(rawHeight * scale));

  const offscreen = document.createElement('canvas');
  offscreen.width = canvasWidth;
  offscreen.height = canvasHeight;
  const ctx = offscreen.getContext('2d');

  // 1. Draw Background
  const bgColor = background || (isDark ? '#0F0F23' : '#F8F9FC');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.scale(scale, scale);

  // Coordinate shift helper
  const toCanvasX = (x) => x - minX + padding;
  const toCanvasY = (y) => y - minY + padding;

  // 2. Draw SVG Connectors
  if (svgEl) {
    const paths = svgEl.querySelectorAll('.connector-path');
    paths.forEach(p => {
      const d = p.getAttribute('d');
      if (d) {
        ctx.save();
        const strokeColor = p.getAttribute('stroke') || (isDark ? '#2D2D5E' : '#CBD5E1');
        const strokeWidth = parseFloat(p.getAttribute('stroke-width')) || 2;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';

        ctx.translate(-minX + padding, -minY + padding);
        try {
          const path2d = new Path2D(d);
          ctx.stroke(path2d);
        } catch (e) {
          // Ignore SVG path parse error
        }
        ctx.restore();
      }
    });
  }

  // 3. Draw DOM Nodes
  for (const el of nodeEls) {
    const rect = el.getBoundingClientRect();
    const left = parseFloat(el.style.left) || 0;
    const top = parseFloat(el.style.top) || 0;
    const width = el.offsetWidth || rect.width || 120;
    const height = el.offsetHeight || rect.height || 40;

    const x = toCanvasX(left);
    const y = toCanvasY(top);
    const isRoot = el.classList.contains('root-node');

    ctx.save();

    // Node Box Shadow / Glow
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    // Node Background Fill
    if (isRoot) {
      const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
      gradient.addColorStop(0, '#6C5CE7');
      gradient.addColorStop(1, '#A855F7');
      ctx.fillStyle = gradient;
    } else if (el.style.backgroundColor && el.style.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.style.backgroundColor;
    } else {
      ctx.fillStyle = isDark ? '#1E1E3F' : '#FFFFFF';
    }

    // Draw Rounded Rect Box
    const radius = 12;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, height, radius);
    } else {
      ctx.rect(x, y, width, height);
    }
    ctx.fill();

    // Node Border
    ctx.shadowColor = 'transparent';
    if (!isRoot) {
      ctx.strokeStyle = isDark ? '#2D2D5E' : '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Left Color Accent Border
      const borderLeft = el.style.borderLeftColor;
      if (borderLeft && borderLeft !== 'transparent') {
        ctx.strokeStyle = borderLeft;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 2, y + radius);
        ctx.lineTo(x + 2, y + height - radius);
        ctx.stroke();
      }
    }

    // Node Images (Multiple)
    const imgEls = el.querySelectorAll('.node-image-item, .node-image');
    const hasImg = imgEls.length > 0;
    let imgAreaHeight = 0;
    if (hasImg) {
      let currX = x + 8;
      let currY = y + 8;
      const count = Math.min(3, imgEls.length);
      const imgW = (width - 16 - (count - 1) * 4) / count;
      const imgH = Math.min(height - 40, 100);
      imgAreaHeight = imgH + 8;

      for (const imgEl of imgEls) {
        if (imgEl.src) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((res) => {
              img.onload = res;
              img.onerror = res;
              img.src = imgEl.src;
            });
            ctx.drawImage(img, currX, currY, imgW, imgH);
            currX += imgW + 4;
          } catch (e) {
            // Draw image fail-safe
          }
        }
      }
    }

    // Fix Bug 2: Top-Left Icon Badge
    const iconBadge = el.querySelector('.node-icon-badge');
    if (iconBadge && iconBadge.textContent && iconBadge.textContent.trim()) {
      const badgeX = x + 2;
      const badgeY = y + 2;
      const badgeRadius = 11;

      ctx.save();
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#1E1E3F' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#6C5CE7';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '12px Inter, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.fillText(iconBadge.textContent.trim(), badgeX, badgeY);
      ctx.restore();
    }

    // Fix Bug 2: Top-Right Notes Badge
    const notesBadge = el.querySelector('.node-notes-badge');
    if (notesBadge) {
      const badgeX = x + width - 2;
      const badgeY = y + 2;
      const badgeRadius = 11;

      ctx.save();
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#1E1E3F' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#6C5CE7';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '11px Inter, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.fillText('📝', badgeX, badgeY);
      ctx.restore();
    }

    // Fix Bug 1: Node Text Wrapping according to node width
    const textSpan = el.querySelector('.node-text');
    ctx.fillStyle = isRoot ? '#FFFFFF' : (isDark ? '#E2E8F0' : '#1E293B');
    ctx.font = isRoot ? 'bold 16px Inter, sans-serif' : '14px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const textX = x + 14;
    const textY = y + (hasImg ? imgAreaHeight + 10 : 12);
    const textMaxWidth = Math.max(40, width - 28);

    const rawContent = textSpan ? (textSpan.innerText || textSpan.textContent || '') : '';
    const wrappedLines = wrapTextLines(ctx, rawContent, textMaxWidth);

    const lineHeight = isRoot ? 22 : 18;
    wrappedLines.forEach((line, idx) => {
      ctx.fillText(line, textX, textY + idx * lineHeight);
    });

    ctx.restore();
  }

  ctx.restore();
  return offscreen;
}

export class Exporter {
  /**
   * Export to PNG image using native 2D Canvas rendering
   * @param {HTMLElement} canvasElement - The canvas transform container.
   * @param {HTMLElement} svgElement - The SVG connectors.
   * @param {string} filename - Output filename.
   * @param {Object} rootNode - Root node of mindmap.
   * @param {Array} layoutData - Computed layout positions.
   * @param {Object} bounds - Bounding box { minX, minY, maxX, maxY }.
   */
  async exportPNG(canvasElement, svgElement, filename = 'mindmap.png', rootNode = null, layoutData = [], bounds = null) {
    try {
      const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
      const offscreen = await renderMapToCanvas({
        canvasEl: canvasElement,
        svgEl: svgElement,
        bounds,
        background: isDark ? '#0F0F23' : '#F8F9FC',
        maxDimension: 4096
      });

      // Output PNG Blob
      offscreen.toBlob((pngBlob) => {
        if (pngBlob) {
          this._downloadBlob(pngBlob, filename);
        } else {
          console.error('PNG generation failed');
        }
      }, 'image/png');

    } catch (error) {
      console.error('PNG export failed:', error);
      throw new Error('Failed to export PNG');
    }
  }

  /**
   * Export to SVG.
   * @param {HTMLElement} canvasElement - The canvas element.
   * @param {HTMLElement} svgElement - The SVG connectors element.
   * @param {string} filename - Output filename.
   */
  async exportSVG(canvasElement, svgElement, filename = 'mindmap.svg', rootNode = null, layoutData = [], bounds = null) {
    try {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const clonedSvg = svgElement.cloneNode(true);

      // Compute bounding box
      const minX = bounds ? bounds.minX : -400;
      const minY = bounds ? bounds.minY : -300;
      const maxX = bounds ? bounds.maxX : 400;
      const maxY = bounds ? bounds.maxY : 300;

      const padding = 60;
      const width = Math.max(600, (maxX - minX) + padding * 2);
      const height = Math.max(400, (maxY - minY) + padding * 2);
      const viewBoxX = minX - padding;
      const viewBoxY = minY - padding;

      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${width} ${height}`);
      clonedSvg.setAttribute('width', `${width}`);
      clonedSvg.setAttribute('height', `${height}`);
      clonedSvg.setAttribute('style', `background: ${isDark ? '#0F0F23' : '#F8F9FC'}; font-family: Inter, sans-serif;`);

      // Remove transparent hit areas from exported SVG to keep it clean
      clonedSvg.querySelectorAll('.connector-hit-area').forEach(el => el.remove());

      // Create group for nodes
      const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      nodesGroup.setAttribute('class', 'mindmap-nodes-layer');

      const nodeEls = canvasElement.querySelectorAll('.mindmap-node');
      nodeEls.forEach(el => {
        const left = parseFloat(el.style.left) || 0;
        const top = parseFloat(el.style.top) || 0;
        const nodeW = el.offsetWidth || 140;
        const nodeH = el.offsetHeight || 44;
        const isRoot = el.classList.contains('root-node');

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'mindmap-node-svg');
        g.setAttribute('transform', `translate(${left}, ${top})`);

        // Node background rect
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', `${nodeW}`);
        rect.setAttribute('height', `${nodeH}`);
        rect.setAttribute('rx', '12');
        rect.setAttribute('ry', '12');
        rect.setAttribute('fill', isRoot ? '#6C5CE7' : (isDark ? '#1E1E3F' : '#FFFFFF'));
        rect.setAttribute('stroke', isRoot ? '#A855F7' : (isDark ? '#2D2D5E' : '#CBD5E1'));
        rect.setAttribute('stroke-width', '1.5');
        g.appendChild(rect);

        // Border left color accent if present
        const borderLeft = el.style.borderLeftColor;
        if (borderLeft && !isRoot) {
          const accent = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          accent.setAttribute('x1', '2');
          accent.setAttribute('y1', '10');
          accent.setAttribute('x2', '2');
          accent.setAttribute('y2', `${nodeH - 10}`);
          accent.setAttribute('stroke', borderLeft);
          accent.setAttribute('stroke-width', '4');
          accent.setAttribute('stroke-linecap', 'round');
          g.appendChild(accent);
        }

        // Node text
        const textSpan = el.querySelector('.node-text');
        const textVal = textSpan ? (textSpan.innerText || textSpan.textContent || '') : '';
        const lines = textVal.split('\n');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('x', '16');
        textEl.setAttribute('y', lines.length > 1 ? '18' : `${nodeH / 2 + 5}`);
        textEl.setAttribute('fill', isRoot ? '#FFFFFF' : (isDark ? '#E2E8F0' : '#1E293B'));
        textEl.setAttribute('font-size', isRoot ? '16' : '14');
        textEl.setAttribute('font-weight', isRoot ? 'bold' : 'normal');

        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', '16');
          if (i > 0) tspan.setAttribute('dy', '18');
          tspan.textContent = line;
          textEl.appendChild(tspan);
        });
        g.appendChild(textEl);

        // Icon badge if present
        const iconBadge = el.querySelector('.node-icon-badge');
        if (iconBadge && iconBadge.textContent) {
          const iconEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          iconEl.setAttribute('x', '-4');
          iconEl.setAttribute('y', '-2');
          iconEl.setAttribute('font-size', '16');
          iconEl.textContent = iconBadge.textContent;
          g.appendChild(iconEl);
        }

        nodesGroup.appendChild(g);
      });

      clonedSvg.appendChild(nodesGroup);

      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(clonedSvg);
      this._downloadFile(svgStr, filename, 'image/svg+xml');
    } catch (error) {
      console.error('SVG export failed:', error);
      throw new Error('Failed to export SVG: ' + error.message);
    }
  }

  /**
   * Export to JSON.
   * @param {Object} treeData - The root node tree data.
   * @param {string} mapName - Name of the map.
   * @param {string} filename - Output filename.
   */
  _stripKaTeXHTML(text) {
    if (!text || typeof text !== 'string') return text || '';
    if (!text.includes('katex')) return text;
    return text.replace(/<div class="katex-rendered[^"]*">[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/div>/gi, '$1')
               .replace(/<span class="katex-display">[\s\S]*?<\/span>/gi, '')
               .replace(/<span class="katex">[\s\S]*?<\/span>/gi, '')
               .replace(/<div class="katex-rendered[^"]*">[\s\S]*?<\/div>/gi, '');
  }

  _cleanTreeForExport(treeData) {
    if (!treeData) return treeData;
    const cleanNode = (node) => {
      if (!node) return node;
      const copy = { ...node };
      if (typeof copy.text === 'string') {
        copy.text = this._stripKaTeXHTML(copy.text);
      }
      if (Array.isArray(copy.children)) {
        copy.children = copy.children.map(cleanNode);
      }
      return copy;
    };

    if (Array.isArray(treeData.roots)) {
      return {
        ...treeData,
        roots: treeData.roots.map(cleanNode)
      };
    }
    return cleanNode(treeData);
  }

  async exportCompressed(treeData, mapName, filename = 'mindmap.mindflow') {
    try {
      const cleanTree = this._cleanTreeForExport(treeData);
      const data = {
        version: '1.0',
        name: mapName,
        exportedAt: new Date().toISOString(),
        tree: cleanTree
      };
      const jsonStr = JSON.stringify(data);
      const safeName = (filename || `${mapName}.mindflow`).replace(/[/\\?%*:|"<>]/g, '_');
      const finalFilename = safeName.endsWith('.mindflow') ? safeName : `${safeName}.mindflow`;

      if (typeof CompressionStream !== 'undefined') {
        try {
          const byteArray = new TextEncoder().encode(jsonStr);
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(byteArray);
              controller.close();
            }
          });
          const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
          const blob = await new Response(compressedStream).blob();
          this._downloadBlob(blob, finalFilename);
          return;
        } catch (csErr) {
          console.warn('CompressionStream failed, falling back to blob export:', csErr);
        }
      }

      // Universal Fallback if CompressionStream is unsupported or fails
      const blob = new Blob([jsonStr], { type: 'application/octet-stream' });
      this._downloadBlob(blob, finalFilename);
    } catch (error) {
      console.error('Compressed export failed:', error);
      throw new Error('Failed to export compressed file: ' + error.message);
    }
  }

  exportJSON(treeData, mapName, filename = 'mindmap.json') {
    try {
      const cleanTree = this._cleanTreeForExport(treeData);
      const data = {
        version: '1.0',
        name: mapName,
        exportedAt: new Date().toISOString(),
        tree: cleanTree
      };
      const jsonStr = JSON.stringify(data, null, 2);
      this._downloadFile(jsonStr, filename, 'application/json');
    } catch (error) {
      console.error('JSON export failed:', error);
      throw new Error('Failed to export JSON');
    }
  }

  /**
   * Export to Markdown.
   * @param {Object} rootNode - The root node of the tree.
   * @param {string} filename - Output filename.
   */
  exportMarkdown(rootNodeOrRoots, filename = 'mindmap.md') {
    try {
      const mdString = this._treeToMarkdown(rootNodeOrRoots);
      this._downloadFile(mdString, filename, 'text/markdown');
    } catch (error) {
      console.error('Markdown export failed:', error);
      throw new Error('Failed to export Markdown');
    }
  }

  /**
   * Helper: convert tree or array of root nodes to markdown string.
   * @param {Object|Array} nodeOrRoots - Node or Array of root nodes to convert.
   * @param {number} depth - Current depth.
   * @returns {string} Markdown string.
   * @private
   */
  _treeToMarkdown(nodeOrRoots, depth = 0) {
    if (!nodeOrRoots) return '';
    if (Array.isArray(nodeOrRoots)) {
      return nodeOrRoots.map(r => this._treeToMarkdown(r, depth)).filter(Boolean).join('\n---\n\n');
    }
    const node = nodeOrRoots;
    let result = '';
    
    const iconStr = node.icon ? `${node.icon} ` : '';
    const textStr = node.text || 'Untitled';
    
    if (depth === 0) {
      result += `# ${iconStr}${textStr}\n\n`;
    } else if (depth === 1) {
      result += `## ${iconStr}${textStr}\n\n`;
    } else if (depth === 2) {
      result += `### ${iconStr}${textStr}\n\n`;
    } else {
      const indent = '  '.repeat(depth - 3);
      result += `${indent}- ${iconStr}${textStr}\n`;
    }

    if (node.notes) {
      const notesIndent = depth > 2 ? '  '.repeat(depth - 3) + '  ' : '';
      const notesLines = node.notes.split('\n').map(line => `${notesIndent}> ${line}`).join('\n');
      result += `${notesLines}\n\n`;
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        result += this._treeToMarkdown(child, depth + 1);
      }
    }
    
    return result;
  }

  /**
   * Helper: trigger file download.
   * @param {string} content - File content.
   * @param {string} filename - Output filename.
   * @param {string} mimeType - MIME type.
   * @private
   */
  _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    this._downloadBlob(blob, filename);
  }

  /**
   * Helper: trigger blob download.
   * @param {Blob} blob - The blob to download.
   * @param {string} filename - Output filename.
   * @private
   */
  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
