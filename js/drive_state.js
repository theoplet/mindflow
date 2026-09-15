/**
 * MindFlow — Google Drive State Parser & Cleaner
 * Handles parsing and cleanup of Google Drive UI Integration ("Open with", "New in Drive") state URL parameter.
 */

/**
 * Parse Google Drive state parameter from URL search string.
 * Supports standard JSON, URL-encoded JSON, or double URL-encoded JSON.
 * Format: {"ids":[...],"resourceKeys":{...},"action":"open"|"create","folderId":...,"userId":...}
 *
 * @param {string} [search=window.location.search] Query string to parse
 * @returns {{action: string, ids: string[], resourceKeys: Record<string, string>, folderId: string|null, userId: string|null, raw: any}|null}
 */
export function parseDriveState(search = window.location.search) {
  try {
    const params = new URLSearchParams(search);
    const stateStr = params.get('state');
    if (!stateStr) return null;

    let parsed = null;
    try {
      parsed = JSON.parse(stateStr);
    } catch {
      // Fallback for double-encoded URI string
      parsed = JSON.parse(decodeURIComponent(stateStr));
    }

    if (!parsed || typeof parsed !== 'object') return null;

    const action = parsed.action || (parsed.ids && parsed.ids.length > 0 ? 'open' : (parsed.folderId ? 'create' : null));
    const ids = Array.isArray(parsed.ids) ? parsed.ids : (parsed.id ? [parsed.id] : []);
    const resourceKeys = parsed.resourceKeys && typeof parsed.resourceKeys === 'object' ? parsed.resourceKeys : {};
    const folderId = parsed.folderId || null;
    const userId = parsed.userId || null;

    return {
      action,
      ids,
      resourceKeys,
      folderId,
      userId,
      raw: parsed
    };
  } catch (err) {
    console.warn('Failed to parse Google Drive state:', err);
    return null;
  }
}

/**
 * Remove ?state= parameter from current URL using history.replaceState without reloading page.
 */
export function clearDriveState() {
  try {
    if (typeof window === 'undefined' || !window.location || !window.history) return;

    const url = new URL(window.location.href);
    if (url.searchParams.has('state')) {
      url.searchParams.delete('state');
      const cleanSearch = url.searchParams.toString();
      const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '') + url.hash;
      window.history.replaceState(window.history.state, document.title, cleanUrl);
    }
  } catch (err) {
    console.warn('Failed to clear Google Drive state from URL:', err);
  }
}
