/**
 * Theme class for handling dark/light mode switching.
 */
export class Theme {
  constructor() {
    this.currentTheme = 'dark'; // default dark
    this.listeners = [];
  }

  /**
   * Initialize theme from saved preference or system preference.
   */
  init() {
    this.currentTheme = 'dark';
    try {
      localStorage.setItem('mindflow_theme', 'dark');
    } catch (error) {}
    this.apply();
  }

  /**
   * Toggle between dark and light themes.
   */
  toggle() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.apply();
    this.save();
    this.notify();
  }

  /**
   * Set a specific theme.
   * @param {string} theme - 'dark' or 'light'
   */
  setTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') return;
    this.currentTheme = theme;
    this.apply();
    this.save();
    this.notify();
  }

  /**
   * Apply theme to the DOM.
   */
  apply() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = this.currentTheme === 'dark' ? '#0F0F23' : '#F8F9FC';
    }
  }

  /**
   * Save preference to local storage.
   */
  save() {
    try {
      localStorage.setItem('mindflow_theme', this.currentTheme);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }

  /**
   * Check if current theme is dark.
   * @returns {boolean}
   */
  isDark() {
    return this.currentTheme === 'dark';
  }

  /**
   * Register a listener for theme changes.
   * @param {Function} callback 
   */
  onChange(callback) {
    this.listeners.push(callback);
  }

  /**
   * Notify all listeners of theme change.
   */
  notify() {
    this.listeners.forEach(cb => cb(this.currentTheme));
  }
}
