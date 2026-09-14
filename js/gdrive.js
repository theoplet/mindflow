/**
 * Google Drive API Integration module for MindFlow
 * Handles Google OAuth 2.0 authentication and Drive REST API v3 operations.
 */

export class GDrive {
  constructor() {
    this.clientId = localStorage.getItem('mindflow_gdrive_client_id') || '';
    this.token = localStorage.getItem('mindflow_gdrive_token') || sessionStorage.getItem('mindflow_gdrive_token') || '';
    this.user = null;
    this.listeners = [];
  }

  init() {
    // Check if token stored and valid for auto-connect
    if (this.token) {
      this.fetchUserProfile().catch(() => {
        this.token = '';
        localStorage.removeItem('mindflow_gdrive_token');
        sessionStorage.removeItem('mindflow_gdrive_token');
      });
    }
  }

  setClientId(clientId) {
    this.clientId = clientId;
    localStorage.setItem('mindflow_gdrive_client_id', clientId);
  }

  hasClientId() {
    return Boolean(this.clientId && this.clientId.trim().length > 0);
  }

  isConnected() {
    return Boolean(this.token && this.token.length > 0);
  }

  /**
   * Authorize with Google OAuth 2.0 Popup (Trust Web & Auto Connect)
   */
  authorize() {
    return new Promise((resolve, reject) => {
      if (!this.hasClientId()) {
        reject(new Error('Google OAuth Client ID is missing. Please enter your Client ID in Settings.'));
        return;
      }

      const saveTokenLocally = (token) => {
        this.token = token;
        localStorage.setItem('mindflow_gdrive_token', token);
        sessionStorage.setItem('mindflow_gdrive_token', token);
      };

      // Check if Google GIS client script is loaded
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            saveTokenLocally(response.access_token);
            this.fetchUserProfile()
              .then(() => resolve(this.user))
              .catch(() => resolve({ token: this.token }));
          },
        });
        client.requestAccessToken();
      } else {
        // Fallback to manual OAuth2 implicit flow redirect/popup
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(this.clientId)}` +
          `&redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}` +
          `&response_type=token` +
          `&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email')}` +
          `&prompt=consent`;

        const width = 500;
        const height = 600;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;

        const popup = window.open(
          authUrl,
          'GoogleOAuth',
          `width=${width},height=${height},top=${top},left=${left}`
        );

        const checkPopup = setInterval(() => {
          try {
            if (!popup || popup.closed) {
              clearInterval(checkPopup);
            } else if (popup.location.hash) {
              const hash = popup.location.hash.substring(1);
              const params = new URLSearchParams(hash);
              const token = params.get('access_token');
              if (token) {
                clearInterval(checkPopup);
                popup.close();
                saveTokenLocally(token);
                this.fetchUserProfile().then(() => resolve(this.user));
              }
            }
          } catch (e) {
            // Cross-origin check error while loading
          }
        }, 500);
      }
    });
  }

  /**
   * Set Token manually (if user pastes access token directly)
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('mindflow_gdrive_token', token);
    sessionStorage.setItem('mindflow_gdrive_token', token);
    return this.fetchUserProfile();
  }

  /**
   * Disconnect Google Drive
   */
  disconnect() {
    this.token = '';
    this.user = null;
    localStorage.removeItem('mindflow_gdrive_token');
    sessionStorage.removeItem('mindflow_gdrive_token');
    this.notify();
  }

  /**
   * Fetch logged in user profile via userinfo or Drive API about
   */
  async fetchUserProfile() {
    if (!this.token) return null;
    try {
      // Try OAuth2 userinfo endpoint first
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      if (res.ok) {
        this.user = await res.json();
        this.notify();
        return this.user;
      }
      
      // Fallback: Try Drive API about endpoint (works with drive.file scope alone)
      const driveRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      if (driveRes.ok) {
        const driveData = await driveRes.json();
        if (driveData.user) {
          this.user = {
            name: driveData.user.displayName || 'Google Drive User',
            email: driveData.user.emailAddress || 'Connected via Token',
            picture: driveData.user.photoLink || ''
          };
          this.notify();
          return this.user;
        }
      }

      // If both return non-200 (e.g. 401 Unauthorized / expired token)
      throw new Error('Token is expired or invalid');
    } catch (e) {
      console.warn('Failed to fetch user profile, clearing invalid token:', e);
      this.token = '';
      localStorage.removeItem('mindflow_gdrive_token');
      sessionStorage.removeItem('mindflow_gdrive_token');
      this.user = null;
      this.notify();
      throw e;
    }
  }

  /**
   * Save mindmap file with .mindflow extension to Google Drive
   */
  async saveFile(filename, contentString, driveFileId = null) {
    if (!this.isConnected()) throw new Error('Not connected to Google Drive');

    let targetName = filename;
    if (!targetName.endsWith('.mindflow') && !targetName.endsWith('.json')) {
      targetName = `${targetName}.mindflow`;
    }

    const fileMeta = {
      name: targetName,
      mimeType: 'application/json'
    };

    const content = typeof contentString === 'string' ? contentString : JSON.stringify(contentString);

    if (driveFileId) {
      // Update existing file content
      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: content
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to update .mindflow file on Google Drive');
      }
      return await res.json();
    } else {
      // Multipart create file RFC 2046 compliant
      const boundary = 'foo_bar_baz_mindflow';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMeta) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        close_delim;

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: body
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to save .mindflow file to Google Drive');
      }
      return await res.json();
    }
  }

  /**
   * List files saved on Google Drive (.mindflow and .json files)
   */
  async listFiles() {
    if (!this.isConnected()) throw new Error('Not connected to Google Drive');

    const q = encodeURIComponent("(name contains '.mindflow' or name contains '.json' or mimeType = 'application/json') and trashed = false");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Failed to list Google Drive files');
    }

    const data = await res.json();
    return data.files || [];
  }

  /**
   * Load file content from Google Drive
   */
  async loadFile(fileId) {
    if (!this.isConnected()) throw new Error('Not connected to Google Drive');

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    if (!res.ok) {
      throw new Error('Failed to download file from Google Drive');
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }

  onChange(cb) {
    this.listeners.push(cb);
  }

  notify() {
    this.listeners.forEach(cb => cb({ isConnected: this.isConnected(), user: this.user }));
  }
}
