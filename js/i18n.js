/**
 * Internationalization module for switching between English and Vietnamese.
 */
export class I18n {
  constructor() {
    this.currentLang = 'en';
    this.listeners = [];
    this.translations = {
      en: {
        // App
        'app.title': 'MindFlow',
        'app.tagline': 'Visual Thinking, Simplified',
        
        // Toolbar
        'toolbar.newMap': 'New Map',
        'toolbar.openMap': 'Open',
        'toolbar.save': 'Save',
        'toolbar.export': 'Export',
        'toolbar.import': 'Import',
        'toolbar.undo': 'Undo',
        'toolbar.redo': 'Redo',
        'toolbar.layout': 'Layout',
        'toolbar.autoLayout': 'Auto-Layout',
        'toolbar.gdrive': 'Google Drive',
        'toolbar.theme': 'Toggle Theme',
        'toolbar.language': 'Language',
        'toolbar.shortcuts': 'Keyboard Shortcuts',
        'toolbar.ai': 'AI Assistant',
        'toolbar.fitView': 'Fit to View',
        'toolbar.centerRoot': 'Center on Root',
        'toolbar.addChild': 'Add Child Node',
        'toolbar.addSibling': 'Add Sibling Node',
        'toolbar.deleteNode': 'Delete Node',
        
        // Nodes
        'node.defaultText': 'New Topic',
        'node.rootText': 'Central Topic',
        'node.addChild': 'Add Child',
        'node.addSibling': 'Add Sibling',
        'node.edit': 'Edit Text',
        'node.delete': 'Delete',
        'node.color': 'Color',
        'node.icon': 'Icon',
        'node.notes': 'Notes',
        'node.collapse': 'Collapse',
        'node.expand': 'Expand',
        'node.copyBranch': 'Copy Branch',
        'node.pasteBranch': 'Paste Branch',
        
        // Properties panel
        'props.title': 'Properties',
        'props.color': 'Color',
        'props.icon': 'Icon',
        'props.notes': 'Notes',
        'props.notesPlaceholder': 'Add notes...',
        
        // Export dialog
        'export.title': 'Export Mind Map',
        'export.png': 'PNG Image',
        'export.svg': 'SVG Vector',
        'export.json': 'JSON Data',
        'export.markdown': 'Markdown',
        'export.download': 'Download',
        'export.cancel': 'Cancel',
        
        // Import
        'import.title': 'Import Mind Map',
        'import.dragDrop': 'Drag & drop a file here or click to browse',
        'import.formats': 'Supported: JSON, Markdown',
        
        // AI
        'ai.title': 'AI Mind Map Generator',
        'ai.prompt': 'Describe your mind map topic...',
        'ai.generate': 'Generate',
        'ai.expand': 'Expand This Node',
        'ai.apiKey': 'API Key',
        'ai.apiKeyPlaceholder': 'Enter your Gemini API key',
        'ai.saveKey': 'Save Key',
        'ai.noKey': 'Please enter your Gemini API key to use AI features',
        'ai.generating': 'Generating...',
        'ai.error': 'AI generation failed. Please try again.',
        
        // Shortcuts modal
        'shortcuts.title': 'Keyboard Shortcuts',
        'shortcuts.navigation': 'Navigation',
        'shortcuts.editing': 'Editing',
        'shortcuts.general': 'General',
        
        // Context menu
        'context.addChild': 'Add Child Node',
        'context.addSibling': 'Add Sibling Node',
        'context.edit': 'Edit Text',
        'context.delete': 'Delete Node',
        'context.color': 'Change Color',
        'context.icon': 'Set Icon',
        'context.collapse': 'Collapse Branch',
        'context.expand': 'Expand Branch',
        'context.copy': 'Copy Branch',
        'context.paste': 'Paste Branch',
        'context.aiExpand': 'AI: Expand Ideas',
        'context.autofit': 'Auto-Fit Node Size',

        // Editor
        'editor.saveNode': 'Save to Node',
        'editor.autofit': 'Auto-Fit',
        
        // Toasts
        'toast.saved': 'Map saved successfully',
        'toast.savedNode': 'Saved changes to node',
        'toast.autofitNode': 'Auto-fitted node size (Auto-Fit)',
        'toast.exported': 'Map exported successfully',
        'toast.imported': 'Map imported successfully',
        'toast.deleted': 'Node deleted',
        'toast.copied': 'Branch copied',
        'toast.pasted': 'Branch pasted',
        'toast.undone': 'Action undone',
        'toast.redone': 'Action redone',
        'toast.error': 'An error occurred',
        'toast.noSelection': 'No node selected',
        'toast.cannotDeleteRoot': 'Cannot delete root node',
        'toast.newMap': 'New map created',
        
        // GDrive
        'gdrive.title': 'Google Drive Integration',
        'gdrive.connect': 'Connect Google Drive',
        'gdrive.disconnect': 'Disconnect',
        'gdrive.save': 'Save to Drive',
        'gdrive.open': 'Open from Drive',
        'gdrive.clientId': 'OAuth Client ID',
        'gdrive.clientIdPlaceholder': 'Enter Google OAuth Client ID...',
        'gdrive.saveClientId': 'Save Client ID',
        'gdrive.connectedAs': 'Connected as',
        'gdrive.notConnected': 'Not connected to Google Drive',
        'gdrive.saving': 'Saving to Google Drive...',
        'gdrive.loading': 'Loading from Google Drive...',
        'gdrive.tokenPlaceholder': 'Or paste Access Token directly...',
        'gdrive.saveToken': 'Use Token',

        // Map management
        'map.untitled': 'Untitled Map',
        'map.new': 'Create New Map',
        'map.open': 'Open Map',
        'map.delete': 'Delete Map',
        'map.deleteConfirm': 'Are you sure you want to delete this map?',
        'map.rename': 'Rename Map',
        'map.empty': 'No saved maps yet',
        
        // Status
        'status.nodes': 'nodes',
        'status.zoom': 'Zoom',
        'status.autoSaved': 'Auto-saved',
        'status.unsaved': 'Unsaved changes',
        
        // General
        'general.confirm': 'Confirm',
        'general.cancel': 'Cancel',
        'general.close': 'Close',
        'general.yes': 'Yes',
        'general.no': 'No',
        'general.ok': 'OK',
      },
      vi: {
        // App
        'app.title': 'MindFlow',
        'app.tagline': 'Tư Duy Trực Quan, Đơn Giản Hóa',
        
        // Toolbar
        'toolbar.newMap': 'Bản đồ mới',
        'toolbar.openMap': 'Mở',
        'toolbar.save': 'Lưu',
        'toolbar.export': 'Xuất file',
        'toolbar.import': 'Nhập file',
        'toolbar.undo': 'Hoàn tác',
        'toolbar.redo': 'Làm lại',
        'toolbar.layout': 'Bố cục',
        'toolbar.autoLayout': 'Sắp xếp tự động',
        'toolbar.gdrive': 'Google Drive',
        'toolbar.theme': 'Đổi giao diện',
        'toolbar.language': 'Ngôn ngữ',
        'toolbar.shortcuts': 'Phím tắt',
        'toolbar.ai': 'Trợ lý AI',
        'toolbar.fitView': 'Vừa màn hình',
        'toolbar.centerRoot': 'Căn giữa gốc',
        'toolbar.addChild': 'Thêm nhánh con',
        'toolbar.addSibling': 'Thêm nhánh cùng cấp',
        'toolbar.deleteNode': 'Xóa nhánh',
        
        // Nodes
        'node.defaultText': 'Chủ đề mới',
        'node.rootText': 'Chủ đề chính',
        'node.addChild': 'Thêm nhánh con',
        'node.addSibling': 'Thêm nhánh cùng cấp',
        'node.edit': 'Sửa văn bản',
        'node.delete': 'Xóa',
        'node.color': 'Màu sắc',
        'node.icon': 'Biểu tượng',
        'node.notes': 'Ghi chú',
        'node.collapse': 'Thu gọn',
        'node.expand': 'Mở rộng',
        'node.copyBranch': 'Sao chép nhánh',
        'node.pasteBranch': 'Dán nhánh',
        
        // Properties panel
        'props.title': 'Thuộc tính',
        'props.color': 'Màu sắc',
        'props.icon': 'Biểu tượng',
        'props.notes': 'Ghi chú',
        'props.notesPlaceholder': 'Thêm ghi chú...',
        
        // Export dialog
        'export.title': 'Xuất Bản Đồ Tư Duy',
        'export.png': 'Ảnh PNG',
        'export.svg': 'Vector SVG',
        'export.json': 'Dữ liệu JSON',
        'export.markdown': 'Markdown',
        'export.download': 'Tải xuống',
        'export.cancel': 'Hủy',
        
        // Import
        'import.title': 'Nhập Bản Đồ Tư Duy',
        'import.dragDrop': 'Kéo thả file vào đây hoặc nhấn để chọn',
        'import.formats': 'Hỗ trợ: JSON, Markdown',
        
        // AI
        'ai.title': 'Tạo Bản Đồ Bằng AI',
        'ai.prompt': 'Mô tả chủ đề bản đồ tư duy...',
        'ai.generate': 'Tạo',
        'ai.expand': 'Mở rộng nhánh này',
        'ai.apiKey': 'Khóa API',
        'ai.apiKeyPlaceholder': 'Nhập khóa API Gemini của bạn',
        'ai.saveKey': 'Lưu khóa',
        'ai.noKey': 'Vui lòng nhập khóa API Gemini để sử dụng tính năng AI',
        'ai.generating': 'Đang tạo...',
        'ai.error': 'Tạo bằng AI thất bại. Vui lòng thử lại.',
        
        // Shortcuts modal
        'shortcuts.title': 'Phím Tắt',
        'shortcuts.navigation': 'Di chuyển',
        'shortcuts.editing': 'Chỉnh sửa',
        'shortcuts.general': 'Chung',
        
        // Context menu
        'context.addChild': 'Thêm nhánh con',
        'context.addSibling': 'Thêm nhánh cùng cấp',
        'context.edit': 'Sửa văn bản',
        'context.delete': 'Xóa nhánh',
        'context.color': 'Đổi màu',
        'context.icon': 'Đặt biểu tượng',
        'context.collapse': 'Thu gọn nhánh',
        'context.expand': 'Mở rộng nhánh',
        'context.copy': 'Sao chép nhánh',
        'context.paste': 'Dán nhánh',
        'context.aiExpand': 'AI: Mở rộng ý tưởng',
        'context.autofit': 'Auto-Fit Kích Thước Node',

        // Editor
        'editor.saveNode': 'Lưu vào Node',
        'editor.autofit': 'Auto-Fit',
        
        // Toasts
        'toast.saved': 'Đã lưu bản đồ',
        'toast.savedNode': 'Đã lưu thay đổi vào Node',
        'toast.autofitNode': 'Đã tự động căn chỉnh kích thước node (Auto-Fit)',
        'toast.exported': 'Đã xuất bản đồ',
        'toast.imported': 'Đã nhập bản đồ',
        'toast.deleted': 'Đã xóa nhánh',
        'toast.copied': 'Đã sao chép nhánh',
        'toast.pasted': 'Đã dán nhánh',
        'toast.undone': 'Đã hoàn tác',
        'toast.redone': 'Đã làm lại',
        'toast.error': 'Đã xảy ra lỗi',
        'toast.noSelection': 'Chưa chọn nhánh nào',
        'toast.cannotDeleteRoot': 'Không thể xóa nhánh gốc',
        'toast.newMap': 'Đã tạo sơ đồ mới',
        
        // GDrive
        'gdrive.title': 'Tích Hợp Google Drive',
        'gdrive.connect': 'Kết nối Google Drive',
        'gdrive.disconnect': 'Ngắt kết nối',
        'gdrive.save': 'Lưu lên Google Drive',
        'gdrive.open': 'Mở từ Google Drive',
        'gdrive.clientId': 'Mã Client ID OAuth',
        'gdrive.clientIdPlaceholder': 'Nhập mã Google OAuth Client ID...',
        'gdrive.saveClientId': 'Lưu Client ID',
        'gdrive.connectedAs': 'Đã kết nối với',
        'gdrive.notConnected': 'Chưa kết nối Google Drive',
        'gdrive.saving': 'Đang lưu lên Google Drive...',
        'gdrive.loading': 'Đang tải từ Google Drive...',
        'gdrive.tokenPlaceholder': 'Hoặc dán Access Token trực tiếp...',
        'gdrive.saveToken': 'Dùng Token',

        // Map management
        'map.untitled': 'Bản đồ chưa đặt tên',
        'map.new': 'Tạo bản đồ mới',
        'map.open': 'Mở bản đồ',
        'map.delete': 'Xóa bản đồ',
        'map.deleteConfirm': 'Bạn có chắc muốn xóa bản đồ này?',
        'map.rename': 'Đổi tên bản đồ',
        'map.empty': 'Chưa có bản đồ nào',
        
        // Status
        'status.nodes': 'nhánh',
        'status.zoom': 'Phóng to',
        'status.autoSaved': 'Đã tự động lưu',
        'status.unsaved': 'Chưa lưu',
        
        // General
        'general.confirm': 'Xác nhận',
        'general.cancel': 'Hủy',
        'general.close': 'Đóng',
        'general.yes': 'Có',
        'general.no': 'Không',
        'general.ok': 'OK',
      }
    };
  }

  /**
   * Initialize from saved preference.
   */
  init() {
    try {
      const saved = localStorage.getItem('mindflow_lang');
      if (saved && this.translations[saved]) {
        this.currentLang = saved;
      }
    } catch (error) {
      console.error('Could not access localStorage:', error);
    }
    this.updateDOM();
  }

  /**
   * Get translation for a key.
   * @param {string} key - Translation key.
   * @returns {string} Translated text.
   */
  t(key) {
    return this.translations[this.currentLang]?.[key] 
      || this.translations['en']?.[key] 
      || key;
  }

  /**
   * Toggle between en and vi.
   */
  toggle() {
    this.currentLang = this.currentLang === 'en' ? 'vi' : 'en';
    try {
      localStorage.setItem('mindflow_lang', this.currentLang);
    } catch (e) {
      // Ignore
    }
    this.updateDOM();
    this.notify();
  }

  /**
   * Set specific language.
   * @param {string} lang - Language code.
   */
  setLang(lang) {
    if (this.translations[lang]) {
      this.currentLang = lang;
      try {
        localStorage.setItem('mindflow_lang', lang);
      } catch (e) {
        // Ignore
      }
      this.updateDOM();
      this.notify();
    }
  }

  /**
   * Update all DOM elements with data-i18n attributes.
   */
  updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.t(key);
    });
  }

  /**
   * Get current language.
   * @returns {string}
   */
  getLang() { 
    return this.currentLang; 
  }
  
  /**
   * Register listener for language changes.
   * @param {Function} callback 
   */
  onChange(callback) { 
    this.listeners.push(callback); 
  }
  
  /**
   * Notify listeners.
   */
  notify() { 
    this.listeners.forEach(cb => cb(this.currentLang)); 
  }
}
