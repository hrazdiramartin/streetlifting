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
  const CONNECTED_KEY = 'sl_drive_connected';
  const HINT_EMAIL_KEY = 'sl_drive_hint';
  const TOKEN_KEY = 'sl_drive_token';
  const INTERNAL_KEYS = new Set([
    CONNECTED_KEY, HINT_EMAIL_KEY, TOKEN_KEY,
    'sl_seed_version', '__sl_last_modified',
  ]);
  let accessToken = null;
  let tokenExpiresAt = 0;
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

  // --- Token persistence (localStorage = přežije zavření prohlížeče) ---
  function saveTokenToStorage(token, expiresIn) {
    accessToken = token;
    tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000; // -60s safety buffer
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: token, e: tokenExpiresAt }));
    } catch (e) { /* ignore */ }
  }

  function loadTokenFromStorage() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.t || Date.now() >= data.e) {
        localStorage.removeItem(TOKEN_KEY);
        return false;
      }
      accessToken = data.t;
      tokenExpiresAt = data.e;
      return true;
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }
  }

  function clearTokenStorage() {
    accessToken = null;
    tokenExpiresAt = 0;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
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
      // Callback se overridne v requestToken()
      callback: () => {},
    });
  }

  /**
   * Získá platný access token. Pokud aktuální vypršel, požádá Google o nový.
   * @param {boolean} interactive  true = pokud potřeba, ukáže consent popup. false = pouze tichý refresh.
   */
  function requestToken(interactive = false) {
    return new Promise((resolve, reject) => {
      // Token ještě platí (s rezervou 60 s)
      if (accessToken && tokenExpiresAt - Date.now() > 60000) return resolve(accessToken);
      try {
        initTokenClient();
      } catch (e) {
        return reject(e);
      }
      tokenClient.callback = (resp) => {
        if (resp.error) {
          if (!interactive) {
            // Tichý refresh selhal — neodpojuj, jen drž flag a čekej na user gesture
            emit('reconnect-needed');
          } else {
            emit('error', { message: resp.error });
          }
          return reject(new Error(resp.error));
        }
        const expiresIn = parseInt(resp.expires_in || '3600', 10);
        saveTokenToStorage(resp.access_token, expiresIn);
        localStorage.setItem(CONNECTED_KEY, '1');
        resolve(accessToken);
      };
      const prompt = interactive ? 'consent' : '';
      const opts = { prompt };
      // Optional: hint který účet použít (urychluje tichý refresh)
      const hint = localStorage.getItem(HINT_EMAIL_KEY);
      if (hint && !interactive) opts.login_hint = hint;
      tokenClient.requestAccessToken(opts);
    });
  }

  // --- Drive API calls ---
  async function driveFetch(path, options = {}, _retry = false) {
    if (!accessToken) {
      // Zkus tichý refresh — pokud máme persistent flag
      if (localStorage.getItem(CONNECTED_KEY)) {
        await requestToken(false);
      } else {
        throw new Error('Není přihlášeno');
      }
    }
    const url = path.startsWith('http') ? path : `https://www.googleapis.com${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      // Token expired? Zkus tichý refresh a retry (jen jednou)
      if (res.status === 401 && !_retry) {
        accessToken = null;
        try {
          await requestToken(false);
          return driveFetch(path, options, true);
        } catch (e) {
          emit('disconnected', { reason: 'token-expired' });
          throw e;
        }
      }
      const text = await res.text();
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
      await requestToken(true); // interactive consent
      emit('connected');
      await syncFromCloud();
      startAutoSync();
    } catch (e) {
      emit('error', { message: e.message });
    }
  }

  function disconnect() {
    clearTokenStorage();
    fileId = null;
    localStorage.removeItem(CONNECTED_KEY);
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
        // Sync uživatelské klíče, ale ne meta/interní
        if (key.startsWith('sl_') && !INTERNAL_KEYS.has(key)) scheduleSync();
        return r;
      };
      Storage.__patched = true;
    }
    // Poslouchej storage události (z jiných tabů ve stejném prohlížeči)
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('sl_') && !INTERNAL_KEYS.has(e.key)) scheduleSync();
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

  /**
   * Při startu zkusit obnovit připojení:
   * 1. Pokud máme platný uložený token (do 1h) — použij ho přímo (žádný popup)
   * 2. Pokud token expiroval, ale dříve byl uživatel připojen — zkus tichý refresh
   *    (silent ok v některých prohlížečích; pokud selže, zobraz "obnovit připojení" UI)
   */
  async function tryRestore() {
    // Případ 1: máme uložený platný token
    if (loadTokenFromStorage()) {
      try {
        // Ověř, že token ještě funguje
        await driveFetch('/drive/v3/about?fields=user');
        emit('connected', { restored: true });
        await syncFromCloud();
        startAutoSync();
        return true;
      } catch (e) {
        // Token byl v storage, ale Drive ho odmítl — pokračuj na case 2
        clearTokenStorage();
      }
    }

    // Případ 2: token expiroval/neexistuje, ale flag říká, že jsme byli připojeni
    if (!localStorage.getItem(CONNECTED_KEY)) return false;
    try {
      await ensureGisLoaded();
      await requestToken(false); // silent refresh
      emit('connected', { restored: true });
      // Ulož hint email pro příště
      try {
        const res = await driveFetch('/drive/v3/about?fields=user');
        const data = await res.json();
        if (data.user && data.user.emailAddress) {
          localStorage.setItem(HINT_EMAIL_KEY, data.user.emailAddress);
        }
      } catch (e) { /* nepodstatné */ }
      await syncFromCloud();
      startAutoSync();
      return true;
    } catch (e) {
      // Tichý refresh selhal — UI dostane 'reconnect-needed' (z requestToken)
      // Uživatel musí kliknout "Obnovit" pro popup výběru účtu.
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
