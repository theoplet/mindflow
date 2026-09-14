/**
 * Importer class to handle importing mindmaps from various file formats (.mindflow, .json, .md, .txt, .gz).
 */
export class Importer {
  /**
   * Helper to generate a basic UUID.
   * @returns {string} UUID.
   */
  _generateId() {
    return 'id-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
  }

  /**
   * Clean rendered KaTeX HTML while safely extracting the raw LaTeX formula.
   * @param {string} text 
   * @returns {string}
   */
  _stripKaTeXHTML(text) {
    if (!text || typeof text !== 'string') return text || '';
    if (!text.includes('katex')) return text;

    try {
      // 1. Extract raw LaTeX math formulas from <annotation encoding="application/x-tex"> if present
      let cleaned = text.replace(/<div class="katex-rendered[^"]*">[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/div>/gi, (match, formula) => {
        return `\\[ ${formula.trim()} \\]`;
      });

      cleaned = cleaned.replace(/<span class="katex">[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/span>/gi, (match, formula) => {
        return `\\[ ${formula.trim()} \\]`;
      });

      // 2. Remove any remaining raw KaTeX HTML wrappers without destroying inner text
      cleaned = cleaned.replace(/<span class="katex-html"[^>]*>[\s\S]*?<\/span>/gi, '')
                       .replace(/<span class="katex-mathml"[^>]*>[\s\S]*?<\/span>/gi, '')
                       .replace(/<div class="katex-rendered[^"]*">/gi, '')
                       .replace(/<\/div>/gi, '');

      return cleaned;
    } catch (e) {
      console.warn('Error sanitizing KaTeX HTML:', e);
      return text;
    }
  }

  /**
   * Normalize and sanitize tree data structure for any mindmap format.
   * @param {Object|Array} treeData 
   * @returns {Object}
   */
  _cleanTreeData(treeData) {
    if (!treeData) return treeData;

    const cleanNode = (node) => {
      if (!node || typeof node !== 'object') return null;

      // Normalize text / title / label
      let text = node.text || node.title || node.name || node.label || node.topic || 'Topic';
      if (typeof text === 'string') {
        text = this._stripKaTeXHTML(text);
      }

      // Normalize children / topics / subtopics
      let rawChildren = [];
      if (Array.isArray(node.children)) {
        rawChildren = node.children;
      } else if (Array.isArray(node.topics)) {
        rawChildren = node.topics;
      } else if (Array.isArray(node.subtopics)) {
        rawChildren = node.subtopics;
      } else if (Array.isArray(node.nodes)) {
        rawChildren = node.nodes;
      }

      const children = rawChildren.map(cleanNode).filter(Boolean);

      // Normalize images
      let images = undefined;
      if (Array.isArray(node.images)) {
        images = node.images;
      } else if (node.image) {
        images = typeof node.image === 'string' ? [{ src: node.image, width: 160, height: 100 }] : [node.image];
      }

      return {
        ...node,
        text,
        children,
        images: images && images.length > 0 ? images : undefined
      };
    };

    if (Array.isArray(treeData)) {
      return {
        roots: treeData.map(cleanNode).filter(Boolean)
      };
    }

    if (Array.isArray(treeData.roots)) {
      return {
        ...treeData,
        roots: treeData.roots.map(cleanNode).filter(Boolean)
      };
    }

    if (treeData.tree) {
      return this._cleanTreeData(treeData.tree);
    }

    if (treeData.root) {
      return this._cleanTreeData(treeData.root);
    }

    const cleaned = cleanNode(treeData);
    return {
      roots: cleaned ? [cleaned] : []
    };
  }

  /**
   * Regenerate unique IDs across all nodes in the map.
   * @param {Object} node 
   */
  _regenerateIds(node) {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(root => this._regenerateIds(root));
      return;
    }

    if (Array.isArray(node.roots)) {
      node.roots.forEach(root => this._regenerateIds(root));
      return;
    }

    node.id = this._generateId();
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => this._regenerateIds(child));
    }
  }

  /**
   * Async JSON parser with progress updates.
   * @param {string|Object} jsonString 
   * @param {Function} onProgress 
   * @returns {Promise<Object>}
   */
  async importJSONAsync(jsonString, onProgress) {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          if (onProgress) onProgress(20, 'Đang giải mã chuỗi dữ liệu JSON...');
          await new Promise(r => setTimeout(r, 20));

          let parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
          if (!parsed) {
            throw new Error('Dữ liệu JSON rỗng hoặc không hợp lệ.');
          }

          let treeData = null;
          let name = 'Imported Map';

          if (parsed.name) name = parsed.name;
          else if (parsed.title) name = parsed.title;

          if (parsed.tree) {
            treeData = parsed.tree;
          } else if (Array.isArray(parsed.roots)) {
            treeData = parsed;
          } else if (Array.isArray(parsed)) {
            treeData = { roots: parsed };
          } else if (parsed.root) {
            treeData = parsed.root;
          } else if (parsed.id || parsed.text || parsed.title || parsed.children || parsed.topics) {
            treeData = parsed;
          } else {
            throw new Error('Định dạng JSON không hợp lệ: Không tìm thấy cấu trúc các nút sơ đồ.');
          }

          if (onProgress) onProgress(55, 'Đang tối ưu & chuẩn hóa cấu trúc sơ đồ...');
          await new Promise(r => setTimeout(r, 20));

          treeData = this._cleanTreeData(treeData);

          if (onProgress) onProgress(80, 'Đang tạo lại mã định danh ID sơ đồ...');
          await new Promise(r => setTimeout(r, 20));

          this._regenerateIds(treeData);

          // Extract title from root node if name is default
          if ((!name || name === 'Imported Map' || name === 'Untitled Map') && treeData.roots && treeData.roots[0] && treeData.roots[0].text) {
            name = treeData.roots[0].text.replace(/<[^>]*>/g, '').trim().substring(0, 40) || name;
          }

          if (onProgress) onProgress(100, 'Hoàn tất giải nén & chuẩn bị nạp sơ đồ!');
          resolve({ tree: treeData, name, format: 'json' });
        } catch (error) {
          console.error('Failed to import JSON async:', error);
          reject(new Error(`Nhập file JSON thất bại: ${error.message}`));
        }
      }, 10);
    });
  }

  /**
   * Synchronous JSON parser.
   * @param {string|Object} jsonString 
   * @returns {Object}
   */
  importJSON(jsonString) {
    try {
      let parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      if (!parsed) throw new Error('Empty JSON content');

      let treeData = null;
      let name = parsed.name || parsed.title || 'Imported Map';

      if (parsed.tree) {
        treeData = parsed.tree;
      } else if (Array.isArray(parsed.roots)) {
        treeData = parsed;
      } else if (Array.isArray(parsed)) {
        treeData = { roots: parsed };
      } else if (parsed.root) {
        treeData = parsed.root;
      } else if (parsed.id || parsed.text || parsed.title || parsed.children || parsed.topics) {
        treeData = parsed;
      } else {
        throw new Error('Invalid JSON format: missing mindmap tree structure.');
      }

      treeData = this._cleanTreeData(treeData);
      this._regenerateIds(treeData);

      if ((!name || name === 'Imported Map' || name === 'Untitled Map') && treeData.roots && treeData.roots[0] && treeData.roots[0].text) {
        name = treeData.roots[0].text.replace(/<[^>]*>/g, '').trim().substring(0, 40) || name;
      }

      return { tree: treeData, name, format: 'json' };
    } catch (error) {
      console.error('Failed to import JSON:', error);
      throw new Error(`Nhập file JSON thất bại: ${error.message}`);
    }
  }

  /**
   * Import from Markdown / Text outline string.
   * Supports headers (#, ##, ###), lists (-, *, +, 1.), indentation with tabs or spaces.
   * @param {string} mdString - The Markdown string content.
   * @returns {Object} Extracted data: { tree, name }.
   */
  importMarkdown(mdString) {
    try {
      if (!mdString || typeof mdString !== 'string') {
        throw new Error('Nội dung Markdown rỗng.');
      }

      const lines = mdString.split(/\r?\n/);
      let mapTitle = 'Imported Markdown';
      let roots = [];
      let currentPath = [];

      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        if (!rawLine.trim()) continue;

        let level = -1;
        let text = '';
        let notes = '';

        // 1. Heading Match: # H1, ## H2, ### H3, ...
        const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
          level = headingMatch[1].length - 1; // # is 0 (Root), ## is 1
          text = headingMatch[2].trim();
        } else {
          // 2. List Item Match: - item, * item, + item, 1. item, 1) item
          const listMatch = rawLine.match(/^(\s*)(?:[-*+]|\d+[\.\)])\s+(.*)/);
          if (listMatch) {
            const indentStr = listMatch[1];
            // Compute indent level: 1 tab = 1 level, 2-4 spaces = 1 level
            let indentLevel = 0;
            for (let char of indentStr) {
              if (char === '\t') indentLevel += 1;
              else indentLevel += 0.5;
            }
            level = Math.max(1, Math.floor(indentLevel) + 1);
            text = listMatch[2].trim();
          } else {
            // 3. Plain indented text
            const indentMatch = rawLine.match(/^(\s+)(.*)/);
            if (indentMatch) {
              const indentStr = indentMatch[1];
              let indentLevel = 0;
              for (let char of indentStr) {
                if (char === '\t') indentLevel += 1;
                else indentLevel += 0.5;
              }
              level = Math.max(1, Math.floor(indentLevel) + 1);
              text = indentMatch[2].trim();
            } else {
              // Level 0 unindented text line
              level = 0;
              text = rawLine.trim();
            }
          }
        }

        if (!text) continue;

        const node = {
          id: this._generateId(),
          text: text,
          children: []
        };

        if (level === 0) {
          roots.push(node);
          currentPath = [node];
          if (roots.length === 1) {
            mapTitle = text.replace(/<[^>]*>/g, '').trim().substring(0, 40) || mapTitle;
          }
        } else {
          // If no root exists yet, create one
          if (roots.length === 0) {
            const rootNode = {
              id: this._generateId(),
              text: 'Central Topic',
              children: []
            };
            roots.push(rootNode);
            currentPath = [rootNode];
          }

          // Adjust current path stack to parent level
          while (currentPath.length > level && currentPath.length > 1) {
            currentPath.pop();
          }

          const parent = currentPath[currentPath.length - 1];
          if (!parent.children) parent.children = [];
          parent.children.push(node);
          currentPath.push(node);
        }
      }

      if (roots.length === 0) {
        roots.push({
          id: this._generateId(),
          text: 'Central Topic',
          children: []
        });
      }

      return {
        tree: { roots },
        name: mapTitle,
        format: 'markdown'
      };
    } catch (error) {
      console.error('Failed to import Markdown:', error);
      throw new Error(`Nhập file Markdown thất bại: ${error.message}`);
    }
  }

  /**
   * Open file dialog to choose and import a file (.mindflow, .json, .md, .txt, .gz).
   * @param {string} acceptTypes - Accepted file extensions.
   * @param {Function} onProgress - Progress status callback.
   * @returns {Promise<Object>} Extracted map data.
   */
  async openFileDialog(acceptTypes = '.mindflow,.json,.md,.txt,.gz', onProgress = null) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = acceptTypes;

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          reject(new Error('Chưa chọn file sơ đồ nào'));
          return;
        }

        try {
          const result = await this.parseFile(file, onProgress);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      input.click();
    });
  }

  /**
   * Parse a File object into MindFlow tree data.
   * @param {File|Blob} file 
   * @param {Function} onProgress 
   * @returns {Promise<Object>}
   */
  async parseFile(file, onProgress = null) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    if (onProgress) onProgress(5, `Đang đọc file sơ đồ (${sizeMB} MB)...`);

    const fileName = file.name || 'imported_map';
    const ext = fileName.split('.').pop().toLowerCase();

    // 1. Try Gzip Decompression for .mindflow / .gz
    if (ext === 'mindflow' || ext === 'gz' || file.type === 'application/gzip' || file.type === 'application/x-gzip') {
      try {
        if (typeof DecompressionStream !== 'undefined') {
          if (onProgress) onProgress(20, 'Đang giải nén dữ liệu sơ đồ nén (.mindflow)...');
          const ds = new DecompressionStream('gzip');
          const decompressedStream = file.stream().pipeThrough(ds);
          const content = await new Response(decompressedStream).text();
          const result = await this.importJSONAsync(content, onProgress);
          if (!result.name || result.name === 'Imported Map') {
            result.name = fileName.replace(/\.[^/.]+$/, "");
          }
          return result;
        }
      } catch (err) {
        console.warn('DecompressionStream failed or file is raw text, falling back to text reader:', err);
      }
    }

    // 2. Read as text (Universal for JSON, Markdown, Text, Uncompressed Mindflow)
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = () => reject(new Error('Lỗi khi đọc file từ ổ đĩa'));
      reader.readAsText(file);
    });

    let result = null;

    if (ext === 'json') {
      try {
        result = await this.importJSONAsync(content, onProgress);
      } catch (jsonErr) {
        result = this.importMarkdown(content);
      }
    } else if (ext === 'md' || ext === 'txt') {
      try {
        result = this.importMarkdown(content);
      } catch (mdErr) {
        result = await this.importJSONAsync(content, onProgress);
      }
    } else {
      // Try JSON first, fallback to Markdown
      try {
        result = await this.importJSONAsync(content, onProgress);
      } catch (e) {
        result = this.importMarkdown(content);
      }
    }

    if (!result.name || result.name === 'Imported Map' || result.name === 'Imported Markdown') {
      result.name = fileName.replace(/\.[^/.]+$/, "");
    }

    return result;
  }
}
