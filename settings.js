(() => {
  const STORAGE_KEY = 'ftir_user_profile_v1';
  const FILE_KIND = 'ftir-user-settings';
  const SECRET_FILE_KIND = 'ftir-user-settings-encrypted';
  const SCHEMA_VERSION = 1;

  const copy = (value) => JSON.parse(JSON.stringify(value));
  const stringValue = (value, fallback = '', max = 4096) => typeof value === 'string'
    ? value.trim().slice(0, max)
    : fallback;
  const isMode = (value) => value === 'production' || value === 'development';

  function defaultProfile(mode) {
    const development = mode !== 'production';
    return {
      schemaVersion: SCHEMA_VERSION,
      mode: development ? 'development' : 'production',
      connections: {
        analysisApi: development ? 'http://127.0.0.1:8787/api/analyze' : '',
        peakDetectionApi: development ? 'http://127.0.0.1:8787/api/peaks/detect' : '',
        referenceSearchApi: development ? 'http://127.0.0.1:8088/api/v1/search' : '',
        apiCredentials: development ? 'omit' : 'include',
      },
      llm: {
        provider: 'server',
        model: '',
        apiKey: '',
      },
      auth: {
        analysisAccessToken: '',
        referenceServiceToken: '',
      },
      features: {
        directReferenceSearch: development,
        referenceSignalType: 'transmittance',
        referenceTopK: 5,
        referenceTimeoutMs: 30000,
      },
    };
  }

  function normalize(raw, fallbackMode) {
    const base = defaultProfile(isMode(raw?.mode) ? raw.mode : fallbackMode);
    const connections = raw?.connections || {};
    const llm = raw?.llm || {};
    const auth = raw?.auth || {};
    const features = raw?.features || {};
    return {
      ...base,
      schemaVersion: SCHEMA_VERSION,
      mode: isMode(raw?.mode) ? raw.mode : base.mode,
      connections: {
        analysisApi: stringValue(connections.analysisApi, base.connections.analysisApi),
        peakDetectionApi: stringValue(connections.peakDetectionApi, base.connections.peakDetectionApi),
        referenceSearchApi: stringValue(connections.referenceSearchApi, base.connections.referenceSearchApi),
        apiCredentials: connections.apiCredentials === 'include' ? 'include' : 'omit',
      },
      llm: {
        provider: ['server', 'gemini', 'mistral', 'mock'].includes(llm.provider) ? llm.provider : 'server',
        model: stringValue(llm.model, '', 256),
        apiKey: stringValue(llm.apiKey, '', 2048),
      },
      auth: {
        analysisAccessToken: stringValue(auth.analysisAccessToken, '', 2048),
        referenceServiceToken: stringValue(auth.referenceServiceToken, '', 2048),
      },
      features: {
        directReferenceSearch: typeof features.directReferenceSearch === 'boolean'
          ? features.directReferenceSearch
          : base.features.directReferenceSearch,
        referenceSignalType: features.referenceSignalType === 'absorbance' ? 'absorbance' : 'transmittance',
        referenceTopK: Math.min(Math.max(Number(features.referenceTopK) || base.features.referenceTopK, 1), 20),
        referenceTimeoutMs: Math.min(Math.max(Number(features.referenceTimeoutMs) || base.features.referenceTimeoutMs, 1000), 120000),
      },
    };
  }

  const fallbackMode = () => window.APP_CONFIG?.environment?.defaultMode === 'production' ? 'production' : 'development';

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw), fallbackMode());
    } catch (error) {
      console.warn('[FTIR settings] profile restore failed', { name: error.name, message: error.message });
    }
    const profile = defaultProfile(fallbackMode());
    write(profile);
    return profile;
  }

  function write(profile) {
    const normalized = normalize(profile, fallbackMode());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function update(patch) {
    const current = read();
    return write({
      ...current,
      ...patch,
      connections: { ...current.connections, ...(patch.connections || {}) },
      llm: { ...current.llm, ...(patch.llm || {}) },
      auth: { ...current.auth, ...(patch.auth || {}) },
      features: { ...current.features, ...(patch.features || {}) },
    });
  }

  function redact(profile) {
    const result = copy(profile);
    result.llm.apiKey = '';
    result.auth.analysisAccessToken = '';
    result.auth.referenceServiceToken = '';
    return result;
  }

  const bytesToBase64 = (bytes) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  const base64ToBytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

  async function cryptoKey(password, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function makeExport(includeSecrets, password = '') {
    const profile = read();
    if (!includeSecrets) {
      return {
        kind: FILE_KIND,
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        settings: redact(profile),
      };
    }
    if (!password) throw new Error('A password is required to export secrets');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await cryptoKey(password, salt),
      new TextEncoder().encode(JSON.stringify(profile))
    );
    return {
      kind: SECRET_FILE_KIND,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      encryption: { algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA-256', iterations: 210000, salt: bytesToBase64(salt), iv: bytesToBase64(iv) },
      payload: bytesToBase64(new Uint8Array(encrypted)),
    };
  }

  async function importDocument(document, password = '') {
    if (document?.kind === FILE_KIND) return write(normalize(document.settings, fallbackMode()));
    if (document?.kind !== SECRET_FILE_KIND || !document.encryption || !document.payload) {
      throw new Error('This is not a supported FTIR settings file');
    }
    if (!password) throw new Error('A password is required to import secrets');
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(document.encryption.iv) },
        await cryptoKey(password, base64ToBytes(document.encryption.salt)),
        base64ToBytes(document.payload)
      );
      return write(normalize(JSON.parse(new TextDecoder().decode(decrypted)), fallbackMode()));
    } catch {
      throw new Error('Could not decrypt settings. Check the password and file.');
    }
  }

  function resolvedConfig(baseConfig) {
    const profile = read();
    const analysisApi = profile.connections.analysisApi || '/api/analyze';
    return {
      ...baseConfig,
      environment: { ...(baseConfig.environment || {}), mode: profile.mode },
      analysisApi,
      peakDetectionApi: profile.connections.peakDetectionApi || analysisApi.replace(/\/api\/analyze$/, '/api/peaks/detect'),
      apiCredentials: profile.connections.apiCredentials,
      referenceSearch: {
        enabled: Boolean(profile.mode === 'development' && profile.features.directReferenceSearch && profile.connections.referenceSearchApi),
        api: profile.connections.referenceSearchApi,
        signalType: profile.features.referenceSignalType,
        topK: profile.features.referenceTopK,
        timeoutMs: profile.features.referenceTimeoutMs,
      },
      userProfile: profile,
    };
  }

  window.FTIR_SETTINGS = {
    storageKey: STORAGE_KEY,
    get: read,
    save: write,
    update,
    reset: () => write(defaultProfile(fallbackMode())),
    redact,
    makeExport,
    importDocument,
    resolvedConfig,
  };
  window.APP_RUNTIME_CONFIG = resolvedConfig(window.APP_CONFIG || {});
})();
