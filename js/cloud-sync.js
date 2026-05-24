/* ============================================
   CLOUD SYNC — Google Drive (appDataFolder)
   ============================================
   Doplň níže své OAuth Client ID z Google Cloud Console.
   Návod: viz CLOUD_SETUP.md
*/

const CLOUD_CONFIG = {
  // ← OAuth Client ID z Google Cloud Console (projekt Streetlifting)
  CLIENT_ID: '262182630704-nc956570f7tjodi1beaols8k0pumlnln.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/drive.appdata',
  FILE_NAME: 'streetlifting-data.json',
  // Auto-sync interval (ms). Změny v localStorage se uloží do Drive po této pauze.
  DEBOUNCE_MS: 3000,
  // Polling: jak často kontrolovat změny z jiných zařízení (ms). 0 = vypnuto.
  POLL_MS: 60000,
};

const CloudSync = (() => {
  let accessToken = null;
  let tokenClient = null;
  let fileId = null;
  let lastLocalSave = 0;
  let lastRemoteCheck = 0;
  let debounceTimer = null;
  let pollTimer = null;
  let listeners = [];

  // --- Status events ---
  function onStatus(cb) { listeners.push(cb); }
  function emit(status, detail = {}) {
    listeners.forEach(cb => cb(status, detail));
  }

  // --- Google Identity Services init ---
  function ensureGisLoaded() {
    return new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => setTimeout(resolve, 100);
      script.onerror = () => reject(new Error('Nepodařilo se načíst Google Identity Services'));
      document.head.appendChild(script);
    });
  }

  function initTokenClient() {
    if (tokenClient) return;
    if (!CLOUD_CONFIG.CLIENT_ID || CLOUD_CONFIG.CLIENT_ID.startsWith('TVOJE_')) {
      throw new Error('Chybí OAuth Client ID. Doplň ho v js/cloud-sync.js');
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLOUD_CONFIG.CLIENT_ID,
      scope: CLOUD_CONFIG.SCOPES,
      callback: (resp) => {
        if (resp.error) {
          emit('error', { message: resp.error });
          return;
        }
        accessToken = resp.access_token;
        sessionStorage.setItem('__sl_drive_token', accessToken);
        emit('connected');
        // Hned po připojení: stáhnout vzdálená data + nastartovat polling
        syncFromCloud().then(() => startAutoSync());
      },
    });
  }

  // --- Drive API calls ---
  async function driveFetch(path, options = {}) {
    if (!accessToken) throw new Error('Není přihlášeno');
    const url = path.startsWith('http') ? path : `https://www.googleapis.com${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      // Token expired? trigger re-auth
      if (res.status === 401) {
        accessToken = null;
        sessionStorage.removeItem('__sl_drive_token');
        emit('disconnected', { reason: 'token-expired' });
      }
      throw new Error(`Drive API ${res.status}: ${text}`);
    }
    return res;
  }

  /** Najde existující soubor v appDataFolder. */
  async function findFile() {
    const res = await driveFetch(
      `/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=name='${CLOUD_CONFIG.FILE_NAME}'`
    );
    const data = await res.json();
    return data.files && data.files[0] ? data.files[0] : null;
  }

  /** Načte obsah souboru. */
  async function downloadFile(id) {
    const res = await driveFetch(`/drive/v3/files/${id}?alt=media`);
    return await res.json();
  }

  /** Nahraje obsah do souboru (existující nebo nový). */
  async function uploadFile(content) {
    const body = JSON.stringify(content);
    const boundary = '-------streetlifting' + Date.now();
    const meta = fileId
      ? {} // u updatu metadata už nepotřebujeme posílat
      : { name: CLOUD_CONFIG.FILE_NAME, parents: ['appDataFolder'] };
    const multipart =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(meta) + `\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      body + `\r\n` +
      `--${boundary}--`;

    const url = fileId
      ? `/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : '/upload/drive/v3/files?uploadType=multipart';
    const method = fileId ? 'PATCH' : 'POST';
    const res = await driveFetch(url, {
      method,
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
    const data = await res.json();
    if (!fileId) fileId = data.id;
    return data;
  }

  // --- Public API ---
  async function connect() {
    try {
      await ensureGisLoaded();
      initTokenClient();
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (e) {
      emit('error', { message: e.message });
    }
  }

  function disconnect() {
    accessToken = null;
    fileId = null;
    sessionStorage.removeItem('__sl_drive_token');
    stopAutoSync();
    emit('disconnected', { reason: 'user' });
  }

  /** Stáhne z Drive a přepíše lokální data (pokud existují vzdálená data). */
  async function syncFromCloud() {
    if (!accessToken) return;
    emit('syncing', { direction: 'pull' });
    try {
      if (!fileId) {
        const f = await findFile();
        if (f) fileId = f.id;
      }
      if (!fileId) {
        // Žádný vzdálený soubor — nahraj lokální stav jako první
        await syncToCloud();
        return;
      }
      const remote = await downloadFile(fileId);
      const localTs = parseInt(localStorage.getItem('__sl_last_modified') || '0');
      const remoteTs = remote.__last_modified || 0;
      if (remoteTs > localTs) {
        // Vzdálená verze je novější → importovat
        DataIO.importJSON(remote);
        localStorage.setItem('__sl_last_modified', String(remoteTs));
        emit('synced', { direction: 'pull', timestamp: remoteTs });
        // Reload stránky aby UI ukázalo nová data
        setTimeout(() => location.reload(), 500);
      } else {
        emit('synced', { direction: 'pull', timestamp: remoteTs, skipped: true });
      }
      lastRemoteCheck = Date.now();
    } catch (e) {
      emit('error', { message: e.message });
    }
  }

  /** Nahraje lokální data na Drive (overwrite). */
  async function syncToCloud() {
    if (!accessToken) return;
    emit('syncing', { direction: 'push' });
    try {
      const payload = DataIO.exportAll();
      payload.__last_modified = Date.now();
      localStorage.setItem('__sl_last_modified', String(payload.__last_modified));
      await uploadFile(payload);
      lastLocalSave = Date.now();
      emit('synced', { direction: 'push', timestamp: payload.__last_modified });
    } catch (e) {
      emit('error', { message: e.message });
    }
  }

  /** Debounce: po N ms od poslední změny push to cloud. */
  function scheduleSync() {
    if (!accessToken) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => syncToCloud(), CLOUD_CONFIG.DEBOUNCE_MS);
  }

  /** Poslouchá změny v localStorage (z jiných tabů + manuální update přes patch). */
  function startAutoSync() {
    // Patch Storage.set aby spouštěl auto-sync po každé změně
    if (!Storage.__patched) {
      const origSet = Storage.set.bind(Storage);
      Storage.set = function(key, value) {
        const r = origSet(key, value);
        // Sync klíče, ale ne meta klíče
        if (key.startsWith('sl_') && key !== 'sl_seed_version') scheduleSync();
        return r;
      };
      Storage.__patched = true;
    }
    // Poslouchej storage události (z jiných tabů ve stejném prohlížeči)
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('sl_')) scheduleSync();
    });
    // Polling: každých POLL_MS sekund kontroluj remote změny
    if (CLOUD_CONFIG.POLL_MS > 0) {
      stopAutoSync(); // jistota
      pollTimer = setInterval(() => syncFromCloud(), CLOUD_CONFIG.POLL_MS);
    }
  }

  function stopAutoSync() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    clearTimeout(debounceTimer);
  }

  /** Při startu zkusit obnovit token a auto-sync. */
  async function tryRestore() {
    const t = sessionStorage.getItem('__sl_drive_token');
    if (!t) return false;
    accessToken = t;
    try {
      // Test, jestli token funguje
      await driveFetch('/drive/v3/about?fields=user');
      emit('connected', { restored: true });
      await syncFromCloud();
      startAutoSync();
      return true;
    } catch (e) {
      accessToken = null;
      sessionStorage.removeItem('__sl_drive_token');
      return false;
    }
  }

  function isConnected() { return !!accessToken; }
  function getStatus() {
    return {
      connected: !!accessToken,
      lastLocalSave,
      lastRemoteCheck,
      fileId,
    };
  }

  return {
    connect,
    disconnect,
    syncFromCloud,
    syncToCloud,
    onStatus,
    tryRestore,
    isConnected,
    getStatus,
    config: CLOUD_CONFIG,
  };
})();

// Automaticky obnov token při načtení stránky
document.addEventListener('DOMContentLoaded', () => {
  CloudSync.tryRestore();
});
