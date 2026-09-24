(() => {
  const config = window.APP_RUNTIME_CONFIG || window.APP_CONFIG || {};
  const translations = config.translations || {};
  const supportedLangs = config.supportedLangs || Object.keys(translations) || ['en'];
  const footerLinks = config.footerLinks || {};
  const chartSettings = config.chart || {};
  const analysisApi = config.analysisApi || '/api/analyze';
  const peakDetectionApi = config.peakDetectionApi || analysisApi.replace(/\/api\/analyze$/, '/api/peaks/detect');
  const referenceSearchConfig = config.referenceSearch || {};
  const userProfile = config.userProfile || {};
  const userAuth = userProfile.auth || {};
  const userLlm = userProfile.llm || {};
  const referenceSearchEnabled = Boolean(referenceSearchConfig.enabled && referenceSearchConfig.api);
  const referenceSearchApi = referenceSearchConfig.api || '';
  const referenceSearchDirect = Boolean(referenceSearchConfig.direct);
  const referenceMetadataApi = referenceSearchConfig.metadataApi
    || referenceSearchApi.replace(/\/api\/v1\/search\/?(?:\?.*)?$/, '/api/v1/metadata/resolve');
  const referenceSearchTopK = Math.min(Math.max(Number(referenceSearchConfig.topK) || 5, 1), 20);
  const referenceSearchTimeoutMs = Math.min(Math.max(Number(referenceSearchConfig.timeoutMs) || 30000, 1000), 120000);
  const apiHostname = new URL(analysisApi, window.location.href).hostname;
  const localApi = apiHostname === 'localhost' || apiHostname === '127.0.0.1' || apiHostname === '::1';
  // Disk pages and a local API use wildcard CORS and must not send cookies.
  // A hosted API retains cookies required by Cloudflare Access. The setting
  // can be overridden in config.js for a custom authentication setup.
  const apiCredentials = config.apiCredentials || (window.location.protocol === 'file:' || localApi ? 'omit' : 'include');
  const DEBUG_LOGGING = config.debugLogging !== false;
  const clientLog = (event, details = {}) => {
    if (DEBUG_LOGGING) console.info(`[FTIR] ${event}`, details);
  };
  const clientWarn = (event, details = {}) => console.warn(`[FTIR] ${event}`, details);
  const clientError = (event, details = {}) => console.error(`[FTIR] ${event}`, details);
  const defaultXRange = chartSettings.defaultXRange || { min: 500, max: 4000 };
  const zones = chartSettings.zones || [];

  const fileInput = document.getElementById('files');
  const mergeBtn = document.getElementById('mergeBtn');
  const statusEl = document.getElementById('status');
  const chartEl = document.getElementById('chart');
  const sampleInput = document.getElementById('sampleIndex');
  const fileNameInput = document.getElementById('fileName');
  const downloadLinkEl = document.getElementById('downloadLink');
  const refreshBtn = document.getElementById('refreshChart');
  const resetZoomBtn = document.getElementById('resetZoom');
  const xMinInput = document.getElementById('xMin');
  const xMaxInput = document.getElementById('xMax');
  const yMinInput = document.getElementById('yMin');
  const yMaxInput = document.getElementById('yMax');
  const peaksSpectrumTitle = document.getElementById('peaksSpectrumTitle');
  const spectrumSettingsDialog = document.getElementById('spectrumSettingsDialog');
  const spectrumSettingsForm = document.getElementById('spectrumSettingsForm');
  const spectrumSettingsId = document.getElementById('spectrumSettingsId');
  const spectrumSettingsTitle = document.getElementById('spectrumSettingsTitle');
  const spectrumSettingsName = document.getElementById('spectrumSettingsName');
  const spectrumSettingsOffset = document.getElementById('spectrumSettingsOffset');
  const spectrumSettingsRole = document.getElementById('spectrumSettingsRole');
  const closeSpectrumSettingsBtn = document.getElementById('closeSpectrumSettings');
  const removeSpectrumFromDialogBtn = document.getElementById('removeSpectrumFromDialog');
  const detectorSignalType = document.getElementById('detectorSignalType');
  const detectorBaselineMethod = document.getElementById('detectorBaselineMethod');
  const detectorMinProminence = document.getElementById('detectorMinProminence');
  const detectorMinSeparation = document.getElementById('detectorMinSeparation');
  const detectorSmoothingWindow = document.getElementById('detectorSmoothingWindow');
  const detectPeaksBtn = document.getElementById('detectPeaks');
  const detectorStatus = document.getElementById('detectorStatus');
  const detectorConnectionStatus = document.getElementById('detectorConnectionStatus');
  const peakDetectionHelpBtn = document.getElementById('peakDetectionHelp');
  const peakDetectionHelpDialog = document.getElementById('peakDetectionHelpDialog');
  const closePeakDetectionHelpBtn = document.getElementById('closePeakDetectionHelp');
  const openPeakProcessingBtn = document.getElementById('openPeakProcessing');
  const peakProcessingDialog = document.getElementById('peakProcessingDialog');
  const closePeakProcessingBtn = document.getElementById('closePeakProcessing');
  const peakProcessingChart = document.getElementById('peakProcessingChart');
  const peakProcessingMeta = document.getElementById('peakProcessingMeta');
  const openPeakSettingsBtn = document.getElementById('openPeakSettings');
  const peakDetectorSettingsDialog = document.getElementById('peakDetectorSettingsDialog');
  const closePeakSettingsBtn = document.getElementById('closePeakSettings');
  const cancelPeakSettingsBtn = document.getElementById('cancelPeakSettings');
  const applyPeakBaselineBtn = document.getElementById('applyPeakBaseline');
  const detectorBaselineSummary = document.getElementById('detectorBaselineSummary');
  const saveCsvBtn = document.getElementById('saveCsv');
  const copyPngBtn = document.getElementById('copyPng');
  const copySvgBtn = document.getElementById('copySvg');
  const showPointsInput = document.getElementById('showPoints');
  const baselineSeriesSelect = document.getElementById('baselineSeries');
  const baselineDegreeInput = document.getElementById('baselineDegree');
  const baselinePreviewBtn = document.getElementById('baselinePreview');
  const baselineApplyBtn = document.getElementById('baselineApply');
  const baselineRevertBtn = document.getElementById('baselineRevert');
  const chartRow = document.getElementById('chartRow');
  const chartControls = document.getElementById('chartControls');
  const openChartSettingsBtn = document.getElementById('openChartSettings');
  const chartSettingsDialog = document.getElementById('chartSettingsDialog');
  const closeChartSettingsBtn = document.getElementById('closeChartSettings');
  const chartLegend = document.getElementById('chartLegend');
  const i18nTargets = document.querySelectorAll('[data-i18n]');
  const langLinks = document.querySelectorAll('.lang-link');
  const addStripeBtn = document.getElementById('addStripe');
  const confirmAllPeaksBtn = document.getElementById('confirmAllPeaks');
  const togglePeaksTableBtn = document.getElementById('togglePeaksTable');
  const peaksTableWrap = document.getElementById('peaksTableWrap');
  const peaksBody = document.getElementById('peaksBody');
  const peaksEmpty = document.getElementById('peaksEmpty');
  const copyStripesBtn = document.getElementById('copyStripes');
  const copyConfirmedPayloadBtn = document.getElementById('copyConfirmedPayload');
  const analyzeConfirmedBtn = document.getElementById('analyzeConfirmed');
  const searchLocalReferencesBtn = document.getElementById('searchLocalReferences');
  const analysisPromptInput = document.getElementById('analysisPrompt');
  const analysisCard = document.getElementById('analysisCard');
  const analysisStatus = document.getElementById('analysisStatus');
  const analysisResult = document.getElementById('analysisResult');
  const referenceSearchCard = document.getElementById('referenceSearchCard');
  const referenceSearchStatus = document.getElementById('referenceSearchStatus');
  const referenceSearchSpectrum = document.getElementById('referenceSearchSpectrum');
  const referenceSearchResult = document.getElementById('referenceSearchResult');
  const referenceSidebarToggleBtn = document.getElementById('referenceSidebarToggle');
  const exportSessionBtn = document.getElementById('exportSession');
  const importSessionBtn = document.getElementById('importSession');
  const importSessionInput = document.getElementById('importSessionInput');
  const clearLocalSessionBtn = document.getElementById('clearLocalSession');
  const openAppSettingsBtn = document.getElementById('openAppSettings');
  const appSettingsDialog = document.getElementById('appSettingsDialog');
  const appSettingsForm = document.getElementById('appSettingsForm');
  const closeAppSettingsBtn = document.getElementById('closeAppSettings');
  const importUserSettingsBtn = document.getElementById('importUserSettings');
  const importUserSettingsInput = document.getElementById('importUserSettingsInput');
  const exportUserSettingsBtn = document.getElementById('exportUserSettings');
  const exportUserSettingsWithSecretsBtn = document.getElementById('exportUserSettingsWithSecrets');
  const resetUserSettingsBtn = document.getElementById('resetUserSettings');
  const settingsMode = document.getElementById('settingsMode');
  const settingsAnalysisApi = document.getElementById('settingsAnalysisApi');
  const settingsPeakApi = document.getElementById('settingsPeakApi');
  const settingsReferenceApi = document.getElementById('settingsReferenceApi');
  const settingsApiCredentials = document.getElementById('settingsApiCredentials');
  const settingsLlmProvider = document.getElementById('settingsLlmProvider');
  const settingsLlmModel = document.getElementById('settingsLlmModel');
  const settingsLlmApiKey = document.getElementById('settingsLlmApiKey');
  const settingsAnalysisToken = document.getElementById('settingsAnalysisToken');
  const settingsReferenceToken = document.getElementById('settingsReferenceToken');
  const selectFilesBtn = document.getElementById('selectFiles');
  const stripeSetBtns = document.querySelectorAll('.stripe-set-btn');
  const peakDb = Array.isArray(window.FTIR_BASE) ? window.FTIR_BASE : [];
  const footerSite = document.getElementById('footerSite');
  const footerGithub = document.getElementById('footerGithub');
  const footerCoffee = document.getElementById('footerCoffee');

  let savedLang = null;
  try {
    savedLang = localStorage.getItem('ftir_ui_language');
  } catch (error) {
    console.warn('[FTIR language] unable to read saved language', { name: error.name, message: error.message });
  }
  // Do not infer the analysis language from the browser locale. The app is
  // English by default and changes only after an explicit UI selection.
  let currentLang = supportedLangs.includes(savedLang) ? savedLang : 'en';

  let lastData = null;
  let offsets = new Map();
  let spectrumRoles = new Map();
  let lastParsedRows = [];
  let lastColumns = [];
  let lastSpectra = [];
  let visibleSeries = new Map();
  let markerActive = false;
  let markerX = null;
  let markerSpectrumId = null;
  let activeSpectrumId = null;
  let markerUpdater = null;
  let markerStep = 1;
  let merging = false;
let defaultYRange = null;
// Hard navigation limits configured in the chart settings. The visible
// viewport is stored separately and may zoom only inside these limits.
let chartNavigationBounds = {
  xMin: defaultXRange.min,
  xMax: defaultXRange.max,
  yMin: null,
  yMax: null,
};
let chartViewport = {
  xMin: defaultXRange.min,
  xMax: defaultXRange.max,
  yMin: null,
  yMax: null,
};
// An automatic Y range follows the loaded spectra. Store a separate flag for
// a deliberate Y pan/zoom so stale local-session coordinates never override it.
let chartYViewportActive = false;
const BASELINE_DISABLED = true;
let stripeSets = {
  candidates: [],
  confirmed: [],
};
let activeStripeSet = 'candidates';
const stripeColors = d3.schemeTableau10 || ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];
let stripeIdSeq = 0;
let baselineSeries = null;
let baselineMap = new Map();
let baselineModel = null; // {series, method:'poly', degree, coeffs}
let baselinePreviewModel = null;
  let lastFilesRaw = [];
  let lastPeakProcessing = null;
  let detectorProcessedBySpectrum = new Map();
  let detectorAppliedSettings = new Map();
let customNames = new Map();
let isPanning = false;
let panStartDomain = null;
let panMode = false;
let showPoints = false;
let panRaf = null;
let panQueued = null;
let measurementState = null;
  let analysisData = null;
  // Search results belong to the spectrum that was used as the query. Keeping
  // them separately prevents a tab switch from showing another spectrum's hit.
  let referenceSearchesBySpectrum = new Map();
  let referenceSidebarOpen = false;
  // Local-only token for the direct diagnostic route. It is intentionally not
  // saved in config.js, localStorage or the exported session.
  let localReferenceServiceToken = userAuth.referenceServiceToken || '';
const LOCAL_SESSION_KEY = 'ftir_merger_local_session_v1';
const LOCAL_SETTINGS_KEY = 'ftir_merger_settings_v1';
let localSaveTimer = null;
  let peaksTableCollapsed = false;

  clientLog('app.ready', {
    pageOrigin: window.location.origin,
    analysisApi,
    peakDetectionApi,
    referenceSearch: referenceSearchEnabled ? referenceSearchApi : 'disabled',
    apiCredentials,
    language: currentLang,
    debugLogging: DEBUG_LOGGING,
  });

  const sanitizeName = (name) => (name || '').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'col';
  const makeUniqueColumnName = (existing, raw) => {
    const base = sanitizeName(raw);
    let name = base;
    let n = 2;
    while (existing.includes(name)) {
      name = `${base}_${n++}`;
    }
    existing.push(name);
    return name;
  };
  const makeUniqueSpectrumId = (existing, raw) => {
    const base = `spectrum-${sanitizeName(raw)}`;
    let id = base;
    let n = 2;
    while (existing.has(id)) id = `${base}-${n++}`;
    existing.add(id);
    return id;
  };

  function t(key, arg) {
    const dict = translations[currentLang] || translations.en || {};
    const val = dict[key];
    const fallback = (translations.en || {})[key] || key;
    const resolved = typeof val === 'function' ? val(arg) : val;
    return resolved !== undefined ? resolved : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function apiRequestHeaders({ includeLlmPreferences = false } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (userAuth.analysisAccessToken) headers.authorization = `Bearer ${userAuth.analysisAccessToken}`;
    // These headers are accepted only when the server is deliberately started
    // with BYOK_ENABLED=true. They are never written to console logs.
    if (includeLlmPreferences && userLlm.provider && userLlm.provider !== 'server') {
      headers['x-ftir-llm-provider'] = userLlm.provider;
      if (userLlm.model) headers['x-ftir-llm-model'] = userLlm.model;
      if (userLlm.apiKey) headers['x-ftir-llm-api-key'] = userLlm.apiKey;
    }
    return headers;
  }

  function applyTranslations() {
    i18nTargets.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    if (sampleInput) {
      sampleInput.placeholder = currentLang === 'ru' ? 'например, A1' : currentLang === 'sr' ? 'npr. A1' : 'e.g. A1';
    }
    yMinInput.placeholder = t('yAuto') || 'auto';
    yMaxInput.placeholder = t('yAuto') || 'auto';
    langLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.lang === currentLang);
    });
    document.documentElement.lang = currentLang;
    updateDetectorControls();
  }

  function setLanguage(lang) {
    currentLang = supportedLangs.includes(lang) ? lang : 'en';
    try {
      localStorage.setItem('ftir_ui_language', currentLang);
    } catch (error) {
      console.warn('[FTIR language] unable to save language', { name: error.name, message: error.message });
    }
    applyTranslations();
    saveLocalSettings();
    if (lastFilesRaw.length) scheduleLocalSave();
  }
  function applyFooterLinks() {
    if (footerSite) {
      const href = footerLinks.site || '#';
      footerSite.href = href || '#';
      footerSite.style.visibility = href ? 'visible' : 'hidden';
    }
    if (footerGithub) {
      const href = footerLinks.github || '#';
      footerGithub.href = href || '#';
      footerGithub.style.visibility = href ? 'visible' : 'hidden';
    }
    if (footerCoffee) {
      const href = footerLinks.coffee || footerLinks.сoffee || '';
      footerCoffee.href = href || '#';
      footerCoffee.style.visibility = href ? 'visible' : 'hidden';
    }
  }
  if (!stripeSets[activeStripeSet]) stripeSets[activeStripeSet] = [];
  stripeSetBtns.forEach((btn) => {
    btn.addEventListener('click', () => setActiveStripeSet(btn.dataset.set));
  });
  setActiveStripeSet(activeStripeSet);

  chartLegend?.addEventListener('click', (event) => {
    if (event.target.closest('.spectrum-settings-btn')) return;
    const tab = event.target.closest('.spectrum-tab');
    if (!tab || !chartLegend.contains(tab)) return;
    const spectrumId = tab.dataset.spectrumId;
    clientLog('spectrum.tab.click', { spectrumId, activeSpectrumId });
    if (spectrumId) setActiveSpectrum(spectrumId);
  });

  langLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setLanguage(link.dataset.lang);
    });
  });
  applyTranslations();
  applyFooterLinks();

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#b91c1c' : '#0f172a';
  }

  function setDetectorConnectionStatus(message = '') {
    if (!detectorConnectionStatus) return;
    detectorConnectionStatus.textContent = message;
    detectorConnectionStatus.hidden = !message;
  }

  async function diagnoseApiAccess() {
    let healthUrl;
    try {
      healthUrl = new URL('/health', analysisApi).toString();
      const startedAt = performance.now();
      const response = await fetch(healthUrl, {
        method: 'GET',
        credentials: apiCredentials,
        cache: 'no-store',
      });
      const diagnostic = {
        healthUrl,
        status: response.status,
        ok: response.ok,
        redirected: response.redirected,
        responseUrl: response.url,
        durationMs: Math.round(performance.now() - startedAt),
      };
      clientLog('api.access.diagnostic', diagnostic);
      return diagnostic;
    } catch (error) {
      const diagnostic = {
        healthUrl: healthUrl || null,
        name: error.name,
        message: error.message,
      };
      clientError('api.access.diagnostic_failed', diagnostic);
      return diagnostic;
    }
  }

  function setRangeInputs({ xMin, xMax, yMin, yMax }) {
    if (typeof xMin === 'number') xMinInput.value = String(xMin);
    if (typeof xMax === 'number') xMaxInput.value = String(xMax);
    if (yMin !== undefined) yMinInput.value = yMin === null ? '' : String(yMin);
    if (yMax !== undefined) yMaxInput.value = yMax === null ? '' : String(yMax);
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeBounds(min, max, fallbackMin, fallbackMax) {
    const lower = finiteNumber(min);
    const upper = finiteNumber(max);
    if (lower === null || upper === null || lower === upper) {
      return { min: fallbackMin, max: fallbackMax };
    }
    return { min: Math.min(lower, upper), max: Math.max(lower, upper) };
  }

  function updateNavigationBoundsFromInputs({ resetAutoY = false } = {}) {
    const xBounds = normalizeBounds(
      xMinInput.value,
      xMaxInput.value,
      defaultXRange.min,
      defaultXRange.max,
    );
    chartNavigationBounds.xMin = xBounds.min;
    chartNavigationBounds.xMax = xBounds.max;
    chartViewport.xMin = xBounds.min;
    chartViewport.xMax = xBounds.max;
    const yMin = finiteNumber(yMinInput.value);
    const yMax = finiteNumber(yMaxInput.value);
    if (yMin !== null && yMax !== null && yMin !== yMax) {
      chartNavigationBounds.yMin = Math.min(yMin, yMax);
      chartNavigationBounds.yMax = Math.max(yMin, yMax);
      chartViewport.yMin = chartNavigationBounds.yMin;
      chartViewport.yMax = chartNavigationBounds.yMax;
      chartYViewportActive = false;
    } else if (resetAutoY) {
      // A single value or equal values (for example the legacy 0 / 0 state)
      // are not a usable range. Return to the data-driven automatic domain.
      chartNavigationBounds.yMin = null;
      chartNavigationBounds.yMax = null;
      chartViewport.yMin = null;
      chartViewport.yMax = null;
      chartYViewportActive = false;
    }
  }

  function setNavigationBounds(bounds = {}) {
    const xBounds = normalizeBounds(
      bounds.xMin,
      bounds.xMax,
      defaultXRange.min,
      defaultXRange.max,
    );
    chartNavigationBounds.xMin = xBounds.min;
    chartNavigationBounds.xMax = xBounds.max;
    const yBounds = normalizeBounds(bounds.yMin, bounds.yMax, null, null);
    chartNavigationBounds.yMin = yBounds.min;
    chartNavigationBounds.yMax = yBounds.max;
  }

  function getNavigationBounds(autoExtent) {
    const yFallback = Array.isArray(autoExtent) && autoExtent.length === 2
      ? normalizeBounds(autoExtent[0], autoExtent[1], 0, 1)
      : { min: 0, max: 1 };
    return {
      xMin: chartNavigationBounds.xMin,
      xMax: chartNavigationBounds.xMax,
      yMin: chartNavigationBounds.yMin ?? yFallback.min,
      yMax: chartNavigationBounds.yMax ?? yFallback.max,
    };
  }

  function getChartViewport(autoExtent) {
    const navigationBounds = getNavigationBounds(autoExtent);
    const hasFixedYBounds = chartNavigationBounds.yMin !== null && chartNavigationBounds.yMax !== null;
    const storedYMin = finiteNumber(chartViewport.yMin);
    const storedYMax = finiteNumber(chartViewport.yMax);
    const useStoredY = (hasFixedYBounds || chartYViewportActive)
      && storedYMin !== null && storedYMax !== null && storedYMin !== storedYMax;
    const yMin = useStoredY ? storedYMin : null;
    const yMax = useStoredY ? storedYMax : null;
    return {
      xMin: finiteNumber(chartViewport.xMin) ?? navigationBounds.xMin,
      xMax: finiteNumber(chartViewport.xMax) ?? navigationBounds.xMax,
      yMin: yMin === null || yMax === null ? navigationBounds.yMin : Math.min(yMin, yMax),
      yMax: yMin === null || yMax === null ? navigationBounds.yMax : Math.max(yMin, yMax),
    };
  }

  function setChartViewport(viewport = {}, autoExtent = null, { restoreY = false } = {}) {
    const hasDataExtent = Array.isArray(autoExtent)
      && autoExtent.length === 2
      && Number.isFinite(Number(autoExtent[0]))
      && Number.isFinite(Number(autoExtent[1]));
    const bounds = getNavigationBounds(hasDataExtent ? autoExtent : [0, 1]);
    let xMin = finiteNumber(viewport.xMin) ?? bounds.xMin;
    let xMax = finiteNumber(viewport.xMax) ?? bounds.xMax;
    [xMin, xMax] = clampViewport(xMin, xMax, bounds.xMin, bounds.xMax);
    const yMin = finiteNumber(viewport.yMin);
    const yMax = finiteNumber(viewport.yMax);
    let nextYMin = null;
    let nextYMax = null;
    const hasFixedYBounds = chartNavigationBounds.yMin !== null && chartNavigationBounds.yMax !== null;
    const canRestoreY = hasFixedYBounds || restoreY;
    if (canRestoreY && yMin !== null && yMax !== null && yMin !== yMax) {
      [nextYMin, nextYMax] = chartNavigationBounds.yMin !== null && chartNavigationBounds.yMax !== null
        ? clampViewport(yMin, yMax, bounds.yMin, bounds.yMax)
        : hasDataExtent
          ? clampViewport(yMin, yMax, bounds.yMin, bounds.yMax)
          : [Math.min(yMin, yMax), Math.max(yMin, yMax)];
    }
    chartViewport = { xMin, xMax, yMin: nextYMin, yMax: nextYMax };
    chartYViewportActive = !hasFixedYBounds && restoreY && nextYMin !== null && nextYMax !== null;
  }

  function clampViewport(min, max, boundsMin, boundsMax) {
    const lower = Math.min(boundsMin, boundsMax);
    const upper = Math.max(boundsMin, boundsMax);
    const totalSpan = upper - lower;
    if (!Number.isFinite(totalSpan) || totalSpan <= 0) return [lower, upper];
    let nextMin = Math.min(min, max);
    let nextMax = Math.max(min, max);
    const span = nextMax - nextMin;
    if (span >= totalSpan) return [lower, upper];
    if (nextMin < lower) {
      nextMax += lower - nextMin;
      nextMin = lower;
    }
    if (nextMax > upper) {
      nextMin -= nextMax - upper;
      nextMax = upper;
    }
    return [Math.max(lower, nextMin), Math.min(upper, nextMax)];
  }

  function computeAdjustedExtent(dataset) {
    if (!dataset || !dataset.length) return null;
    let min = Infinity;
    let max = -Infinity;
    dataset.forEach((d) => {
      if (typeof d.x !== 'number' || typeof d.y !== 'number') return;
      if (d.x > defaultXRange.max || d.x < defaultXRange.min) return;
      const base = baselineSeries ? baselineMap.get(d.x) : undefined;
      const offset = offsets.get(d.file) || 0;
      const y = (typeof base === 'number' ? d.y - base : d.y) + offset;
      if (!Number.isFinite(y)) return;
      if (y < min) min = y;
      if (y > max) max = y;
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return [min, max];
  }

  function polyFit(xs, ys, degree) {
    const n = degree + 1;
    const sums = Array(2 * degree + 1).fill(0);
    const t = Array(n).fill(0);
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const y = ys[i];
      let pow = 1;
      for (let k = 0; k <= 2 * degree; k++) {
        sums[k] += pow;
        pow *= x;
      }
      pow = 1;
      for (let k = 0; k <= degree; k++) {
        t[k] += y * pow;
        pow *= x;
      }
    }
    const A = Array.from({ length: n }, () => Array(n).fill(0));
    const b = t.slice();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        A[i][j] = sums[i + j];
      }
    }
    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
      }
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [b[i], b[maxRow]] = [b[maxRow], b[i]];
      const pivot = A[i][i] || 1e-12;
      for (let j = i; j < n; j++) A[i][j] /= pivot;
      b[i] /= pivot;
      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const factor = A[k][i];
        for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
        b[k] -= factor * b[i];
      }
    }
    return b; // coefficients
  }

  function polyEval(coeffs, x) {
    let res = 0;
    let pow = 1;
    for (let i = 0; i < coeffs.length; i++) {
      res += coeffs[i] * pow;
      pow *= x;
    }
    return res;
  }

  function buildBaselinePoly(series, degree) {
    if (!series || !lastParsedRows || !lastParsedRows.length) return null;
    const points = [];
    lastParsedRows.forEach((row) => {
      if (typeof row.wavenumber === 'number' && typeof row[series] === 'number') {
        points.push({ x: row.wavenumber, y: row[series] });
      }
    });
    if (!points.length) return null;
    const sampled = downsamplePoints(points, 1500);
    const xs = sampled.map((p) => p.x);
    const ys = sampled.map((p) => p.y);
    const coeffs = polyFit(xs, ys, degree);
    const map = new Map();
    points.forEach((p) => {
      map.set(p.x, polyEval(coeffs, p.x));
    });
    return { coeffs, map, degree, series };
  }

  function rebuildBaselineFromModel(model) {
    if (!model || !model.series || !Array.isArray(model.coeffs)) return null;
    if (!lastParsedRows || !lastParsedRows.length) return null;
    const map = new Map();
    lastParsedRows.forEach((row) => {
      if (typeof row.wavenumber === 'number' && typeof row[model.series] === 'number') {
        map.set(row.wavenumber, polyEval(model.coeffs, row.wavenumber));
      }
    });
    if (!map.size) return null;
    return { ...model, map };
  }

  function parseInfraredText(text) {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && !Number.isNaN(Number(parts[0])) && !Number.isNaN(Number(parts[1]))) {
        rows.push([Number(parts[0]), Number(parts[1])]);
      }
    }
    return rows;
  }

  function parseCsvSpectra(text) {
    try {
      const parsed = d3.csvParse(text, d3.autoType);
      if (!parsed.length || !parsed.columns || !parsed.columns.length) return null;
      const columns = parsed.columns.map((c) => (c || '').trim()).filter(Boolean);
      if (!columns.length) return null;
      const xKey =
        columns.find((c) => c.toLowerCase() === 'wavenumber') ||
        columns.find((c) => ['wn', 'x', 'wave', 'wavenumbers'].includes(c.toLowerCase()));
      if (!xKey) return null;
      const dataCols = columns.filter((c) => c !== xKey);
      if (!dataCols.length) return null;
      const rows = parsed.filter((r) => Number.isFinite(r[xKey]));
      if (!rows.length) return null;
      return { type: 'csv', xKey, columns: dataCols, rows };
    } catch (err) {
      console.error('CSV parse error', err);
      return null;
    }
  }

  const squeezeMap = {
    '@': '0',
    A: '1',
    B: '2',
    C: '3',
    D: '4',
    E: '5',
    F: '6',
    G: '7',
    H: '8',
    I: '9',
    a: '-0',
    b: '-1',
    c: '-2',
    d: '-3',
    e: '-4',
    f: '-5',
    g: '-6',
    h: '-7',
    i: '-8',
    j: '-9',
  };
  const diffMap = {
    '%': 0,
    J: 1,
    K: 2,
    L: 3,
    M: 4,
    N: 5,
    O: 6,
    P: 7,
    Q: 8,
    R: 9,
    j: 0,
    k: -1,
    l: -2,
    m: -3,
    n: -4,
    o: -5,
    p: -6,
    q: -7,
    r: -8,
    s: -9,
  };
  const dupMap = {
    S: 1,
    T: 2,
    U: 3,
    V: 4,
    W: 5,
    X: 6,
    Y: 7,
    Z: 8,
    s: 1,
    t: 2,
    u: 3,
    v: 4,
    w: 5,
    x: 6,
    y: 7,
    z: 8,
  };

  function unsqueezeToken(token) {
    let out = '';
    for (const ch of token) {
      if (squeezeMap[ch] !== undefined) {
        out += squeezeMap[ch];
      } else if (ch === '%') {
        out += '.';
      } else {
        out += ch;
      }
    }
    const num = Number(out);
    return Number.isFinite(num) ? num : null;
  }

  function parseJcamp(text) {
    // prefer bundled converter if present
    try {
      const jc =
        (typeof window !== 'undefined' && (window.jcampconverter || window.Jcampconverter || window.JcampConverter || window.Jcamp)) ||
        (typeof JcampConverter !== 'undefined' ? JcampConverter : null);
      if (jc && typeof jc.convert === 'function') {
        const res = jc.convert(text, { keepRecords: true });
        const spec =
          res?.spectra?.[0] ||
          res?.flatten?.[0]?.spectra?.[0] ||
          res?.flatten?.[0]?.data?.[0] ||
          res?.entries?.[0]?.spectra?.[0];
        const xs = spec?.data?.x || spec?.x || [];
        const ys = spec?.data?.y || spec?.y || [];
        if (xs.length && ys.length && xs.length === ys.length) {
          return xs.map((x, i) => [x, ys[i]]);
        }
      }
    } catch (e) {
      console.error('jcampconverter failed', e);
    }

    const rows = [];
    const lines = text.split(/\r?\n/);
    let inData = false;
    let firstX = null;
    let lastX = null;
    let nPoints = null;
    let deltaX = null;
    let xFactor = 1;
    let yFactor = 1;
    let firstY = null;

    const num = (s) => {
      const v = Number(s);
      return Number.isFinite(v) ? v : null;
    };

    try {
      let lastY = null;
      const tokenize = (line) => {
        const clean = line.replace(/[;,]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!clean) return [];
        const tokens = [];
        let current = '';
        const push = () => {
          if (current) tokens.push(current);
          current = '';
        };
        for (let i = 0; i < clean.length; i++) {
          const ch = clean[i];
          if (ch === ' ') {
            push();
            continue;
          }
          const isSign = ch === '+' || ch === '-';
          const isLetter = /[A-Za-z%@]/.test(ch);
          if (isLetter || isSign) {
            if (current) push();
          }
          current += ch;
        }
        push();
        return tokens;
      };

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('##')) {
          const header = line.toUpperCase();
          const grab = (re) => {
            const m = line.match(re);
            return m ? num(m[1]) : null;
          };
          firstX = grab(/^##\s*FIRSTX\s*=\s*([+-]?[0-9.eE]+)/i) ?? firstX;
          lastX = grab(/^##\s*LASTX\s*=\s*([+-]?[0-9.eE]+)/i) ?? lastX;
          nPoints = grab(/^##\s*NPOINTS\s*=\s*([0-9]+)/i) ?? nPoints;
          deltaX = grab(/^##\s*DELTAX\s*=\s*([+-]?[0-9.eE]+)/i) ?? deltaX;
          xFactor = grab(/^##\s*XFACTOR\s*=\s*([+-]?[0-9.eE]+)/i) ?? xFactor;
          yFactor = grab(/^##\s*YFACTOR\s*=\s*([+-]?[0-9.eE]+)/i) ?? yFactor;
          firstY = grab(/^##\s*FIRSTY\s*=\s*([+-]?[0-9.eE]+)/i) ?? firstY;
          if (/^##\s*(XYDATA|XYPOINTS|PEAK\s*TABLE)/i.test(header)) {
            inData = true;
            if (firstY !== null && lastY === null) lastY = firstY;
          } else if (/^##\s*END/i.test(header)) {
            inData = false;
          } else {
            inData = false;
          }
          continue;
        }
        if (!inData) continue;
        const parts = tokenize(line);
        if (parts.length < 2) continue;
        const startX = num(parts[0]);
        if (startX === null) continue;
        let step = deltaX;
        if (step === null && firstX !== null && lastX !== null && nPoints) {
          step = (lastX - firstX) / Math.max(1, nPoints - 1);
        }
        if (step === null) step = 1;
        let currentX = startX;
        for (let i = 1; i < parts.length; i++) {
          let tok = parts[i];
          if (!tok) continue;
          let dupCount = 0;
          const tail = tok[tok.length - 1];
          if (dupMap[tail] !== undefined && tok.length > 1) {
            dupCount = dupMap[tail];
            tok = tok.slice(0, -1);
          }
          const lead = tok[0];
          let yVal = null;
          if (dupMap[lead] !== undefined && tok.length === 1 && lastY !== null) {
            dupCount = dupMap[lead];
            yVal = lastY;
          } else if (diffMap[lead] !== undefined && lastY !== null) {
            const rest = tok.slice(1);
            const diffVal = unsqueezeToken(rest || '0');
            if (diffVal !== null) {
              yVal = lastY + diffVal;
            }
          }
          if (yVal === null) {
            yVal = unsqueezeToken(tok);
          }
          if (yVal === null) continue;
          lastY = yVal;
          rows.push([currentX * xFactor, yVal * yFactor]);
          currentX += step;
          for (let k = 0; k < dupCount; k++) {
            rows.push([currentX * xFactor, yVal * yFactor]);
            currentX += step;
          }
        }
      }
      return rows;
    } catch (err) {
      console.error('JCAMP parse error', err);
      return [];
    }
  }

  function decodeBase64ToString(data) {
    try {
      const clean = (data || '').replace(/[^A-Za-z0-9+/=]/g, '');
      if (!clean) return null;
      const bin = atob(clean);
      let out = '';
      for (let i = 0; i < bin.length; i++) {
        out += String.fromCharCode(bin.charCodeAt(i));
      }
      return out;
    } catch (err) {
      console.error('Base64 decode failed', err);
      return null;
    }
  }

  function parseSpectraContent(text, name = '') {
    const autoScaleTransmittance = (rows) => {
      if (!rows || !rows.length) return rows;
      let min = Infinity;
      let max = -Infinity;
      for (const [, y] of rows) {
        if (typeof y !== 'number') continue;
        if (y < min) min = y;
        if (y > max) max = y;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) return rows;
      // Heuristic: values look like 0..1 transmittance, lift to percent
      if (max <= 2 && min >= -2) {
        return rows.map(([x, y]) => [x, typeof y === 'number' ? y * 100 : y]);
      }
      return rows;
    };

    const lower = (name || '').toLowerCase();
    const csvParsed = parseCsvSpectra(text);
    if (csvParsed) return csvParsed;
    const looksJcamp =
      lower.endsWith('.jdx') ||
      lower.endsWith('.dx') ||
      lower.endsWith('.jsm') ||
      lower.endsWith('.jcm') ||
      /##\s*JCAMP/i.test(text) ||
      /##\s*XYDATA/i.test(text);
    if (looksJcamp) {
      const parsed = parseJcamp(text);
      if (parsed.length) return autoScaleTransmittance(parsed);
      // Some .jcm are base64-packed JCAMP; try to decode
      if (lower.endsWith('.jcm')) {
        const decoded = decodeBase64ToString(text);
        if (decoded) {
          const parsedDecoded = parseJcamp(decoded);
          if (parsedDecoded.length) return autoScaleTransmittance(parsedDecoded);
          const fallback = parseInfraredText(decoded);
          if (fallback.length) return autoScaleTransmittance(fallback);
        }
      }
    }
    return autoScaleTransmittance(parseInfraredText(text));
  }

  function applyZoom(factor, centerX, centerY, axes = {}) {
    if (!lastData || !lastData.length) return;
    const zoomX = axes.x !== false;
    const zoomY = axes.y === true;
    const autoExtent = computeAdjustedExtent(lastData) || [0, 1];
    const navigationBounds = getNavigationBounds(autoExtent);
    const viewport = getChartViewport(autoExtent);
    const currentXMin = viewport.xMin;
    const currentXMax = viewport.xMax;
    const currentYMin = viewport.yMin;
    const currentYMax = viewport.yMax;
    const safeFactor = Math.min(Math.max(factor, 0.5), 1.8); // limit per tick
    const zoomRange = (min, max, center, f) => {
      const minOff = min - center;
      const maxOff = max - center;
      let a = center + minOff * f;
      let b = center + maxOff * f;
      if (a < b) return [a, b];
      return [b, a];
    };
    let [nextXMin, nextXMax] = zoomX
      ? zoomRange(currentXMin, currentXMax, centerX, safeFactor)
      : [currentXMin, currentXMax];
    let [nextYMin, nextYMax] = zoomY
      ? zoomRange(currentYMin, currentYMax, centerY, safeFactor)
      : [currentYMin, currentYMax];

    const minSpanX = (navigationBounds.xMax - navigationBounds.xMin) * 0.01;
    const minSpanY = Math.abs(navigationBounds.yMax - navigationBounds.yMin) * 0.01 || 1;
    if (zoomX && Math.abs(nextXMax - nextXMin) < minSpanX) {
      const half = minSpanX / 2;
      nextXMin = centerX - half;
      nextXMax = centerX + half;
    }
    if (zoomY && Math.abs(nextYMax - nextYMin) < minSpanY) {
      const half = minSpanY / 2;
      nextYMin = centerY - half;
      nextYMax = centerY + half;
    }

    // The values configured in Chart settings are hard limits. Zooming out
    // stops at them and keeps the current view inside the selected region.
    if (zoomX) {
      [nextXMin, nextXMax] = clampViewport(
        nextXMin,
        nextXMax,
        navigationBounds.xMin,
        navigationBounds.xMax,
      );
    }
    if (zoomY) {
      [nextYMin, nextYMax] = clampViewport(
        nextYMin,
        nextYMax,
        navigationBounds.yMin,
        navigationBounds.yMax,
      );
    }

    chartViewport = {
      xMin: nextXMin,
      xMax: nextXMax,
      yMin: zoomY ? nextYMin : chartViewport.yMin,
      yMax: zoomY ? nextYMax : chartViewport.yMax,
    };
    if (zoomY && chartNavigationBounds.yMin === null && chartNavigationBounds.yMax === null) {
      chartYViewportActive = true;
    }
    renderChartFromData(lastData);
    scheduleLocalSave();
  }

  function buildCsvFromRows(rows, columns) {
    const header = ['wavenumber', ...columns];
    const lines = [header.join(',')];
    rows.forEach((row) => {
      const base = baselineSeries ? baselineMap.get(row.wavenumber) : undefined;
      lines.push(
        [
          row.wavenumber,
          ...columns.map((c) => {
            let val = row[c];
            if (typeof val === 'number' && typeof base === 'number') {
              val = val - base;
            }
            return val ?? '';
          }),
        ].join(',')
      );
    });
    return lines.join('\n');
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function generateName() {
    const files = Array.from(fileInput.files || []);
    const count = files.length;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const sample = sampleInput ? (sampleInput.value || '').trim() : '';
    const base = `ftir_${date}_${count || 0}files${sample ? `_${sample}` : ''}`;
    const withExt = base.toLowerCase().endsWith('.csv') ? base : `${base}.csv`;
    fileNameInput.value = withExt;
  }

  fileInput.addEventListener('change', () => {
    generateName();
    const files = Array.from(fileInput.files || []);
    if (files.length) {
      if (lastData && lastFilesRaw.length) {
        appendFiles(files);
      } else {
        handleMerge();
      }
    }
  });
  if (sampleInput) sampleInput.addEventListener('input', () => {
    generateName();
    scheduleLocalSave();
  });
  fileNameInput?.addEventListener('input', scheduleLocalSave);
  generateName();

  function renderChartFromData(data, options = {}) {
    const { skipLegend = false } = options;
    if (!window.d3) return;
    if (!data || !data.length) return;
    // Replace every spectrum that has an applied correction. Keeping the
    // series in the original spectrum order prevents tabs from moving when
    // the selected spectrum changes. The raw source data remains untouched.
    const rawBySpectrum = d3.group(data, (item) => item.spectrumId);
    const spectrumOrder = Array.from(new Set(data.map((item) => item.spectrumId)));
    const chartData = [];
    spectrumOrder.forEach((spectrumId) => {
      const rawRows = rawBySpectrum.get(spectrumId) || [];
      const processed = detectorProcessedBySpectrum.get(spectrumId);
      const processedX = processed?.diagnostics?.x;
      const displayCorrected = processed?.diagnostics?.displayCorrected;
      if (!rawRows.length || !Array.isArray(processedX) || !Array.isArray(displayCorrected)
        || !processedX.length || !displayCorrected.length) {
        chartData.push(...rawRows);
        return;
      }
      const processedRows = processedX.map((xValue, index) => ({
        ...rawRows[0],
        x: Number(xValue),
        y: Number(displayCorrected[index]),
      })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      chartData.push(...(processedRows.length ? processedRows : rawRows));
    });
    const filteredRaw = chartData.filter((d) => typeof d.x === 'number' && typeof d.y === 'number' && d.x <= defaultXRange.max && d.x >= defaultXRange.min);
    const filtered = filteredRaw.map((d) => {
      const base = baselineSeries ? baselineMap.get(d.x) : undefined;
      const adjustedY = typeof base === 'number' ? d.y - base : d.y;
      return { ...d, y: adjustedY };
    });
    if (!filtered.length) {
      chartEl.innerHTML = '<p>No data in 4000–500.</p>';
      chartLegend.innerHTML = '';
      renderStripesTable();
      return;
    }

    const allSeries = Array.from(new Set(filtered.map((d) => d.file)));
    const filteredVisible = filtered.filter((d) => visibleSeries.get(d.file) !== false);
    const byFile = d3.group(filteredVisible, (d) => d.file);
    const yDomainAuto = d3.extent(filtered, (d) => d.y);
    const viewport = getChartViewport(yDomainAuto);
    const xMaxVal = viewport.xMax;
    const xMinVal = viewport.xMin;
    const yMinVal = viewport.yMin;
    const yMaxVal = viewport.yMax;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = chartEl.clientWidth || 800;
    const height = Math.max(520, Math.round((window.innerHeight || 900) * 0.72));
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = d3.scaleLinear().domain([xMaxVal, xMinVal]).range([0, innerW]);
    const y = d3.scaleLinear().domain([yMinVal, yMaxVal]).nice().range([innerH, 0]);
    const domainSpan = Math.abs(xMaxVal - xMinVal) || 1;
    const arrowStep = domainSpan / 200;
    markerStep = arrowStep;
    const clampX = (val) => Math.min(Math.max(val, Math.min(xMaxVal, xMinVal)), Math.max(xMaxVal, xMinVal));

    const line = d3
      .line()
      .x((d) => x(d.x))
      .y((d) => y(d.y))
      .defined((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
      .curve(d3.curveLinear);

    const svg = d3.create('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('tabindex', 0);
    const baseTransform = `translate(${margin.left},${margin.top})`;
    const g = svg.append('g').attr('transform', baseTransform);

    const zoneHintEl = document.getElementById('zoneHint');
    const zoneLayer = g.append('g').attr('class', 'zones');
    const zoneRects = [];
    zones.forEach((zone) => {
      const x1 = x(zone.start);
      const x2 = x(zone.end);
      const left = Math.min(x1, x2);
      const zoneWidth = Math.abs(x2 - x1);
      if (zoneWidth <= 0) return;
      const zoneGroup = zoneLayer.append('g');
      const rect = zoneGroup
        .append('rect')
        .attr('x', left)
        .attr('y', 0)
        .attr('width', zoneWidth)
        .attr('height', innerH)
        .attr('fill', 'transparent')
        .attr('stroke', 'none')
        .attr('rx', 4)
        .attr('ry', 4)
        .style('pointer-events', 'none');
      zoneRects.push({ rect, zone });
    });

    g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x));
    g.append('g').call(d3.axisLeft(y).tickFormat(() => ''));
    g.append('rect').attr('x', 0).attr('y', 0).attr('width', innerW).attr('height', innerH).attr('fill', 'none').attr('stroke', '#cbd5e1').attr('stroke-width', 1.2);

    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(allSeries);
    const allPoints = [];

    // draw user stripes + labels
    const activeStripes = currentStripes();
    if (activeStripes.length) {
      const stripesLayer = g.append('g').attr('class', 'user-stripes');
      const isCandidates = activeStripeSet === 'candidates';
      const setStripeHover = (stripeId = null) => {
        stripesLayer.selectAll('.user-stripe')
          .classed('is-highlighted', function() { return stripeId !== null && this.dataset.stripeId === String(stripeId); })
          .classed('is-muted', function() { return stripeId !== null && this.dataset.stripeId !== String(stripeId); });
      };
      activeStripes.forEach((stripe) => {
        const sx = x(stripe.x);
        const stripeKey = String(stripe.id || stripe.peakId || stripe.x);
        const stripeGroup = stripesLayer
          .append('g')
          .attr('class', 'user-stripe')
          .attr('data-stripe-id', stripeKey);
        stripeGroup
          .append('line')
          .attr('class', 'stripe-line')
          .attr('x1', sx)
          .attr('x2', sx)
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', stripe.color || '#111')
          .attr('stroke-width', isCandidates ? 1.4 : 2.2)
          .attr('stroke-dasharray', isCandidates ? '6,4' : '4,2')
          .attr('opacity', isCandidates ? 0.7 : 1);
        const stripeLabel = stripeGroup
          .append('text')
          .attr('class', 'stripe-label')
          .attr('x', sx)
          .attr('y', -8)
          .attr('text-anchor', 'middle')
          .attr('fill', '#111827')
          .attr('font-size', 12)
          .attr('font-weight', '700')
          .attr('tabindex', 0)
          .attr('role', 'button')
          .attr('aria-label', t('peakLabelEditAria', stripe.x.toFixed(2)))
          .attr('title', t('peakLabelEditHint'))
          .text(`${stripe.x.toFixed(0)}`);
        const startEditing = (event) => {
          event.preventDefault();
          event.stopPropagation();
          openStripePositionEditor({
            stripe,
            stripeLabel,
            stripesLayer,
            xPosition: sx,
            chartWidth: innerW,
          });
        };
        stripeLabel
          .on('pointerdown', (event) => event.stopPropagation())
          .on('click', startEditing)
          .on('mouseenter', () => setStripeHover(stripeKey))
          .on('mouseleave', () => setStripeHover())
          .on('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            startEditing(event);
          });
      });
    }

    const seriesData = new Map();
    for (const [file, rows] of byFile) {
      const offset = offsets.get(file) || 0;
      const sorted = rows
        .slice()
        .sort((a, b) => b.x - a.x)
        .map((d) => ({ ...d, y: d.y + offset, file }));
      g.append('path').datum(sorted).attr('fill', 'none').attr('stroke', color(file)).attr('stroke-width', 1.5).attr('d', line);
      allPoints.push(...sorted);
      seriesData.set(file, sorted);
    }
    if (!BASELINE_DISABLED && baselineMap && baselineMap.size) {
      const pts = Array.from(baselineMap.entries())
        .map(([xv, yv]) => ({ x: Number(xv), y: Number(yv) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .sort((a, b) => b.x - a.x);
      if (pts.length) {
        g.append('path')
          .datum(pts)
          .attr('fill', 'none')
          .attr('stroke', '#16a34a')
          .attr('stroke-width', 1.2)
          .attr('stroke-dasharray', '6,3')
          .attr('d', line);
      }
    }
    if (!BASELINE_DISABLED && baselinePreviewModel && baselinePreviewModel.map && baselinePreviewModel.map.size) {
      const pts = Array.from(baselinePreviewModel.map.entries())
        .map(([xv, yv]) => ({ x: Number(xv), y: Number(yv) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .sort((a, b) => b.x - a.x);
      if (pts.length) {
        g.append('path')
          .datum(pts)
          .attr('fill', 'none')
          .attr('stroke', '#10b981')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3')
          .attr('opacity', 0.9)
          .attr('d', line);
      }
    }

    // points disabled by request

    if (!skipLegend) {
      chartLegend.innerHTML = '';
      for (const file of allSeries) {
        const point = lastData.find((item) => item.file === file);
        const spectrumId = point?.spectrumId || file;
        const spectrum = lastSpectra.find((item) => item.id === spectrumId);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'spectrum-tab nav-link';
        item.dataset.spectrumId = spectrumId;
        item.setAttribute('role', 'tab');
        item.setAttribute('aria-selected', String(activeSpectrumId === spectrumId));
        item.setAttribute('aria-controls', 'chart');
        if (activeSpectrumId === spectrumId) item.classList.add('active');
        if (visibleSeries.get(file) === false) item.classList.add('inactive');
        const swatch = document.createElement('div');
        swatch.className = 'legend-swatch';
        swatch.style.background = color(file);
        const label = document.createElement('span');
        label.className = 'spectrum-tab-label';
        label.textContent = customNames.get(file) || spectrum?.name || file;
        label.title = `${spectrum?.name || file} · ${spectrumId}`;
        const gearBtn = document.createElement('button');
        gearBtn.type = 'button';
        gearBtn.className = 'spectrum-settings-btn';
        gearBtn.innerHTML = '<span class="material-symbols-outlined">settings</span>';
        gearBtn.title = 'Spectrum settings';
        gearBtn.setAttribute('aria-label', `Settings for ${spectrum?.name || file}`);
        gearBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          openSpectrumSettings(spectrumId);
        });
        item.appendChild(swatch);
        item.appendChild(label);
        item.appendChild(gearBtn);
        chartLegend.appendChild(item);
      }
    }

    const marker = g.append('g').style('display', 'none');
    const markerLine = marker
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '4,4');
    const markerDots = marker.append('g');
    const markerText = marker
      .append('text')
      .attr('font-size', 12)
      .attr('y', -6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1f2937')
      .attr('font-weight', '600')
      .style('user-select', 'none');

    const applyMarker = (xVal, spectrumId = null) => {
      const clamped = clampX(xVal);
      markerActive = true;
      markerX = clamped;
      const activeSpectrumChanged = Boolean(spectrumId && activeSpectrumId !== spectrumId);
      if (spectrumId) {
        markerSpectrumId = spectrumId;
        activeSpectrumId = spectrumId;
      }
      marker.style('display', 'block');
      markerLine.attr('x1', x(clamped)).attr('x2', x(clamped));
      markerDots.selectAll('circle').remove();
      seriesData.forEach((rows, file) => {
        let nearest = null;
        let bestDx = Infinity;
        for (const point of rows) {
          const dx = Math.abs(point.x - clamped);
          if (dx < bestDx) {
            bestDx = dx;
            nearest = point;
          }
        }
        if (!nearest) return;
        markerDots
          .append('circle')
          .attr('cx', x(nearest.x))
          .attr('cy', y(nearest.y))
          .attr('r', 4)
          .attr('fill', color(file))
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.2);
      });
      markerText.attr('x', x(clamped)).text(`x = ${clamped.toFixed(2)}`);
      svg.style('cursor', measurementState ? 'crosshair' : 'col-resize');
      if (activeSpectrumChanged) {
        updateSpectrumSelector();
        updateDetectorControls();
        renderActiveReferenceSearch();
      }
      setStatus(`x=${clamped.toFixed(2)}`);
    };

    const clearZoneHighlight = () => {
      zoneRects.forEach(({ rect }) => rect.attr('fill', 'transparent'));
      if (zoneHintEl) zoneHintEl.textContent = '\u00A0';
    };

    const updateZoneHighlight = (xVal) => {
      let active = null;
      const val = Number(xVal);
      zoneRects.forEach(({ rect, zone }) => {
        const min = Math.min(zone.start, zone.end);
        const max = Math.max(zone.start, zone.end);
        const inZone = val <= max && val >= min;
        rect.attr('fill', inZone ? d3.color(zone.color).copy({ opacity: 0.18 }) : 'transparent');
        if (inZone) active = zone;
      });
      if (zoneHintEl) zoneHintEl.textContent = active ? `${active.label} (${active.end}–${active.start} cm⁻¹)` : '\u00A0';
    };

    let isDragging = false;
    svg.style('cursor', 'crosshair');

    const findNearestPointAtCursor = (px, py) => {
      let nearest = null;
      let bestDistance = Infinity;
      seriesData.forEach((rows) => {
        for (const point of rows) {
          if (activeSpectrumId && point.spectrumId !== activeSpectrumId) continue;
          const dx = x(point.x) - px;
          const dy = y(point.y) - py;
          const distance = dx * dx + dy * dy;
          if (distance < bestDistance) {
            bestDistance = distance;
            nearest = point;
          }
        }
      });
      return nearest;
    };

    const handlePointer = (event) => {
      const [px, py] = d3.pointer(event, g.node());
      if (px < 0 || px > innerW || py < 0 || py > innerH) return;
      const xVal = x.invert(px);
      if (measurementState) {
        applyMarker(xVal, measurementState.spectrumId);
        measureStripeFromChart(xVal);
        return;
      }
      const nearest = findNearestPointAtCursor(px, py);
      applyMarker(xVal, nearest?.spectrumId || null);
      updateZoneHighlight(xVal);
    };

    const handleHover = (event) => {
      const [px, py] = d3.pointer(event, g.node());
      if (px < 0 || px > innerW || py < 0 || py > innerH) {
        clearZoneHighlight();
        return;
      }
      const xVal = x.invert(px);
      updateZoneHighlight(xVal);
    };

    const isPanEvent = (evt) => evt.button === 1 || evt.buttons === 4;

    svg.on('contextmenu', (e) => e.preventDefault());

    svg.on('wheel.chartZoom', (event) => {
      // Keep ordinary wheel scrolling available for the page. Hold Ctrl on
      // Windows/Linux or Cmd on macOS to zoom the chart around the cursor.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const [px, py] = d3.pointer(event, g.node());
      if (px < 0 || px > innerW || py < 0 || py > innerH) return;
      const factor = event.deltaY > 0 ? 1.12 : 0.88;
      applyZoom(factor, x.invert(px), y.invert(py), { x: true, y: true });
    });

    svg.on('pointerdown', (event) => {
      const [px, py] = d3.pointer(event, g.node());
      if (isPanEvent(event)) {
        const viewport = getChartViewport(yDomainAuto);
        isPanning = true;
        panStartDomain = {
          x: x.invert(px),
          y: y.invert(py),
          xMin: viewport.xMin,
          xMax: viewport.xMax,
          yMin: viewport.yMin,
          yMax: viewport.yMax,
        };
        svg.style('cursor', 'grab');
        return;
      }
      if (measurementState) {
        isDragging = false;
        return;
      }
      handlePointer(event);
      isDragging = true;
    });
    svg.on('pointermove', (event) => {
      const [px, py] = d3.pointer(event, g.node());
      if (isPanning) {
        const currentX = x.invert(px);
        const currentY = y.invert(py);
        const dx = currentX - panStartDomain.x;
        const dy = currentY - panStartDomain.y;
        let newXMin = panStartDomain.xMin - dx;
        let newXMax = panStartDomain.xMax - dx;
        let newYMin = panStartDomain.yMin - dy;
        let newYMax = panStartDomain.yMax - dy;
        const navigationBounds = getNavigationBounds(yDomainAuto);
        [newXMin, newXMax] = clampViewport(
          newXMin,
          newXMax,
          navigationBounds.xMin,
          navigationBounds.xMax,
        );
        [newYMin, newYMax] = clampViewport(
          newYMin,
          newYMax,
          navigationBounds.yMin,
          navigationBounds.yMax,
        );
        panQueued = { newXMin, newXMax, newYMin, newYMax };
        if (!panRaf) {
          panRaf = requestAnimationFrame(() => {
            if (panQueued) {
              const { newXMin: qMinX, newXMax: qMaxX, newYMin: qMinY, newYMax: qMaxY } = panQueued;
              chartViewport = {
                xMin: qMinX,
                xMax: qMaxX,
                yMin: qMinY,
                yMax: qMaxY,
              };
              if (chartNavigationBounds.yMin === null && chartNavigationBounds.yMax === null) {
                chartYViewportActive = true;
              }
              renderChartFromData(lastData, { skipLegend: true });
            }
            panQueued = null;
            panRaf = null;
          });
        }
        return;
      }
      if (isDragging) {
        handlePointer(event);
      } else {
        handleHover(event);
      }
    });
    svg.on('pointerup pointerleave pointercancel', () => {
      isDragging = false;
      if (isPanning) {
        isPanning = false;
        panStartDomain = null;
        if (lastData) {
          renderChartFromData(lastData, { skipLegend: true });
        }
        if (panRaf) {
          cancelAnimationFrame(panRaf);
          panRaf = null;
          panQueued = null;
        }
      }
      svg.style('cursor', 'crosshair');
      clearZoneHighlight();
    });

    svg.on('click', (event) => {
      if (event.detail === 2 && !measurementState) return; // let dblclick handle it outside measurement mode
      if (event.ctrlKey) return;
      handlePointer(event);
    });

    svg.on('dblclick', (event) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      if (measurementState) return;
      handlePointer(event);
      if (addStripeBtn) {
        addStripeBtn.click();
      }
    });

    const handleKeyPan = (event) => {
      if (!lastData) return;
      const key = event.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
      event.preventDefault();
      const navigationBounds = getNavigationBounds(yDomainAuto);
      const viewport = getChartViewport(yDomainAuto);
      const baseXMin = navigationBounds.xMin;
      const baseXMax = navigationBounds.xMax;
      const xSpan = Math.abs(viewport.xMax - viewport.xMin) || Math.abs(baseXMax - baseXMin);
      const ySpanCurrent = Math.abs(viewport.yMax - viewport.yMin) || Math.abs(navigationBounds.yMax - navigationBounds.yMin) || 1;
      const stepX = xSpan * 0.05;
      const stepY = ySpanCurrent * 0.05;
      let currXMin = viewport.xMin;
      let currXMax = viewport.xMax;
      let currYMin = viewport.yMin;
      let currYMax = viewport.yMax;
      if (key === 'ArrowLeft') {
        [currXMin, currXMax] = clampViewport(currXMin + stepX, currXMax + stepX, baseXMin, baseXMax);
      }
      if (key === 'ArrowRight') {
        [currXMin, currXMax] = clampViewport(currXMin - stepX, currXMax - stepX, baseXMin, baseXMax);
      }
      if (key === 'ArrowUp') {
        [currYMin, currYMax] = clampViewport(currYMin + stepY, currYMax + stepY, navigationBounds.yMin, navigationBounds.yMax);
      }
      if (key === 'ArrowDown') {
        [currYMin, currYMax] = clampViewport(currYMin - stepY, currYMax - stepY, navigationBounds.yMin, navigationBounds.yMax);
      }
      chartViewport = {
        xMin: currXMin,
        xMax: currXMax,
        yMin: currYMin,
        yMax: currYMax,
      };
      if ((key === 'ArrowUp' || key === 'ArrowDown')
        && chartNavigationBounds.yMin === null && chartNavigationBounds.yMax === null) {
        chartYViewportActive = true;
      }
      renderChartFromData(lastData, { skipLegend: true });
    };
    svg.on('keydown', handleKeyPan);

    markerUpdater = (direction) => {
      if (!markerActive || markerX === null) return;
      const delta = typeof direction === 'number' ? direction : 0;
      applyMarker(markerX + delta);
    };

    if (markerActive && markerX !== null) {
      applyMarker(markerX);
    }
    clearZoneHighlight();

    chartEl.innerHTML = '';
    chartEl.appendChild(svg.node());
    renderStripesTable();
  }

  function tipsForX(xVal) {
    if (!peakDb.length || !Number.isFinite(xVal)) return [];
    return peakDb.filter((p) => xVal >= p.start && xVal <= p.end);
  }

  function processFiles(payloadFiles, opts = {}) {
    clientLog('files.process.start', {
      files: payloadFiles.map((file) => ({ name: file.name, bytes: file.content?.length || 0 })),
      restoringSession: Boolean(opts.detectorProcessedBySpectrum || opts.stripeSets),
    });
    const downloadName = opts.fileName || fileNameInput.value.trim() || 'merged.csv';
    const columns = [];
    const table = new Map();
    const spectra = [];
    const spectrumIds = new Set();
    const spectrumIdByColumn = new Map();
    let totalRows = 0;
    const failedFiles = [];
    const addSpectrum = (name, sourceFile, points, columnName) => {
      const validPoints = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
      if (!validPoints.length) return null;
      const spectrumId = makeUniqueSpectrumId(spectrumIds, `${sourceFile || name}-${columnName || ''}`);
      spectra.push({
        id: spectrumId,
        name: name || columnName || 'spectrum',
        sourceFile: sourceFile || name || columnName || 'spectrum',
        role: spectrumRoles.get(spectrumId) || 'unknown',
        signalType: 'unknown',
        xUnit: 'cm-1',
        points: validPoints.map(([x, y]) => [Number(x), Number(y)]),
      });
      if (columnName) spectrumIdByColumn.set(columnName, spectrumId);
      return spectrumId;
    };
    payloadFiles.forEach((file) => {
      const parsed = parseSpectraContent(file.content, file.name);
      if (parsed && parsed.type === 'csv') {
        const { xKey, columns: csvCols, rows } = parsed;
        csvCols.forEach((csvCol) => {
          const colName = makeUniqueColumnName(columns, csvCol);
          let added = 0;
          const points = [];
          rows.forEach((row) => {
            const x = row[xKey];
            const y = row[csvCol];
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            points.push([Number(x), Number(y)]);
            const key = String(x);
            if (!table.has(key)) table.set(key, { x: Number(x), vals: new Map() });
            table.get(key).vals.set(colName, y);
            added++;
          });
          addSpectrum(csvCol, file.name, points, colName);
          totalRows += added;
          if (!added) failedFiles.push(`${file.name || colName} (${csvCol})`);
        });
        return;
      }
      const rows = Array.isArray(parsed) ? parsed : [];
      if (!rows.length) {
        if ((file.name || '').toLowerCase().endsWith('.jcm')) {
          failedFiles.push(`${file.name || 'file'} (packed JCM not supported yet)`);
        } else {
          failedFiles.push(file.name || 'file');
        }
        return;
      }
      const col = makeUniqueColumnName(columns, file.name);
      totalRows += rows.length;
      const points = [];
      for (const [x, y] of rows) {
        const key = String(x);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        points.push([Number(x), Number(y)]);
        if (!table.has(key)) table.set(key, { x: Number(x), vals: new Map() });
        table.get(key).vals.set(col, y);
      }
      addSpectrum(file.name, file.name, points, col);
    });

    const header = ['wavenumber', ...columns];
    const sorted = Array.from(table.values()).sort((a, b) => b.x - a.x);
    const lines = [header.join(',')];
    for (const row of sorted) {
      lines.push([row.x, ...columns.map((c) => (row.vals.has(c) ? row.vals.get(c) : ''))].join(','));
    }

    const csvText = lines.join('\n');

    const parsed = d3.csvParse(csvText, d3.autoType);
    const cols = parsed.columns.map((c) => c.trim()).filter((c) => c && c !== 'wavenumber');
    if (!cols.length) {
      const msg = failedFiles.length ? `Failed to import: ${failedFiles.join(', ')}` : t('statusNoDataCols');
      setStatus(msg, true);
      return;
    }
    lastParsedRows = parsed;
    lastColumns = cols;
    lastSpectra = spectra;
    const series = [];
    for (const col of cols) {
      for (const row of parsed) {
        if (typeof row[col] === 'number' && typeof row.wavenumber === 'number') {
          series.push({ file: col, spectrumId: spectrumIdByColumn.get(col) || col, x: row.wavenumber, y: row[col] });
        }
      }
    }
    if (!series.length) {
      setStatus(t('statusNoNumeric'), true);
      return;
    }
    lastData = series;
    detectorProcessedBySpectrum = new Map(Object.entries(opts.detectorProcessedBySpectrum || {}));
    detectorAppliedSettings = new Map(Object.entries(opts.detectorAppliedSettings || {}));
    lastPeakProcessing = null;
    if (openPeakProcessingBtn) openPeakProcessingBtn.disabled = true;
    defaultYRange = computeAdjustedExtent(series) || d3.extent(series, (d) => d.y);
    stripeSets = opts.stripeSets || stripeSets;
    if (!stripeSets[activeStripeSet]) stripeSets[activeStripeSet] = [];
    const defaultSpectrumId = lastSpectra[0]?.id || null;
    Object.keys(stripeSets).forEach((setId) => {
      stripeSets[setId] = (stripeSets[setId] || []).map((stripe, index) => ({
        ...stripe,
        spectrumId: stripe.spectrumId || defaultSpectrumId,
        peakId: stripe.peakId || stripe.id || `peak-${setId}-${index + 1}`,
      }));
    });
    markerSpectrumId = opts.markerSpectrumId !== undefined ? opts.markerSpectrumId : defaultSpectrumId;
    activeSpectrumId = opts.activeSpectrumId || markerSpectrumId || defaultSpectrumId;
    lastPeakProcessing = detectorProcessedBySpectrum.get(activeSpectrumId) || null;
    clientLog('files.process.complete', {
      spectra: lastSpectra.map((spectrum) => ({ id: spectrum.id, name: spectrum.name, points: spectrum.points.length })),
      columns: cols,
      rows: parsed.length,
      dataPoints: series.length,
      activeSpectrumId,
      restoredProcessedSpectra: detectorProcessedBySpectrum.size,
      failedFiles,
    });
    const activeDetectorSettings = detectorAppliedSettings.get(activeSpectrumId);
    if (activeDetectorSettings) {
      if (detectorBaselineMethod && activeDetectorSettings.baselineMethod) detectorBaselineMethod.value = activeDetectorSettings.baselineMethod;
      if (detectorSignalType && activeDetectorSettings.signalType) detectorSignalType.value = activeDetectorSettings.signalType;
    }
    baselinePreviewModel = null;
    baselineModel = opts.baselineModel || null;
    baselineSeries = opts.baselineSeries || null;
    baselineMap = new Map();
    if (baselineSeries && baselineModel?.coeffs) {
      const rebuiltBaseline = buildBaselinePoly(baselineSeries, Number(baselineModel.degree) || 2);
      if (rebuiltBaseline) {
        baselineModel = rebuiltBaseline;
        baselineMap = rebuiltBaseline.map;
      }
    }
    offsets = new Map();
    cols.forEach((col) => offsets.set(col, (opts.offsets && opts.offsets[col]) || 0));
    customNames = new Map(Object.entries(opts.customNames || {}));
    updateSpectrumSelector();
    if (opts.visibleSeries) {
      Object.entries(opts.visibleSeries).forEach(([k, v]) => visibleSeries.set(k, v));
    }
    cols.forEach((col) => {
      if (!visibleSeries.has(col)) visibleSeries.set(col, true);
    });
    updateBaselineSelectOptions(cols);
    fileNameInput.value = downloadName;
    if (sampleInput && opts.sampleIndex !== undefined) sampleInput.value = opts.sampleIndex;
    if (opts.xRange) {
      xMaxInput.value = opts.xRange.max ?? xMaxInput.value;
      xMinInput.value = opts.xRange.min ?? xMinInput.value;
    }
    if (opts.yRange) {
      yMinInput.value = opts.yRange.min ?? '';
      yMaxInput.value = opts.yRange.max ?? '';
    }
    if (opts.chartBounds) setNavigationBounds(opts.chartBounds);
    const hasFixedYBounds = chartNavigationBounds.yMin !== null && chartNavigationBounds.yMax !== null;
    const requestedYViewport = opts.yViewportActive === true;
    const inputYMin = finiteNumber(yMinInput.value);
    const inputYMax = finiteNumber(yMaxInput.value);
    if (!hasFixedYBounds && (inputYMin === null || inputYMax === null || inputYMin === inputYMax)) {
      // Equal/partial saved values cannot form an axis range. In particular,
      // this recovers sessions created before Y viewport state was explicit.
      yMinInput.value = '';
      yMaxInput.value = '';
      chartNavigationBounds.yMin = null;
      chartNavigationBounds.yMax = null;
    }
    if (opts.viewport) {
      setChartViewport(opts.viewport, defaultYRange, { restoreY: requestedYViewport });
    } else if (opts.chartBounds) {
      setChartViewport(opts.chartBounds, defaultYRange, { restoreY: requestedYViewport });
    }
    if (yMinInput.value === '' && yMaxInput.value === ''
      && chartNavigationBounds.yMin === null && chartNavigationBounds.yMax === null) {
      if (!requestedYViewport) {
        chartViewport.yMin = null;
        chartViewport.yMax = null;
      }
      chartYViewportActive = requestedYViewport
        && finiteNumber(chartViewport.yMin) !== null
        && finiteNumber(chartViewport.yMax) !== null
        && chartViewport.yMin !== chartViewport.yMax;
    }
    downloadLinkEl.textContent = '';
    if (failedFiles.length) {
      setStatus(`Imported with issues. Failed: ${failedFiles.join(', ')}`, true);
    } else {
      setStatus(t('statusReadyToSave'));
    }
    setControlsEnabled(true);
    renderChartFromData(lastData);
    renderStripesTable();
    renderActiveReferenceSearch();
    scheduleLocalSave();
  }

  function downsamplePoints(arr, maxPoints = 1500) {
    if (!Array.isArray(arr) || arr.length <= maxPoints) return arr || [];
    const step = Math.ceil(arr.length / maxPoints);
    const out = [];
    for (let i = 0; i < arr.length; i += step) {
      out.push(arr[i]);
    }
    return out;
  }

  function updateSpectrumSelector() {
    if (!lastSpectra.length) {
      if (peaksSpectrumTitle) peaksSpectrumTitle.textContent = 'No spectrum selected';
      if (chartLegend) chartLegend.innerHTML = '';
      return;
    }
    const ids = new Set(lastSpectra.map((spectrum) => spectrum.id));
    if (!ids.has(activeSpectrumId)) activeSpectrumId = lastSpectra[0].id;
    if (!ids.has(markerSpectrumId)) markerSpectrumId = activeSpectrumId;
    const selected = lastSpectra.find((spectrum) => spectrum.id === activeSpectrumId);
    const selectedPoint = lastData?.find((point) => point.spectrumId === activeSpectrumId);
    const displayName = selectedPoint ? customNames.get(selectedPoint.file) : null;
    if (peaksSpectrumTitle) peaksSpectrumTitle.textContent = `${displayName || selected?.name || activeSpectrumId} · ${activeSpectrumId}`;
  }

  function updateDetectorControls() {
    const hasActiveSpectrum = Boolean(lastData?.length && activeSpectrumId);
    const applied = detectorAppliedSettings.get(activeSpectrumId);
    const selectedMethod = detectorBaselineMethod?.value || 'arpls';
    const selectedSignalType = detectorSignalType?.value || 'unknown';
    const hasAppliedBaseline = Boolean(
      applied && applied.baselineMethod === selectedMethod && applied.signalType === selectedSignalType
    );
    if (openPeakSettingsBtn) openPeakSettingsBtn.disabled = !hasActiveSpectrum;
    if (detectPeaksBtn && !detectPeaksBtn.dataset.busy) detectPeaksBtn.disabled = !hasActiveSpectrum;
    if (openPeakProcessingBtn) {
      openPeakProcessingBtn.disabled = !hasActiveSpectrum || !lastPeakProcessing || lastPeakProcessing.spectrumId !== activeSpectrumId;
    }
    if (detectorBaselineSummary) {
      detectorBaselineSummary.textContent = `${t('detectorBaseline')}: ${hasAppliedBaseline ? selectedMethod.toUpperCase() : t('detectorRawMode')}`;
      detectorBaselineSummary.classList.toggle('is-applied', hasAppliedBaseline);
    }
    updateReferenceSearchControls();
  }

  function updateReferenceSearchControls() {
    if (!searchLocalReferencesBtn) return;
    searchLocalReferencesBtn.hidden = !referenceSearchEnabled;
    if (!searchLocalReferencesBtn.dataset.busy) {
      searchLocalReferencesBtn.disabled = !referenceSearchEnabled || !activeSpectrumId || !lastSpectra.length;
    }
  }

  function setActiveSpectrum(spectrumId) {
    if (!spectrumId || !lastSpectra.some((spectrum) => spectrum.id === spectrumId)) return;
    const previousSpectrumId = activeSpectrumId;
    activeSpectrumId = spectrumId;
    markerSpectrumId = spectrumId;
    lastPeakProcessing = detectorProcessedBySpectrum.get(spectrumId) || null;
    clientLog('spectrum.active.changed', {
      from: previousSpectrumId,
      to: spectrumId,
      hasProcessedBaseline: Boolean(lastPeakProcessing),
      candidatePeaks: (stripeSets.candidates || []).filter((stripe) => stripe.spectrumId === spectrumId).length,
      confirmedPeaks: (stripeSets.confirmed || []).filter((stripe) => stripe.spectrumId === spectrumId).length,
    });
    if (detectorBaselineMethod && detectorAppliedSettings.has(spectrumId)) {
      detectorBaselineMethod.value = detectorAppliedSettings.get(spectrumId).baselineMethod || detectorBaselineMethod.value;
      if (detectorSignalType) detectorSignalType.value = detectorAppliedSettings.get(spectrumId).signalType || detectorSignalType.value;
    }
    updateDetectorControls();
    if (openPeakProcessingBtn) {
      openPeakProcessingBtn.disabled = !lastPeakProcessing || lastPeakProcessing.spectrumId !== spectrumId;
    }
    updateSpectrumSelector();
    renderChartFromData(lastData);
    renderStripesTable();
    renderActiveReferenceSearch();
    scheduleLocalSave();
  }

  function spectrumColumn(spectrumId) {
    return lastData?.find((point) => point.spectrumId === spectrumId)?.file || null;
  }

  function openSpectrumSettings(spectrumId) {
    const spectrum = lastSpectra.find((item) => item.id === spectrumId);
    const column = spectrumColumn(spectrumId);
    if (!spectrum || !spectrumSettingsDialog) return;
    spectrumSettingsId.value = spectrumId;
    spectrumSettingsTitle.textContent = spectrum.name || spectrumId;
    spectrumSettingsName.value = customNames.get(column) || spectrum.name || spectrumId;
    spectrumSettingsOffset.value = offsets.get(column) || 0;
    spectrumSettingsRole.value = spectrum.role || spectrumRoles.get(spectrumId) || 'unknown';
    spectrumSettingsDialog.showModal();
  }

  function closeSpectrumSettings() {
    if (spectrumSettingsDialog?.open) spectrumSettingsDialog.close();
  }

  function buildPeakDetectionPayload(options = {}) {
    const spectrumId = options.spectrumId || activeSpectrumId;
    const selectedSignalType = detectorSignalType?.value;
    const selectedBaselineMethod = detectorBaselineMethod?.value || 'arpls';
    const forcedBaselineMethod = options.baselineMethodOverride || null;
    const appliedBaseline = detectorAppliedSettings.get(spectrumId);
    const baselineIsCurrent = appliedBaseline
      && appliedBaseline.baselineMethod === selectedBaselineMethod
      && appliedBaseline.signalType === (selectedSignalType || 'unknown');
    const viewport = getChartViewport(computeAdjustedExtent(lastData) || [0, 1]);
    const searchRangeCm1 = {
      min: Math.min(viewport.xMin, viewport.xMax),
      max: Math.max(viewport.xMin, viewport.xMax),
    };
    const targetSpectra = options.allSpectra
      ? lastSpectra
      : lastSpectra.filter((spectrum) => spectrum.id === spectrumId);
    const manualPositions = Array.isArray(options.manualPositions)
      ? options.manualPositions.map(Number).filter(Number.isFinite)
      : [];
    const settings = {
      smoothingMethod: 'moving_average',
      smoothingWindow: Math.max(1, Number(detectorSmoothingWindow?.value) || 5),
      // An unapplied baseline selection must not silently affect detection.
      // It remains a raw search until the user presses Apply baseline.
      baselineMethod: forcedBaselineMethod || (baselineIsCurrent ? selectedBaselineMethod : 'none'),
      baselineLambda: 1000000,
      baselineAsymmetry: 0.01,
      baselineSnipWindowCm1: 80,
      broadProminenceWindowCm1: 800,
      broadSmoothingWindow: 31,
      broadMinSeparationCm1: 180,
      broadBaselineMethod: 'linear',
      crossEngineMergeCm1: 20,
      minProminence: Math.max(0, Number(detectorMinProminence?.value) || 0),
      minSeparationCm1: Math.max(0.1, Number(detectorMinSeparation?.value) || 8),
      maxPeaks: 300,
      searchRangeCm1,
    };
    if (manualPositions.length && spectrumId) {
      settings.manualPositionsBySpectrum = { [spectrumId]: manualPositions };
      settings.manualSnapCm1 = 18;
    }
    return {
      schemaVersion: '2.0',
      spectra: targetSpectra.map((spectrum) => ({
        id: spectrum.id,
        name: spectrum.name,
        sourceFile: spectrum.sourceFile,
        role: spectrum.role || spectrumRoles.get(spectrum.id) || 'unknown',
        signalType: selectedSignalType && selectedSignalType !== 'unknown'
          ? selectedSignalType
          : spectrum.signalType || 'unknown',
        xUnit: spectrum.xUnit || 'cm-1',
        points: spectrum.points,
      })),
      settings,
    };
  }

  async function requestPeakProcessing(options = {}) {
    const payload = buildPeakDetectionPayload(options);
    const spectrumId = options.spectrumId || activeSpectrumId;
    const requestStartedAt = performance.now();
    const payloadSummary = {
      schemaVersion: payload.schemaVersion,
      spectrumId,
      spectra: payload.spectra.map((spectrum) => ({ id: spectrum.id, points: spectrum.points.length })),
      baselineMethod: payload.settings.baselineMethod,
      signalType: payload.spectra[0]?.signalType || 'unknown',
      smoothingWindow: payload.settings.smoothingWindow,
      minProminence: payload.settings.minProminence,
      minSeparationCm1: payload.settings.minSeparationCm1,
      searchRangeCm1: payload.settings.searchRangeCm1,
      allSpectra: Boolean(options.allSpectra),
    };
    clientLog('peak.request.start', { url: peakDetectionApi, ...payloadSummary });
    setDetectorConnectionStatus('');
    let response;
    try {
      response = await fetch(peakDetectionApi, {
        method: 'POST',
        headers: apiRequestHeaders(),
        credentials: apiCredentials,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      clientError('peak.request.network_error', {
        url: peakDetectionApi,
        name: error.name,
        message: error.message,
        durationMs: Math.round(performance.now() - requestStartedAt),
        hint: 'Check Tunnel route, Access login, CORS and browser network errors.',
      });
      setDetectorConnectionStatus(`${t('detectorConnectionError')} (${error.message})`);
      throw error;
    }
    const body = await response.json().catch(() => ({}));
    clientLog('peak.request.response', {
      url: peakDetectionApi,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      durationMs: Math.round(performance.now() - requestStartedAt),
      returnedSpectra: Array.isArray(body.processing) ? body.processing.map((item) => item.spectrumId) : [],
      returnedPeaks: Array.isArray(body.peakObservations) ? body.peakObservations.length : null,
      engine: body.engine || null,
      error: body.error || null,
    });
    if (!response.ok) {
      setDetectorConnectionStatus(`${t('detectorConnectionError')} HTTP ${response.status}${body.error ? `: ${body.error}` : ''}`);
      throw new Error(body.error || `Peak detection failed (${response.status})`);
    }
    setDetectorConnectionStatus('');
    const processing = Array.isArray(body.processing)
      ? body.processing.find((item) => item.spectrumId === spectrumId)
      : null;
    if (!processing) {
      setDetectorConnectionStatus(t('detectorConnectionError'));
      throw new Error('The server returned no processing data for the active spectrum.');
    }
    return { payload, body, processing, spectrumId };
  }

  let baselinePreviewRequest = 0;
  let baselineApplyRequest = 0;
  async function previewPeakBaseline() {
    if (!activeSpectrumId || !lastData?.length || !peakProcessingChart) return;
    const spectrumId = activeSpectrumId;
    const requestId = ++baselinePreviewRequest;
    clientLog('baseline.preview.start', {
      spectrumId,
      method: detectorBaselineMethod?.value || 'arpls',
      signalType: detectorSignalType?.value || 'unknown',
    });
    if (peakProcessingMeta) peakProcessingMeta.textContent = t('detectorPreviewing');
    peakProcessingChart.textContent = t('detectorPreviewing');
    try {
      const { processing } = await requestPeakProcessing({
        baselineMethodOverride: detectorBaselineMethod?.value || 'arpls',
        spectrumId,
      });
      if (requestId !== baselinePreviewRequest) return;
      clientLog('baseline.preview.complete', {
        spectrumId,
        method: processing?.baselineMethod,
        engine: processing?.baselineEngine,
        diagnostics: processing?.diagnostics?.x?.length || 0,
      });
      renderPeakProcessingDiagnostics(processing, { compact: true });
    } catch (error) {
      if (requestId !== baselinePreviewRequest) return;
      clientError('baseline.preview.error', { spectrumId, name: error.name, message: error.message });
      peakProcessingChart.textContent = error.message || t('detectorUnavailable');
      if (peakProcessingMeta) peakProcessingMeta.textContent = t('detectorUnavailable');
    }
  }

  async function applyPeakBaseline() {
    if (!activeSpectrumId || !lastData?.length) return;
    const spectrumId = activeSpectrumId;
    const requestId = ++baselineApplyRequest;
    const selectedBaselineMethod = detectorBaselineMethod?.value || 'arpls';
    const selectedSignalType = detectorSignalType?.value || 'unknown';
    clientLog('baseline.apply.start', {
      spectrumId,
      method: selectedBaselineMethod,
      signalType: selectedSignalType,
      spectraCount: lastSpectra.length,
    });
    if (applyPeakBaselineBtn) applyPeakBaselineBtn.disabled = true;
    if (detectorStatus) detectorStatus.textContent = t('detectorApplying');
    try {
      const { body, processing } = await requestPeakProcessing({
        baselineMethodOverride: selectedBaselineMethod,
        spectrumId,
        allSpectra: true,
      });
      const processedItems = Array.isArray(body.processing) ? body.processing : [];
      clientLog('baseline.apply.response', {
        spectrumId,
        processedSpectra: processedItems.map((item) => ({
          spectrumId: item.spectrumId,
          method: item.baselineMethod,
          engine: item.baselineEngine,
          diagnostics: item.diagnostics?.x?.length || 0,
        })),
      });
      processedItems.forEach((item) => {
        if (!item?.spectrumId) return;
        detectorProcessedBySpectrum.set(item.spectrumId, item);
        detectorAppliedSettings.set(item.spectrumId, {
          baselineMethod: selectedBaselineMethod,
          signalType: selectedSignalType,
        });
      });
      // Applying a baseline is scoped to the spectrum that was selected when
      // the request started. A redraw must never leave the UI on a different
      // spectrum because another async handler changed the global selection.
      if (requestId !== baselineApplyRequest) return;
      if (activeSpectrumId !== spectrumId) {
        activeSpectrumId = spectrumId;
        markerSpectrumId = spectrumId;
        updateSpectrumSelector();
      }
      lastPeakProcessing = detectorProcessedBySpectrum.get(activeSpectrumId) || null;
      updateDetectorControls();
      renderChartFromData(lastData);
      if (peakDetectorSettingsDialog?.open) peakDetectorSettingsDialog.close();
      setStatus(t('detectorApplied'));
      if (detectorStatus) detectorStatus.textContent = `${t('detectorReady')} · ${processing.baselineMethod}/${processing.baselineEngine || 'baseline'}`;
      clientLog('baseline.apply.complete', {
        selectedSpectrumId: activeSpectrumId,
        processedSpectra: detectorProcessedBySpectrum.size,
      });
    } catch (error) {
      clientError('baseline.apply.error', {
        spectrumId,
        name: error.name,
        message: error.message,
      });
      if (detectorStatus) detectorStatus.textContent = error.message || t('detectorUnavailable');
      setStatus(t('detectorUnavailable'), true);
    } finally {
      if (applyPeakBaselineBtn) applyPeakBaselineBtn.disabled = false;
      updateDetectorControls();
    }
  }

  async function detectPeaks() {
    if (!lastSpectra.length) {
      setStatus('Load at least one spectrum before detecting peaks.', true);
      return;
    }
    const spectrumId = activeSpectrumId;
    const selectedBaselineMethod = detectorBaselineMethod?.value || 'arpls';
    const selectedSignalType = detectorSignalType?.value || 'unknown';
    const payload = buildPeakDetectionPayload();
    clientLog('peaks.detect.start', {
      spectrumId,
      method: payload.settings.baselineMethod,
      signalType: selectedSignalType,
      searchRangeCm1: payload.settings.searchRangeCm1,
      parameters: {
        minProminence: payload.settings.minProminence,
        minSeparationCm1: payload.settings.minSeparationCm1,
        smoothingWindow: payload.settings.smoothingWindow,
      },
    });
    if (detectorStatus) detectorStatus.textContent = `Detecting in ${payload.spectra.length} spectra...`;
    if (detectPeaksBtn) {
      detectPeaksBtn.disabled = true;
      detectPeaksBtn.dataset.busy = 'true';
    }
    try {
      const { body, processing: responseProcessing } = await requestPeakProcessing({ spectrumId });
      const detected = Array.isArray(body.peakObservations) ? body.peakObservations : [];
      const searchRange = payload.settings.searchRangeCm1;
      const detectedInRange = detected.filter((peak) => {
        const nu = Number(peak.nu ?? peak.wavenumber ?? peak.peak);
        return Number.isFinite(nu) && nu >= searchRange.min && nu <= searchRange.max;
      });
      const processing = responseProcessing;
      clientLog('peaks.detect.response', {
        spectrumId,
        returnedPeaks: detected.length,
        acceptedPeaks: detectedInRange.length,
        engine: body.engine || null,
        warnings: body.warnings || [],
        processing: {
          baselineMethod: processing?.baselineMethod,
          baselineEngine: processing?.baselineEngine,
          diagnostics: processing?.diagnostics?.x?.length || 0,
        },
      });
      detectorProcessedBySpectrum.set(spectrumId, processing);
      if (payload.settings.baselineMethod === 'none') {
        // A raw search must not turn an unapplied selection into an applied
        // baseline. The next parameter change should remain a raw search.
        detectorAppliedSettings.delete(spectrumId);
      } else {
        detectorAppliedSettings.set(spectrumId, {
          baselineMethod: selectedBaselineMethod,
          signalType: selectedSignalType,
        });
      }
      lastPeakProcessing = detectorProcessedBySpectrum.get(activeSpectrumId) || null;
      if (openPeakProcessingBtn) openPeakProcessingBtn.disabled = !processing?.diagnostics?.x?.length;
      const existingCandidates = stripeSets.candidates || [];
      // Re-running detection refreshes only the automatic candidates for the
      // active spectrum. Manual candidates and results from other spectra must
      // stay untouched.
      const retainedCandidates = existingCandidates.filter((stripe) => (
        stripe.source !== 'automatic' || stripe.spectrumId !== spectrumId
      ));
      stripeSets.candidates = [
        ...retainedCandidates,
        ...detectedInRange.map((peak, index) => ({
          id: peak.id || `stripe-auto-${index + 1}`,
          peakId: peak.id || `peak-auto-${index + 1}`,
          spectrumId: peak.spectrumId || spectrumId,
          x: Number(peak.nu),
          color: stripeColors[index % stripeColors.length],
          label: '',
          tip: `Automatic candidate · ${body.engine || 'detector'}`,
          labelSource: 'empty',
          source: 'automatic',
          originalNu: peak.originalNu,
          prominence: peak.prominence,
          widthCm1: peak.widthCm1,
          fwhmCm1: peak.fwhmCm1,
          intensity: Number.isFinite(Number(peak.confidence)) ? Math.round(Number(peak.confidence) * 100) : null,
          shape: peak.shape,
          qualityFlags: Array.isArray(peak.qualityFlags)
            ? peak.qualityFlags.filter((flag) => flag !== 'manual_estimate_fallback')
            : [],
          localWindow: peak.localWindow,
        })),
      ];
      activeStripeSet = 'candidates';
      if (detectorStatus) {
        const baselineInfo = processing?.baselineMethod
          ? ` · ${processing.baselineMethod}/${processing.baselineEngine || 'baseline'} · ${processing.signalType || 'unknown'}`
          : '';
        detectorStatus.textContent = `${detectedInRange.length} candidates · ${body.engine || 'detector'}${baselineInfo}`;
      }
      renderChartFromData(lastData);
      renderStripesTable();
      scheduleLocalSave();
      setStatus(`Detected ${detectedInRange.length} peaks in ${searchRange.min}–${searchRange.max} cm⁻¹.`);
      clientLog('peaks.detect.complete', {
        spectrumId,
        candidatesForSpectrum: activeSpectrumCandidates().length,
        totalCandidates: stripeSets.candidates.length,
      });
    } catch (error) {
      clientError('peaks.detect.error', { url: peakDetectionApi, spectrumId, name: error.name, message: error.message });
      if (detectorStatus) detectorStatus.textContent = error.message || 'Detector unavailable.';
      setStatus('Peak detector unavailable.', true);
    } finally {
      if (detectPeaksBtn) delete detectPeaksBtn.dataset.busy;
      updateDetectorControls();
    }
  }

  function currentStripes() {
    const stripes = stripeSets[activeStripeSet] || [];
    return activeSpectrumId ? stripes.filter((stripe) => stripe.spectrumId === activeSpectrumId) : stripes;
  }

  function activeSpectrumCandidates() {
    return activeSpectrumId
      ? (stripeSets.candidates || []).filter((stripe) => stripe.spectrumId === activeSpectrumId)
      : [];
  }

  function commitStripePosition(stripe, value) {
    const parsed = Number(String(value).trim().replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setStatus('Enter a valid peak position.', true);
      return false;
    }
    stripe.x = Number(parsed.toFixed(2));
    const previousParameters = {
      height: stripe.height,
      prominence: stripe.prominence,
      widthCm1: stripe.widthCm1,
      fwhmCm1: stripe.fwhmCm1,
      shape: stripe.shape,
      confidence: stripe.confidence,
      intensity: stripe.intensity,
    };
    // Once moved, this is a user-adjusted observation. Recalculate the
    // available local parameters for the spectrum instead of retaining values
    // measured at the detector's previous position.
    const localEstimate = estimateManualPeakParameters(stripe.x, stripe.spectrumId);
    Object.assign(stripe, localEstimate);
    // Some broad/shoulder bands have no local half-height crossing in the
    // browser estimate. Do not erase usable values while the server refines
    // the edited peak with the full detector signal.
    ['height', 'prominence', 'widthCm1', 'fwhmCm1', 'confidence', 'intensity'].forEach((field) => {
      if (!Number.isFinite(Number(localEstimate[field])) && Number.isFinite(Number(previousParameters[field]))) {
        stripe[field] = previousParameters[field];
      }
    });
    if ((!localEstimate.shape || localEstimate.shape === 'unknown') && previousParameters.shape) {
      stripe.shape = previousParameters.shape;
    }
    stripe.source = 'manual';
    stripe.manualMeasurementPending = true;
    renderChartFromData(lastData, { skipLegend: true });
    renderStripesTable();
    scheduleLocalSave();
    setStatus(`Peak moved to ${stripe.x.toFixed(2)} cm⁻¹.`);
    void measureManualPeakOnServer(stripe);
    return true;
  }

  async function measureManualPeakOnServer(stripe) {
    const spectrumId = stripe?.spectrumId;
    if (!spectrumId || !Number.isFinite(Number(stripe.x))) return;
    const requestedNu = Number(stripe.x);
    const requestVersion = Number(stripe.manualMeasurementVersion || 0) + 1;
    stripe.manualMeasurementVersion = requestVersion;
    stripe.manualMeasurementPending = true;
    clientLog('peak.manual.measure.start', { spectrumId, requestedNu });
    try {
      const { processing } = await requestPeakProcessing({
        spectrumId,
        manualPositions: [requestedNu],
      });
      if (stripe.manualMeasurementVersion !== requestVersion) return;
      const measurements = Array.isArray(processing?.manualMeasurements)
        ? processing.manualMeasurements
        : [];
      const measured = measurements.reduce((closest, item) => {
        const distance = Math.abs(Number(item?.requestedNu) - requestedNu);
        return !closest || distance < closest.distance ? { item, distance } : closest;
      }, null)?.item;
      if (!measured || !Number.isFinite(Number(measured.nu))) {
        throw new Error('The server returned no measurement for the manual peak.');
      }
      // A manual marker is the user's explicit position. The backend may snap
      // internally to a neighbouring apex to measure width/prominence, but it
      // must never move the line the user placed on the chart.
      stripe.x = requestedNu;
      Object.assign(stripe, {
        originalNu: measured.originalNu,
        height: measured.height,
        prominence: measured.prominence,
        widthCm1: measured.widthCm1,
        fwhmCm1: measured.fwhmCm1,
        shape: measured.shape,
        direction: measured.direction || 'absorption',
        confidence: measured.confidence,
        qualityFlags: Array.isArray(measured.qualityFlags) ? measured.qualityFlags : [],
        localWindow: measured.localWindow,
        source: 'manual',
      });
      stripe.manualMeasurementPending = false;
      stripe.manualMeasurementError = null;
      clientLog('peak.manual.measure.complete', {
        spectrumId,
        requestedNu,
        measuredNu: measured.nu,
        markerNu: stripe.x,
        prominence: stripe.prominence,
        widthCm1: stripe.widthCm1,
        fwhmCm1: stripe.fwhmCm1,
        shape: stripe.shape,
      });
      renderChartFromData(lastData, { skipLegend: true });
      renderStripesTable();
      scheduleLocalSave();
      setStatus(`Peak parameters measured at ${stripe.x.toFixed(2)} cm⁻¹.`);
    } catch (error) {
      // The immediate browser estimate remains useful when the optional server
      // is offline. The connection message is shown near peak search.
      clientWarn('peak.manual.measure.unavailable', {
        spectrumId,
        requestedNu,
        name: error.name,
        message: error.message,
      });
      if (stripe.manualMeasurementVersion === requestVersion) {
        stripe.manualMeasurementPending = false;
        stripe.manualMeasurementError = error.message || 'The server did not return manual peak parameters.';
        renderChartFromData(lastData, { skipLegend: true });
        renderStripesTable();
      }
    }
  }

  function openStripePositionEditor({ stripe, stripeLabel, stripesLayer, xPosition, chartWidth }) {
    if (!stripe || !stripeLabel?.node?.()) return;
    const editorWidth = 78;
    const editorX = Math.max(0, Math.min(chartWidth - editorWidth, xPosition - editorWidth / 2));
    let finished = false;
    const editor = stripesLayer
      .append('foreignObject')
      .attr('class', 'stripe-position-editor-wrap')
      .attr('x', editorX)
      .attr('y', -18)
      .attr('width', editorWidth)
      .attr('height', 25);
    const input = editor
      .append('xhtml:input')
      .attr('class', 'stripe-position-editor')
      .attr('type', 'text')
      .attr('inputmode', 'decimal')
      .attr('aria-label', t('peakLabelEditAria', stripe.x.toFixed(2)))
      .property('value', stripe.x.toFixed(2));
    const finish = (save) => {
      if (finished) return;
      finished = true;
      const nextValue = input.property('value');
      editor.remove();
      if (save) {
        commitStripePosition(stripe, nextValue);
      } else {
        stripeLabel.style('display', null);
        stripeLabel.node()?.focus();
      }
    };
    stripeLabel.style('display', 'none');
    editor
      .on('pointerdown', (event) => event.stopPropagation())
      .on('click', (event) => event.stopPropagation());
    input
      .on('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      })
      .on('blur', () => finish(true));
    requestAnimationFrame(() => {
      input.node()?.focus();
      input.node()?.select();
    });
  }

  function findNearestSpectrumPoint(xVal, spectrumId = null) {
    let nearest = null;
    let bestDistance = Infinity;
    for (const point of lastData || []) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      if (spectrumId && point.spectrumId !== spectrumId) continue;
      const distance = Math.abs(point.x - xVal);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = point;
      }
    }
    return nearest;
  }

  function medianValue(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function estimateManualPeakParameters(centerX, spectrumId) {
    const spectrum = lastSpectra.find((item) => item.id === spectrumId);
    const points = (lastData || [])
      .filter((point) => point.spectrumId === spectrumId && Number.isFinite(point.x) && Number.isFinite(point.y))
      .map((point) => ({ x: Number(point.x), rawY: Number(point.y) }))
      .sort((a, b) => a.x - b.x);
    if (!points.length) return {};

    const requestedType = detectorSignalType?.value || spectrum?.signalType || 'unknown';
    const minRaw = Math.min(...points.map((point) => point.rawY));
    const maxRaw = Math.max(...points.map((point) => point.rawY));
    const isTransmittance = requestedType === 'transmittance'
      || (requestedType === 'unknown' && minRaw >= -1e-6 && maxRaw <= 110 && (maxRaw > 20 || maxRaw - minRaw > 5));
    const toAbsorption = (rawY) => {
      if (!isTransmittance) return rawY;
      const transmittance = rawY * (maxRaw <= 2 ? 100 : 1);
      return Math.log10(100 / Math.max(transmittance, 1e-9));
    };
    const signalValues = points.map((point) => toAbsorption(point.rawY));
    const globalBaseline = medianValue(signalValues);
    const nearestIndex = points.reduce((best, point, index) => (
      Math.abs(point.x - centerX) < Math.abs(points[best].x - centerX) ? index : best
    ), 0);
    const fallbackParameters = (flags = []) => {
      const fallbackHeight = Number.isFinite(globalBaseline)
        ? Math.max(0, signalValues[nearestIndex] - globalBaseline)
        : 0;
      const fallbackRange = Math.max(...signalValues) - Math.min(...signalValues);
      return {
        originalNu: points[nearestIndex].x,
        height: Number(fallbackHeight.toFixed(6)),
        prominence: Number(fallbackHeight.toFixed(6)),
        widthCm1: null,
        fwhmCm1: null,
        shape: 'unknown',
        direction: 'absorption',
        confidence: fallbackRange > 0 ? Number(Math.min(1, Math.max(0, fallbackHeight / fallbackRange)).toFixed(4)) : 0,
        intensity: fallbackRange > 0 ? Math.round(Math.min(100, Math.max(0, (fallbackHeight / fallbackRange) * 100))) : 0,
        qualityFlags: flags,
      };
    };
    const xSteps = points.slice(1).map((point, index) => Math.abs(point.x - points[index].x)).filter((step) => step > 0);
    const xStep = medianValue(xSteps) || 1;
    const halfWindow = Math.max(160, Math.min(700, xStep * 160));
    const local = points
      .filter((point) => Math.abs(point.x - centerX) <= halfWindow)
      .map((point) => ({ ...point, signal: toAbsorption(point.rawY) }));
    if (local.length < 5) return fallbackParameters();

    const clickIndex = local.reduce((best, point, index) => (
      Math.abs(point.x - centerX) < Math.abs(local[best].x - centerX) ? index : best
    ), 0);
    const apexWindow = Math.max(10, Math.min(45, xStep * 8));
    const apexCandidates = local
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => Math.abs(point.x - local[clickIndex].x) <= apexWindow);
    const centerIndex = (apexCandidates.length ? apexCandidates : [{ point: local[clickIndex], index: clickIndex }])
      .reduce((best, candidate) => candidate.point.signal > best.point.signal ? candidate : best)
      .index;
    const edgeCount = Math.max(2, Math.floor(local.length * 0.12));
    const leftBaseline = medianValue(local.slice(0, edgeCount).map((point) => point.signal));
    const rightBaseline = medianValue(local.slice(-edgeCount).map((point) => point.signal));
    if (!Number.isFinite(leftBaseline) || !Number.isFinite(rightBaseline)) return fallbackParameters();
    const firstX = local[0].x;
    const lastX = local[local.length - 1].x;
    const baselineAt = (xValue) => {
      const fraction = lastX === firstX ? 0 : (xValue - firstX) / (lastX - firstX);
      return leftBaseline + (rightBaseline - leftBaseline) * fraction;
    };
    local.forEach((point) => {
      point.baseline = baselineAt(point.x);
      point.excess = point.signal - point.baseline;
    });

    const center = local[centerIndex];
    const peakHeight = center.excess;
    if (!Number.isFinite(peakHeight) || peakHeight <= 0) return fallbackParameters();
    const leftShoulder = Math.min(...local.slice(0, centerIndex + 1).map((point) => point.signal));
    const rightShoulder = Math.min(...local.slice(centerIndex).map((point) => point.signal));
    const prominence = Math.max(0, center.signal - Math.max(leftShoulder, rightShoulder, center.baseline));
    const halfLevel = peakHeight / 2;
    let leftCrossing = null;
    for (let index = centerIndex; index > 0; index -= 1) {
      if (local[index - 1].excess <= halfLevel && local[index].excess >= halfLevel) {
        const previous = local[index - 1];
        const current = local[index];
        const fraction = current.excess === previous.excess ? 0 : (halfLevel - previous.excess) / (current.excess - previous.excess);
        leftCrossing = previous.x + (current.x - previous.x) * fraction;
        break;
      }
    }
    let rightCrossing = null;
    for (let index = centerIndex; index < local.length - 1; index += 1) {
      if (local[index].excess >= halfLevel && local[index + 1].excess <= halfLevel) {
        const current = local[index];
        const next = local[index + 1];
        const fraction = next.excess === current.excess ? 0 : (halfLevel - current.excess) / (next.excess - current.excess);
        rightCrossing = current.x + (next.x - current.x) * fraction;
        break;
      }
    }
    const width = Number.isFinite(leftCrossing) && Number.isFinite(rightCrossing)
      ? Math.abs(rightCrossing - leftCrossing)
      : null;
    const shape = width === null ? 'unknown' : width <= 20 ? 'sharp' : width >= 80 ? 'broad' : 'band';
    const fullRange = Math.max(...signalValues) - Math.min(...signalValues);
    const flags = [];
    if (center.x >= 2280 && center.x <= 2400) flags.push('possible_atmospheric_co2');
    if (center.x < 500) flags.push('possible_low_frequency_artifact');
    if (width === null) flags.push('width_unresolved');
    return {
      originalNu: center.x,
      height: Number(peakHeight.toFixed(6)),
      prominence: Number(prominence.toFixed(6)),
      widthCm1: width === null ? null : Number(width.toFixed(2)),
      fwhmCm1: width === null ? null : Number(width.toFixed(2)),
      shape,
      direction: 'absorption',
      confidence: fullRange > 0 ? Number(Math.min(1, Math.max(0, prominence / fullRange)).toFixed(4)) : null,
      intensity: fullRange > 0 ? Math.round(Math.min(100, Math.max(0, (peakHeight / fullRange) * 100))) : null,
      qualityFlags: flags,
    };
  }

  function estimatePeakShape(centerX, leftX, rightX) {
    const minX = Math.min(leftX, rightX);
    const maxX = Math.max(leftX, rightX);
    const centerPoint = findNearestSpectrumPoint(centerX, measurementState?.spectrumId || null);
    if (!centerPoint) return { shape: 'unknown', fwhmCm1: null };
    const points = (lastData || [])
      .filter((point) => point.spectrumId === centerPoint.spectrumId && point.x >= minX && point.x <= maxX)
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .sort((a, b) => a.x - b.x);
    if (points.length < 5) return { shape: 'unknown', fwhmCm1: null };
    const centerIndex = points.reduce((best, point, index) => (
      Math.abs(point.x - centerX) < Math.abs(points[best].x - centerX) ? index : best
    ), 0);
    const edgeValues = [points[0].y, points[points.length - 1].y];
    const baseline = edgeValues.reduce((sum, value) => sum + value, 0) / edgeValues.length;
    const centerY = points[centerIndex].y;
    const peakHeight = centerY - baseline;
    const direction = peakHeight >= 0 ? 1 : -1;
    const halfLevel = baseline + peakHeight / 2;
    let leftIndex = centerIndex;
    let rightIndex = centerIndex;
    while (leftIndex > 0 && direction * (points[leftIndex].y - halfLevel) > 0) leftIndex -= 1;
    while (rightIndex < points.length - 1 && direction * (points[rightIndex].y - halfLevel) > 0) rightIndex += 1;
    const fwhmCm1 = Math.abs(points[rightIndex].x - points[leftIndex].x);
    if (!Number.isFinite(fwhmCm1) || fwhmCm1 <= 0) return { shape: 'unknown', fwhmCm1: null };
    const shape = fwhmCm1 <= 20 ? 'sharp' : fwhmCm1 >= 80 ? 'broad' : 'band';
    return { shape, fwhmCm1: Number(fwhmCm1.toFixed(2)) };
  }

  function measureStripeFromChart(xVal) {
    if (!measurementState) return false;
    const stripe = (stripeSets[measurementState.setId] || [])
      .find((item) => item.id === measurementState.stripeId);
    if (!stripe) {
      measurementState = null;
      return false;
    }
    if (measurementState.step === 'left') {
      measurementState.leftX = xVal;
      measurementState.step = 'right';
      setStatus('Left boundary set. Click the right band boundary.');
      return true;
    }

    const leftX = measurementState.leftX;
    const centerX = measurementState.centerX;
    const width = Math.abs(xVal - leftX);
    const spectrumId = stripe.spectrumId || measurementState.spectrumId || null;
    const centerPoint = findNearestSpectrumPoint(centerX, spectrumId);
    const leftPoint = findNearestSpectrumPoint(leftX, spectrumId);
    const rightPoint = findNearestSpectrumPoint(xVal, spectrumId);
    const edgeValues = [leftPoint?.y, rightPoint?.y].filter(Number.isFinite);
    const allValues = (lastData || [])
      .filter((point) => !spectrumId || point.spectrumId === spectrumId)
      .map((point) => point.y)
      .filter(Number.isFinite);
    if (centerPoint && edgeValues.length && allValues.length > 1) {
      const edgeAverage = edgeValues.reduce((sum, value) => sum + value, 0) / edgeValues.length;
      const signalRange = Math.max(...allValues) - Math.min(...allValues);
      if (signalRange > 0) {
        stripe.intensity = Math.round((Math.abs(centerPoint.y - edgeAverage) / signalRange) * 100);
      }
    }
    stripe.widthCm1 = Number.isFinite(width) ? Number(width.toFixed(2)) : null;
    const peakShape = estimatePeakShape(centerX, leftX, xVal);
    stripe.shape = peakShape.shape;
    stripe.fwhmCm1 = peakShape.fwhmCm1;
    stripe.source = 'manual';
    measurementState = null;
    chartEl.classList.remove('chart-measuring');
    setStatus(`Measured ${stripe.x.toFixed(2)} cm⁻¹, width ${stripe.widthCm1.toFixed(2)} cm⁻¹.`);
    renderChartFromData(lastData);
    renderStripesTable();
    return true;
  }

  function startStripeMeasurement(setId, stripeId) {
    const stripe = (stripeSets[setId] || []).find((item) => item.id === stripeId);
    if (!stripe || !Number.isFinite(Number(stripe.x))) return;
    measurementState = { setId, stripeId, spectrumId: stripe.spectrumId || markerSpectrumId || null, centerX: Number(stripe.x), step: 'left' };
    setActiveStripeSet(setId);
    chartEl.classList.add('chart-measuring');
    setStatus('Width mode: click the left boundary, then the right boundary.');
  }

  function buildConfirmedPeaksPayload() {
    const confirmed = Array.isArray(stripeSets.confirmed) ? stripeSets.confirmed : [];
    const candidates = Array.isArray(stripeSets.candidates) ? stripeSets.candidates : [];
    const observationsById = new Map();
    [...candidates, ...confirmed].forEach((stripe) => {
      const spectrumId = stripe.spectrumId || null;
      const nu = Number(stripe.x);
      if (!spectrumId || !Number.isFinite(nu)) return;
      const id = String(stripe.peakId || stripe.id || `peak-${spectrumId}-${nu.toFixed(2)}`);
      observationsById.set(id, {
        id,
        spectrumId,
        nu,
        originalNu: Number.isFinite(Number(stripe.originalNu)) ? Number(stripe.originalNu) : nu,
        height: finiteNumber(stripe.height),
        prominence: finiteNumber(stripe.prominence),
        widthCm1: finiteNumber(stripe.widthCm1),
        fwhmCm1: finiteNumber(stripe.fwhmCm1),
        shape: stripe.shape || null,
        qualityFlags: Array.isArray(stripe.qualityFlags)
          ? stripe.qualityFlags.filter((flag) => flag !== 'manual_estimate_fallback')
          : [],
        direction: stripe.direction || 'absorption',
        detectionMethod: stripe.source === 'automatic' ? 'automatic' : 'manual',
        confidence: finiteNumber(stripe.confidence) ?? (finiteNumber(stripe.intensity) !== null
          ? finiteNumber(stripe.intensity) / 100
          : null),
      });
    });
    const peakObservations = Array.from(observationsById.values());
    const confirmedPeakIds = confirmed
      .map((stripe) => String(stripe.peakId || stripe.id || ''))
      .filter((id) => observationsById.has(id));
    const spectra = lastSpectra.map((spectrum) => ({
      id: spectrum.id,
      name: customNames.get(spectrumColumn(spectrum.id)) || spectrum.name,
      sourceFile: spectrum.sourceFile,
      role: spectrum.role || spectrumRoles.get(spectrum.id) || 'unknown',
      signalType: spectrum.signalType || 'unknown',
      xUnit: spectrum.xUnit || 'cm-1',
      pointCount: spectrum.points.length,
    }));
    return {
      schemaVersion: '2.0',
      sample: { id: sampleInput?.value || 'sample', name: sampleInput?.value || '' },
      spectra,
      peakObservations,
      peakGroups: [],
      confirmedPeakIds,
      analysisSettings: {
        language: currentLang,
        reactionMode: spectra.length > 1,
        toleranceCm1: 8,
        shiftThresholdCm1: 2,
        prominenceChangeThreshold: 0.05,
        widthChangeThreshold: 1,
        userPrompt: analysisPromptInput?.value.trim().slice(0, 2000) || '',
        clientPreferences: {
          provider: userLlm.provider || 'server',
          model: userLlm.model || '',
        },
      },
    };
  }

  function buildSessionSnapshot() {
    return {
      version: 4,
      settings: buildPersistentSettings(),
      files: lastFilesRaw,
      fileName: fileNameInput.value,
      sampleIndex: sampleInput ? sampleInput.value : '',
      offsets: Object.fromEntries(offsets),
      stripeSets,
      activeStripeSet,
      visibleSeries: Object.fromEntries(visibleSeries),
      baselineSeries,
      baselineModel,
      detectorAppliedSettings: Object.fromEntries(detectorAppliedSettings),
      detectorProcessedBySpectrum: Object.fromEntries(detectorProcessedBySpectrum),
      xRange: { min: xMinInput.value, max: xMaxInput.value },
      yRange: { min: yMinInput.value, max: yMaxInput.value },
      chartBounds: { ...chartNavigationBounds },
      viewport: { ...chartViewport },
      yViewportActive: chartYViewportActive,
      customNames: Object.fromEntries(customNames),
      analysisPrompt: analysisPromptInput?.value || '',
      analysis: analysisData,
      referenceSearches: Object.fromEntries(referenceSearchesBySpectrum),
      spectra: lastSpectra,
      markerSpectrumId,
      activeSpectrumId,
      markerActive,
      markerX,
      stripeIdSeq,
      peaksTableCollapsed,
    };
  }

  function restoreReferenceSearches(snapshot) {
    const entries = Object.entries(snapshot || {});
    entries.forEach(([, entry]) => {
      const matches = Array.isArray(entry?.body?.matches) ? entry.body.matches : [];
      matches.forEach((match) => {
        // A request cannot survive a reload. Permit it to be requested again.
        if (match?.metadataState === 'loading') delete match.metadataState;
      });
    });
    return new Map(entries);
  }

  function buildPersistentSettings() {
    return {
      version: 1,
      language: currentLang,
      fileName: fileNameInput?.value || '',
      sampleIndex: sampleInput?.value || '',
      detector: {
        signalType: detectorSignalType?.value || 'unknown',
        baselineMethod: detectorBaselineMethod?.value || 'arpls',
        minProminence: detectorMinProminence?.value ?? '0.02',
        minSeparation: detectorMinSeparation?.value ?? '8',
        smoothingWindow: detectorSmoothingWindow?.value ?? '5',
      },
      chart: {
        xRange: { min: xMinInput?.value ?? '', max: xMaxInput?.value ?? '' },
        yRange: { min: yMinInput?.value ?? '', max: yMaxInput?.value ?? '' },
        bounds: { ...chartNavigationBounds },
        viewport: { ...chartViewport },
        yViewportActive: chartYViewportActive,
        visibleSeries: Object.fromEntries(visibleSeries),
      },
      peaks: {
        activeSet: activeStripeSet,
        tableCollapsed: peaksTableCollapsed,
        activeSpectrumId,
        markerSpectrumId,
        markerActive,
        markerX,
      },
      baseline: {
        series: baselineSeries,
        degree: baselineDegreeInput?.value ?? '2',
        model: baselineModel,
      },
      analysisPrompt: analysisPromptInput?.value || '',
    };
  }

  function applyPeaksTableState(collapsed) {
    peaksTableCollapsed = Boolean(collapsed);
    if (!peaksTableWrap || !togglePeaksTableBtn) return;
    peaksTableWrap.hidden = peaksTableCollapsed;
    togglePeaksTableBtn.setAttribute('aria-expanded', String(!peaksTableCollapsed));
    togglePeaksTableBtn.title = peaksTableCollapsed ? 'Expand peaks table' : 'Collapse peaks table';
    togglePeaksTableBtn.setAttribute('aria-label', togglePeaksTableBtn.title);
    const icon = togglePeaksTableBtn.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = peaksTableCollapsed ? 'unfold_more' : 'unfold_less';
  }

  function applyPersistentSettings(settings = {}) {
    if (!settings || typeof settings !== 'object') return;
    if (supportedLangs.includes(settings.language)) currentLang = settings.language;
    const setValue = (element, value) => {
      if (element && value !== undefined && value !== null) element.value = String(value);
    };
    setValue(fileNameInput, settings.fileName);
    setValue(sampleInput, settings.sampleIndex);
    const detector = settings.detector || {};
    setValue(detectorSignalType, detector.signalType);
    setValue(detectorBaselineMethod, detector.baselineMethod);
    setValue(detectorMinProminence, detector.minProminence);
    setValue(detectorMinSeparation, detector.minSeparation);
    setValue(detectorSmoothingWindow, detector.smoothingWindow);
    const chart = settings.chart || {};
    const xRange = chart.xRange || {};
    const yRange = chart.yRange || {};
    setValue(xMinInput, xRange.min);
    setValue(xMaxInput, xRange.max);
    setValue(yMinInput, yRange.min);
    setValue(yMaxInput, yRange.max);
    setNavigationBounds(chart.bounds || {
      xMin: xRange.min,
      xMax: xRange.max,
      yMin: yRange.min,
      yMax: yRange.max,
    });
    const hasFixedYBounds = chartNavigationBounds.yMin !== null && chartNavigationBounds.yMax !== null;
    const inputYMin = finiteNumber(yMinInput.value);
    const inputYMax = finiteNumber(yMaxInput.value);
    if (!hasFixedYBounds && (inputYMin === null || inputYMax === null || inputYMin === inputYMax)) {
      yMinInput.value = '';
      yMaxInput.value = '';
      chartNavigationBounds.yMin = null;
      chartNavigationBounds.yMax = null;
    }
    setChartViewport(chart.viewport || {
      xMin: xRange.min,
      xMax: xRange.max,
      yMin: yRange.min,
      yMax: yRange.max,
    }, defaultYRange, { restoreY: chart.yViewportActive === true });
    if (yMinInput.value === '' && yMaxInput.value === ''
      && chartNavigationBounds.yMin === null && chartNavigationBounds.yMax === null) {
      if (chart.yViewportActive !== true) {
        chartViewport.yMin = null;
        chartViewport.yMax = null;
      }
      chartYViewportActive = chart.yViewportActive === true
        && finiteNumber(chartViewport.yMin) !== null
        && finiteNumber(chartViewport.yMax) !== null
        && chartViewport.yMin !== chartViewport.yMax;
    }
    if (chart.visibleSeries && typeof chart.visibleSeries === 'object') {
      visibleSeries = new Map(Object.entries(chart.visibleSeries));
    }
    const peaks = settings.peaks || {};
    if (peaks.activeSet) activeStripeSet = peaks.activeSet;
    if (peaks.activeSpectrumId) activeSpectrumId = peaks.activeSpectrumId;
    if (peaks.markerSpectrumId) markerSpectrumId = peaks.markerSpectrumId;
    if (peaks.markerActive !== undefined) markerActive = Boolean(peaks.markerActive);
    if (peaks.markerX !== undefined && peaks.markerX !== null) markerX = Number(peaks.markerX);
    applyPeaksTableState(peaks.tableCollapsed);
    const baseline = settings.baseline || {};
    setValue(baselineDegreeInput, baseline.degree);
    if (baseline.series !== undefined) baselineSeries = baseline.series;
    if (baseline.model) baselineModel = baseline.model;
    if (settings.analysisPrompt !== undefined) setValue(analysisPromptInput, String(settings.analysisPrompt).slice(0, 2000));
    applyTranslations();
  }

  function restoreLocalSettings() {
    try {
      const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (raw) applyPersistentSettings(JSON.parse(raw));
    } catch (error) {
      console.warn('[FTIR local settings] restore failed', { name: error.name, message: error.message });
    }
  }

  function saveLocalSession() {
    saveLocalSettings();
    if (!lastFilesRaw.length) return;
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(buildSessionSnapshot()));
    } catch (error) {
      console.warn('[FTIR local session] save failed', { name: error.name, message: error.message });
    }
  }

  function saveLocalSettings() {
    try {
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(buildPersistentSettings()));
    } catch (error) {
      console.warn('[FTIR local settings] save failed', { name: error.name, message: error.message });
    }
  }

  function scheduleLocalSave() {
    if (localSaveTimer) clearTimeout(localSaveTimer);
    localSaveTimer = setTimeout(() => {
      localSaveTimer = null;
      saveLocalSession();
    }, 150);
  }

  function clearLocalSession() {
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      localStorage.removeItem(LOCAL_SETTINGS_KEY);
    } catch (error) {
      console.warn('[FTIR local session] clear failed', { name: error.name, message: error.message });
    }
    resetWorkspace();
    if (analysisCard) analysisCard.hidden = true;
    setReferenceSidebarVisible(false);
    setStatus('Local session cleared.');
  }

  function restoreLocalSession() {
    try {
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session || ![1, 2, 3, 4].includes(session.version) || !Array.isArray(session.files) || !session.files.length) return;
      if (session.settings) applyPersistentSettings(session.settings);
      lastFilesRaw = session.files.map((file) => ({ name: file.name, content: file.content }));
      spectrumRoles = new Map((session.spectra || [])
        .filter((spectrum) => spectrum?.id)
        .map((spectrum) => [String(spectrum.id), spectrum.role || 'unknown']));
      stripeSets = session.stripeSets || stripeSets;
      referenceSearchesBySpectrum = restoreReferenceSearches(session.referenceSearches);
      activeStripeSet = session.activeStripeSet || activeStripeSet;
      stripeIdSeq = Number(session.stripeIdSeq) || 0;
      markerActive = Boolean(session.markerActive ?? session.settings?.peaks?.markerActive);
      markerX = session.markerX !== undefined && session.markerX !== null ? Number(session.markerX) : session.settings?.peaks?.markerX ?? null;
      peaksTableCollapsed = Boolean(session.peaksTableCollapsed ?? session.settings?.peaks?.tableCollapsed);
      applyPeaksTableState(peaksTableCollapsed);
      if (!stripeSets[activeStripeSet]) stripeSets[activeStripeSet] = [];
      processFiles(lastFilesRaw, {
        fileName: session.fileName,
        sampleIndex: session.sampleIndex,
        offsets: session.offsets,
        visibleSeries: session.visibleSeries,
        baselineSeries: session.baselineSeries,
        baselineModel: session.baselineModel,
        detectorAppliedSettings: session.detectorAppliedSettings,
        detectorProcessedBySpectrum: session.detectorProcessedBySpectrum,
        xRange: session.xRange,
        yRange: session.yRange,
        chartBounds: session.chartBounds || session.settings?.chart?.bounds,
        viewport: session.viewport || session.settings?.chart?.viewport,
        yViewportActive: session.yViewportActive ?? session.settings?.chart?.yViewportActive,
        customNames: session.customNames,
        stripeSets,
        markerSpectrumId: session.markerSpectrumId,
        activeSpectrumId: session.activeSpectrumId,
      });
      if (session.settings) {
        applyPersistentSettings(session.settings);
        updateDetectorControls();
      }
      if (analysisPromptInput) analysisPromptInput.value = String(session.analysisPrompt || '').slice(0, 2000);
      analysisData = session.analysis || null;
      renderActiveReferenceSearch();
      if (activeSpectrumId) void resolveStrongReferenceMetadata(activeSpectrumId);
      if (analysisData && analysisCard && analysisResult) {
        analysisCard.hidden = false;
        analysisStatus.textContent = 'Restored';
        analysisResult.innerHTML = renderAnalysisReport(analysisData);
      }
      setStatus('Restored local session.');
      console.info('[FTIR local session] restored', { files: lastFilesRaw.length });
    } catch (error) {
      console.warn('[FTIR local session] restore failed', { name: error.name, message: error.message });
    }
  }

  function renderAnalysisReport(result) {
    if (!result || typeof result !== 'object') return '<p class="analysis-empty">No interpretation received.</p>';
    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    const list = (values, className = '') => {
      if (!Array.isArray(values) || !values.length) return '';
      return `<ul class="analysis-list ${className}">${values.map((value) => `<li>${escapeHtml(typeof value === 'string' ? value : JSON.stringify(value))}</li>`).join('')}</ul>`;
    };
    const candidates = Array.isArray(result.candidates) ? result.candidates : [];
    const candidateCards = candidates.map((candidate, index) => {
      const label = candidate.group || candidate.assignment || candidate.label || t('analysisFunctionalGroupUnknown');
      const confidence = candidate.likelihood || candidate.confidence || 'unknown';
      const confidenceClass = String(confidence).toLowerCase().replace(/[^a-z]+/g, '-');
      const peak = Number.isFinite(Number(candidate.nu)) ? `<span class="analysis-peak">${escapeHtml(candidate.nu)} cm⁻¹</span>` : '';
      return `<article class="analysis-candidate">
        <div class="analysis-candidate-head"><span class="analysis-rank">${index + 1}</span><h4>${escapeHtml(label)}</h4><span class="analysis-confidence ${confidenceClass}">${escapeHtml(confidence)}</span></div>
        ${peak}
        ${candidate.reasoning || candidate.explanation ? `<p>${escapeHtml(candidate.reasoning || candidate.explanation)}</p>` : `<p class="analysis-warning">${escapeHtml(t('analysisNoExplanation'))}</p>`}
      </article>`;
    }).join('');
    const spectrumReports = Array.isArray(result.spectra) ? result.spectra : [];
    const assignmentSections = spectrumReports.map((report) => {
      const assignments = Array.isArray(report.peakAssignments) ? report.peakAssignments : [];
      if (!assignments.length) return '';
      const spectrum = lastSpectra.find((item) => item.id === report.spectrumId);
      const spectrumName = customNames.get(spectrumColumn(report.spectrumId)) || spectrum?.name || report.spectrumId;
      return `<section class="analysis-spectrum"><div class="analysis-spectrum-head"><h4>${escapeHtml(spectrumName)}</h4><span>${escapeHtml(report.spectrumId)}</span></div><div class="analysis-candidates">${assignments.map((assignment) => {
        const label = assignment.group || assignment.assignment || t('analysisFunctionalGroupUnknown');
        const confidence = assignment.confidence || assignment.likelihood || 'unknown';
        const confidenceClass = String(confidence).toLowerCase().replace(/[^a-z]+/g, '-');
        return `<article class="analysis-candidate"><div class="analysis-candidate-head"><span class="analysis-peak">${escapeHtml(assignment.nu)} cm⁻¹</span><h4>${escapeHtml(label)}</h4><span class="analysis-confidence ${confidenceClass}">${escapeHtml(confidence)}</span></div><small class="analysis-peak-id">${escapeHtml(assignment.peakId || '')}</small><p>${escapeHtml(assignment.reasoning || t('analysisNoExplanation'))}</p></article>`;
      }).join('')}</div></section>`;
    }).join('');
    const hasSpectrumAssignments = spectrumReports.some((report) => Array.isArray(report.peakAssignments) && report.peakAssignments.length);
    const assignmentsSection = hasSpectrumAssignments
      ? `<section class="analysis-section"><h4>${escapeHtml(t('analysisAssignments'))}</h4>${assignmentSections}</section>`
      : '';
    const supporting = Array.isArray(result.supporting_peaks) && result.supporting_peaks.length
      ? `<section class="analysis-section"><h4>${escapeHtml(t('analysisSupportingPeaks'))}</h4><div class="analysis-tags">${result.supporting_peaks.map((peak) => {
        const value = typeof peak === 'object' ? peak.nu : peak;
        const label = typeof peak === 'object' ? (peak.assignment || peak.label || '') : '';
        return `<span class="analysis-tag"><strong>${escapeHtml(value)} cm⁻¹</strong>${label ? ` ${escapeHtml(label)}` : ''}</span>`;
      }).join('')}</div></section>`
      : '';
    const sections = [
      result.missing_evidence?.length ? `<section class="analysis-section"><h4>${escapeHtml(t('analysisMissingEvidence'))}</h4>${list(result.missing_evidence)}</section>` : '',
      result.limitations?.length ? `<section class="analysis-section"><h4>${escapeHtml(t('analysisLimitations'))}</h4>${list(result.limitations)}</section>` : '',
    ].join('');
    const reaction = result.reactionAssessment;
    const reactionStatus = {
      passed: t('analysisReactionPassed'),
      not_passed: t('analysisReactionNotPassed'),
      inconclusive: t('analysisReactionInconclusive'),
    }[reaction?.status] || t('analysisReactionAssessment');
    const reactionCard = reaction
      ? `<section class="analysis-reaction ${escapeHtml(reaction.status || 'inconclusive')}">
          <div class="analysis-reaction-head"><h4>${reactionStatus}</h4><span>${escapeHtml(reaction.confidence || 'unknown')}</span></div>
          <p>${escapeHtml(reaction.summary || t('analysisNoReactionSummary'))}</p>
          ${reaction.missingEvidence?.length ? list(reaction.missingEvidence) : ''}
        </section>`
      : '';
    const formatNumber = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
    const displaySpectrum = (spectrumId) => {
      if (!spectrumId) return '—';
      const spectrum = lastSpectra.find((item) => item.id === spectrumId);
      return customNames.get(spectrumColumn(spectrumId)) || spectrum?.name || spectrumId;
    };
    const changeSummary = result.changeSummary && typeof result.changeSummary === 'object' ? result.changeSummary : null;
    const summaryByGroup = new Map();
    if (changeSummary) {
      Object.entries({
        disappeared: 'disappeared_peak',
        appeared: 'appeared_peak',
        shifted: 'shifted_peak',
        intensityChanges: 'prominence_change',
        widthChanges: 'width_change',
      }).forEach(([key, type]) => {
        (Array.isArray(changeSummary[key]) ? changeSummary[key] : []).forEach((change) => {
          const groupId = change.groupId || change.peakGroupId;
          if (groupId) summaryByGroup.set(`${type}:${groupId}`, { ...change, type });
        });
      });
    }
    const objectiveChanges = Array.isArray(result.comparison?.changes) ? result.comparison.changes : [];
    const changes = objectiveChanges.length
      ? objectiveChanges.map((change) => ({ ...change, explanation: summaryByGroup.get(`${change.type}:${change.groupId}`)?.explanation || summaryByGroup.get(`${change.type}:${change.groupId}`)?.reasoning || '' }))
      : Array.from(summaryByGroup.values());
    const changeLabels = {
      disappeared_peak: t('analysisDisappeared'),
      appeared_peak: t('analysisAppeared'),
      shifted_peak: t('analysisShifted'),
      prominence_change: t('analysisProminenceChanged'),
      width_change: t('analysisWidthChanged'),
    };
    const renderChange = (change) => {
      const details = change.type === 'shifted_peak'
        ? `${formatNumber(change.fromNu)} → ${formatNumber(change.toNu)} cm⁻¹ (Δ ${formatNumber(change.deltaNu)})`
        : change.type === 'prominence_change'
          ? `${formatNumber(change.fromProminence, 3)} → ${formatNumber(change.toProminence, 3)} (Δ ${formatNumber(change.deltaProminence, 3)})`
          : change.type === 'width_change'
            ? `${formatNumber(change.fromFwhmCm1)} → ${formatNumber(change.toFwhmCm1)} cm⁻¹ (Δ ${formatNumber(change.deltaFwhm)})`
            : `${formatNumber(change.nu)} cm⁻¹`;
      return `<div class="analysis-change"><strong>${escapeHtml(displaySpectrum(change.fromSpectrumId))} → ${escapeHtml(displaySpectrum(change.toSpectrumId))}</strong><span>${escapeHtml(details)}</span>${change.explanation ? `<p>${escapeHtml(change.explanation)}</p>` : ''}</div>`;
    };
    const changeGroups = Object.entries(changeLabels)
      .map(([type, label]) => ({ type, label, changes: changes.filter((change) => change.type === type) }))
      .filter((group) => group.changes.length);
    const comparisonSection = changes.length
      ? `<section class="analysis-section"><h4>${escapeHtml(t('analysisChanges'))}</h4><div class="analysis-change-groups">${changeGroups.map((group) => `<section class="analysis-change-group"><div class="analysis-change-group-head"><strong>${escapeHtml(group.label)}</strong><span>${group.changes.length}</span></div><div class="analysis-changes">${group.changes.map(renderChange).join('')}</div></section>`).join('')}</div></section>`
      : '';
    return `<div class="analysis-report">
      ${reactionCard}
      <section class="analysis-summary"><h4>${escapeHtml(t('analysisInterpretation'))}</h4><p>${escapeHtml(result.interpretation || t('analysisNoSummary'))}</p></section>
      ${assignmentsSection || (!hasSpectrumAssignments && candidateCards ? `<section class="analysis-section"><h4>${escapeHtml(t('analysisAssignments'))}</h4><div class="analysis-candidates">${candidateCards}</div></section>` : '')}
      ${comparisonSection}
      ${supporting}${sections}
      <div class="analysis-footer"><span>${escapeHtml(t('analysisConfidence'))}: <strong>${escapeHtml(result.confidence || 'unknown')}</strong></span>${result.model ? `<span>${escapeHtml(t('analysisModel'))}: ${escapeHtml(result.model)}</span>` : ''}</div>
    </div>`;
  }

  function applyAnalysisSuggestions(result) {
    const confirmed = Array.isArray(stripeSets.confirmed) ? stripeSets.confirmed : [];
    const legacyCandidates = Array.isArray(result?.candidates) ? result.candidates : [];
    const spectrumCandidates = (Array.isArray(result?.spectra) ? result.spectra : []).flatMap((report) => (
      (Array.isArray(report.peakAssignments) ? report.peakAssignments : []).map((assignment) => ({
        ...assignment,
        spectrumId: report.spectrumId,
      }))
    ));
    const candidates = spectrumCandidates.length ? spectrumCandidates : legacyCandidates;
    let applied = 0;
    candidates.forEach((candidate) => {
      const explicitNu = candidate.nu ?? candidate.wavenumber ?? candidate.peak;
      const candidateNu = Number(explicitNu);
      const stripe = confirmed.reduce((nearest, item) => {
        if (candidate.spectrumId && item.spectrumId !== candidate.spectrumId) return nearest;
        const distance = Number.isFinite(candidateNu) ? Math.abs(Number(item.x) - candidateNu) : 0;
        if (!nearest || distance < nearest.distance) return { item, distance };
        return nearest;
      }, null);
      if (!stripe || (Number.isFinite(candidateNu) && stripe.distance > 30)) return;
      const label = candidate.group || candidate.assignment || candidate.label;
      const explanation = candidate.reasoning || candidate.explanation;
      if (label && stripe.item.labelSource !== 'manual') {
        stripe.item.analysisLabel = label;
        stripe.item.label = label;
      }
      if (label || explanation) {
        stripe.item.analysisTip = [label, explanation].filter(Boolean).join(' — ');
        stripe.item.tip = stripe.item.analysisTip;
        applied += 1;
      }
    });
    console.info('[FTIR analysis] suggestions.applied', { candidates: candidates.length, confirmed: confirmed.length, applied });
  }

  function selectedReferenceSignalType(spectrum) {
    const applied = detectorAppliedSettings.get(spectrum?.id);
    const fromProcessing = applied?.signalType;
    const fromControl = detectorSignalType?.value;
    const configured = referenceSearchConfig.signalType;
    return [fromProcessing, fromControl, spectrum?.signalType, configured]
      .find((value) => value === 'absorbance' || value === 'transmittance') || 'transmittance';
  }

  const REFERENCE_STRONG_MATCH_SCORE = 0.6;

  function referenceSpectrumName(spectrum) {
    if (!spectrum) return '';
    return customNames.get(spectrumColumn(spectrum.id)) || spectrum.name || spectrum.id;
  }

  function referenceScoreLabel(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) return '—';
    return `${(score * 100).toFixed(1)}%`;
  }

  function formatChemicalFormula(value) {
    return escapeHtml(value).replace(/(\d+)/g, '<sub>$1</sub>');
  }

  function renderReferenceIdentity(match, matchIndex, autoResolve = false) {
    const metadata = match.metadata;
    if (metadata?.found) {
      const name = metadata.title || metadata.iupacName || t('referenceNameUnavailable');
      const details = [
        metadata.molecularFormula ? `${escapeHtml(t('referenceFormula'))}: <span class="chemical-formula">${formatChemicalFormula(metadata.molecularFormula)}</span>` : '',
        metadata.cid ? `CID: ${escapeHtml(metadata.cid)}` : '',
      ].filter(Boolean).join(' · ');
      const iupac = metadata.iupacName && metadata.iupacName !== name
        ? `<div class="reference-metadata-iupac">${escapeHtml(metadata.iupacName)}</div>`
        : '';
      return `<div class="reference-metadata"><strong>${escapeHtml(name)}</strong>${details ? `<span>${details}</span>` : ''}${iupac}</div>`;
    }
    if (match.metadataState === 'loading') {
      return `<div class="reference-match-meta reference-match-smiles">${escapeHtml(t('referenceResolvingName'))}</div>`;
    }
    if (match.metadataState === 'not_found') {
      return `<div class="reference-match-meta reference-match-smiles">SMILES: ${escapeHtml(match.smiles || '')}</div><div class="reference-metadata reference-metadata--muted">${escapeHtml(t('referenceNameNotFound'))}</div>`;
    }
    if (match.metadataState === 'error') {
      return `<button type="button" class="reference-match-meta reference-match-smiles reference-smiles-resolve" data-reference-resolve="${matchIndex}" title="${escapeHtml(t('referenceFindName'))}">SMILES: ${escapeHtml(match.smiles || '')}</button><div class="reference-metadata reference-metadata--muted">${escapeHtml(t('referenceNameUnavailable'))}</div>`;
    }
    if (!match.smiles) return '';
    if (autoResolve) return `<div class="reference-match-meta reference-match-smiles">${escapeHtml(t('referenceResolvingName'))}</div>`;
    return `<button type="button" class="reference-match-meta reference-match-smiles reference-smiles-resolve" data-reference-resolve="${matchIndex}" title="${escapeHtml(t('referenceFindName'))}">SMILES: ${escapeHtml(match.smiles)}</button>`;
  }

  function renderReferenceMatch(match, index, matchIndex, autoResolve = false) {
    const identifier = match.id || `match-${index + 1}`;
    const smiles = typeof match.smiles === 'string' ? match.smiles.trim() : '';
    const pubChemUrl = smiles
      ? `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(smiles)}`
      : '';
    const structure = smiles
      ? `<div class="reference-structure" data-smiles-structure data-smiles="${escapeHtml(smiles)}"><svg aria-label="${escapeHtml(`Chemical structure for ${identifier}`)}" role="img"></svg></div>`
      : `<div class="reference-structure"><span class="reference-structure-fallback">${escapeHtml(t('referenceStructureUnavailable'))}</span></div>`;
    return `<article class="reference-match">
      <div class="reference-match-head"><span class="analysis-rank">${index + 1}</span><strong>${escapeHtml(identifier)}</strong><span class="reference-match-score">${escapeHtml(t('referenceScore'))}: ${escapeHtml(referenceScoreLabel(match.score))}</span></div>
      <div class="reference-match-body">
        <div>
          ${renderReferenceIdentity(match, matchIndex, autoResolve)}
          ${pubChemUrl ? `<div class="reference-match-links"><a href="${escapeHtml(pubChemUrl)}" target="_blank" rel="noopener">${escapeHtml(t('referenceOpenPubChem'))}</a></div>` : ''}
        </div>
        ${structure}
      </div>
    </article>`;
  }

  function drawReferenceStructures() {
    if (!referenceSearchResult) return;
    const structures = referenceSearchResult.querySelectorAll('[data-smiles-structure]');
    structures.forEach((container) => {
      const smiles = container.dataset.smiles || '';
      const target = container.querySelector('svg');
      const fallback = () => {
        container.replaceChildren();
        const message = document.createElement('span');
        message.className = 'reference-structure-fallback';
        message.textContent = t('referenceStructureUnavailable');
        container.appendChild(message);
      };
      if (!smiles || !target || !window.SmilesDrawer?.parse || !window.SmilesDrawer?.SvgDrawer) {
        fallback();
        return;
      }
      try {
        window.SmilesDrawer.parse(smiles, (tree) => {
          try {
            const drawer = new window.SmilesDrawer.SvgDrawer({ width: 180, height: 124, padding: 8, bondLength: 18 });
            drawer.draw(tree, target, 'light', false);
          } catch (error) {
            clientWarn('reference.structure.draw_failed', { name: error.name, message: error.message });
            fallback();
          }
        }, fallback);
      } catch (error) {
        clientWarn('reference.structure.parse_failed', { name: error.name, message: error.message });
        fallback();
      }
    });
  }

  function renderReferenceSearchResponse(body, spectrum, lowerMatchesOpen = false) {
    const matches = Array.isArray(body?.matches) ? body.matches : [];
    if (!matches.length) return `<p class="analysis-empty">${escapeHtml(t('referenceNoMatches'))}</p>`;
    const indexedMatches = matches.map((match, matchIndex) => ({ match, matchIndex }));
    const strong = indexedMatches.filter(({ match }) => Number(match.score) >= REFERENCE_STRONG_MATCH_SCORE);
    const lower = indexedMatches.filter(({ match }) => Number(match.score) < REFERENCE_STRONG_MATCH_SCORE);
    const strongItems = strong.map(({ match, matchIndex }, index) => renderReferenceMatch(match, index, matchIndex, true)).join('');
    const lowerItems = lower.map(({ match, matchIndex }, index) => renderReferenceMatch(match, strong.length + index, matchIndex)).join('');
    const license = matches.find((match) => typeof match?.license === 'string' && match.license)?.license || '';
    const licenseUrl = license === 'CDLA-Permissive-2.0' ? 'https://cdla.dev/permissive-2-0/' : '';
    return `<div class="reference-search-layout">
      <section class="reference-strong-matches">
        <div class="reference-result-heading"><h4>${escapeHtml(t('referenceStrongMatches'))}</h4><span>${escapeHtml(t('referenceThresholdLabel'))}</span></div>
        ${strongItems ? `<div class="reference-match-list">${strongItems}</div>` : `<p class="analysis-empty">${escapeHtml(t('referenceNoStrongMatches'))}</p>`}
      </section>
      <details class="reference-low-sidebar"${lowerMatchesOpen ? ' open' : ''}>
        <summary>${escapeHtml(t('referenceOtherMatches'))} (${lower.length})</summary>
        <div class="reference-low-content">${lowerItems || `<p class="analysis-empty">${escapeHtml(t('referenceNoLowerMatches'))}</p>`}</div>
      </details>
    </div>
    ${license ? `<p class="reference-license">${escapeHtml(t('referenceLicense'))}: ${licenseUrl ? `<a href="${licenseUrl}" target="_blank" rel="noopener">${escapeHtml(license)}</a>` : escapeHtml(license)}</p>` : ''}`;
  }

  function setReferenceSidebarOpen(open) {
    referenceSidebarOpen = Boolean(open);
    referenceSearchCard?.classList.toggle('is-open', referenceSidebarOpen);
    referenceSidebarToggleBtn?.classList.toggle('is-open', referenceSidebarOpen);
    if (referenceSidebarToggleBtn) {
      referenceSidebarToggleBtn.setAttribute('aria-expanded', String(referenceSidebarOpen));
      referenceSidebarToggleBtn.title = referenceSidebarOpen ? t('referenceCloseResults') : t('referenceOpenResults');
      referenceSidebarToggleBtn.setAttribute('aria-label', referenceSidebarToggleBtn.title);
      const icon = referenceSidebarToggleBtn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = referenceSidebarOpen ? 'chevron_right' : 'chevron_left';
    }
  }

  function setReferenceSidebarVisible(visible) {
    if (referenceSearchCard) referenceSearchCard.hidden = !visible;
    if (referenceSidebarToggleBtn) referenceSidebarToggleBtn.hidden = !visible;
    if (!visible) setReferenceSidebarOpen(false);
  }

  async function resolveReferenceMetadata(spectrumId, matchIndex) {
    const entry = referenceSearchesBySpectrum.get(spectrumId);
    const matches = Array.isArray(entry?.body?.matches) ? entry.body.matches : [];
    const match = matches[matchIndex];
    if (!match?.smiles || match.metadata || match.metadataState === 'loading') return;
    const keepSidebarOpen = referenceSidebarOpen;
    match.metadataState = 'loading';
    delete match.metadataError;
    if (activeSpectrumId === spectrumId) {
      renderActiveReferenceSearch();
      if (keepSidebarOpen) setReferenceSidebarOpen(true);
    }
    try {
      const headers = { 'content-type': 'application/json' };
      if (referenceSearchDirect) headers['x-service-token'] = localReferenceServiceToken;
      const response = await fetch(referenceMetadataApi, {
        method: 'POST',
        headers,
        // Direct reference authentication uses X-Service-Token, not browser
        // cookies. Omitting credentials keeps cross-origin CORS deterministic.
        credentials: referenceSearchDirect ? 'omit' : apiCredentials,
        body: JSON.stringify({ smiles: match.smiles }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.error || `Metadata request failed (${response.status})`);
      match.metadata = body.metadata || { found: false };
      match.metadataState = match.metadata.found ? 'ready' : 'not_found';
      clientLog('reference.metadata.complete', {
        spectrumId,
        matchId: match.id,
        found: Boolean(match.metadata.found),
        cache: match.metadata.cache || null,
      });
    } catch (error) {
      match.metadataState = 'error';
      match.metadataError = error.message || 'Metadata unavailable';
      clientError('reference.metadata.error', {
        url: referenceMetadataApi,
        spectrumId,
        matchId: match.id,
        name: error.name,
        message: error.message,
      });
    }
    if (activeSpectrumId === spectrumId) {
      renderActiveReferenceSearch();
      if (keepSidebarOpen) setReferenceSidebarOpen(true);
    }
    scheduleLocalSave();
  }

  async function resolveStrongReferenceMetadata(spectrumId) {
    const entry = referenceSearchesBySpectrum.get(spectrumId);
    const matches = Array.isArray(entry?.body?.matches) ? entry.body.matches : [];
    // Resolve serially: a query normally has only 1–5 strong candidates, and
    // this keeps the public PubChem service from receiving a burst of requests.
    for (let index = 0; index < matches.length; index += 1) {
      if (Number(matches[index].score) >= REFERENCE_STRONG_MATCH_SCORE) {
        await resolveReferenceMetadata(spectrumId, index);
      }
    }
  }

  function bindReferenceMetadataButtons() {
    if (!referenceSearchResult) return;
    referenceSearchResult.querySelectorAll('[data-reference-resolve]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const matchIndex = Number(button.dataset.referenceResolve);
        if (Number.isInteger(matchIndex) && activeSpectrumId) void resolveReferenceMetadata(activeSpectrumId, matchIndex);
      });
    });
  }

  function bindReferenceLowerMatchesState(entry) {
    const details = referenceSearchResult?.querySelector('.reference-low-sidebar');
    if (!details || !entry) return;
    details.addEventListener('toggle', () => {
      entry.lowerMatchesOpen = details.open;
      scheduleLocalSave();
    });
  }

  function renderActiveReferenceSearch() {
    const spectrum = lastSpectra.find((item) => item.id === activeSpectrumId);
    const entry = spectrum ? referenceSearchesBySpectrum.get(spectrum.id) : null;
    if (!referenceSearchCard || !referenceSearchResult) return;
    if (!spectrum || !entry) {
      setReferenceSidebarVisible(false);
      return;
    }
    setReferenceSidebarVisible(true);
    setReferenceSidebarOpen(referenceSidebarOpen);
    if (referenceSearchSpectrum) referenceSearchSpectrum.textContent = referenceSpectrumName(spectrum);
    if (referenceSearchStatus) referenceSearchStatus.textContent = entry.error
      ? t(referenceSearchDirect ? 'referenceUnavailable' : 'referenceProxyUnavailable')
      : t('referenceReady');
    if (entry.error) {
      referenceSearchResult.textContent = entry.error;
      return;
    }
    const sidebarScrollTop = referenceSearchCard.scrollTop;
    const existingLowerMatches = referenceSearchResult.querySelector('.reference-low-sidebar');
    const lowerContentScrollTop = existingLowerMatches?.querySelector('.reference-low-content')?.scrollTop || 0;
    if (existingLowerMatches) entry.lowerMatchesOpen = existingLowerMatches.open;
    referenceSearchResult.innerHTML = renderReferenceSearchResponse(entry.body, spectrum, Boolean(entry.lowerMatchesOpen));
    drawReferenceStructures();
    bindReferenceMetadataButtons();
    bindReferenceLowerMatchesState(entry);
    const restoreReferenceScroll = () => {
      referenceSearchCard.scrollTop = sidebarScrollTop;
      const lowerContent = referenceSearchResult.querySelector('.reference-low-content');
      if (lowerContent) lowerContent.scrollTop = lowerContentScrollTop;
    };
    restoreReferenceScroll();
    requestAnimationFrame(restoreReferenceScroll);
  }

  async function searchLocalReferences() {
    const spectrum = lastSpectra.find((item) => item.id === activeSpectrumId);
    if (!spectrum?.points?.length) {
      setStatus(t('referenceNoSpectrum'), true);
      return;
    }
    if (referenceSearchDirect && !localReferenceServiceToken) {
      localReferenceServiceToken = window.prompt(t('referenceTokenPrompt'))?.trim() || '';
      if (localReferenceServiceToken && window.FTIR_SETTINGS?.update) {
        window.FTIR_SETTINGS.update({ auth: { referenceServiceToken: localReferenceServiceToken } });
      }
    }
    if (referenceSearchDirect && !localReferenceServiceToken) {
      setStatus(t('referenceTokenRequired'), true);
      return;
    }
    setReferenceSidebarVisible(true);
    setReferenceSidebarOpen(true);
    if (referenceSearchSpectrum) referenceSearchSpectrum.textContent = referenceSpectrumName(spectrum);
    if (referenceSearchStatus) referenceSearchStatus.textContent = t('referenceSearching');
    if (referenceSearchResult) referenceSearchResult.textContent = '';
    if (searchLocalReferencesBtn) {
      searchLocalReferencesBtn.dataset.busy = 'true';
      searchLocalReferencesBtn.disabled = true;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), referenceSearchTimeoutMs);
    const signalType = selectedReferenceSignalType(spectrum);
    const payload = { points: spectrum.points, signalType, topK: referenceSearchTopK };
    const startedAt = performance.now();
    clientLog('reference.search.start', {
      url: referenceSearchApi,
      spectrumId: spectrum.id,
      points: spectrum.points.length,
      signalType,
      topK: referenceSearchTopK,
      direct: referenceSearchDirect,
    });
    try {
      const headers = { 'content-type': 'application/json' };
      if (referenceSearchDirect) headers['x-service-token'] = localReferenceServiceToken;
      const response = await fetch(referenceSearchApi, {
        method: 'POST',
        headers,
        credentials: referenceSearchDirect ? 'omit' : apiCredentials,
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (referenceSearchDirect && response.status === 401) localReferenceServiceToken = '';
        throw new Error(body.detail || body.error || `Reference search failed (${response.status})`);
      }
      referenceSearchesBySpectrum.set(spectrum.id, { body, fetchedAt: new Date().toISOString() });
      renderActiveReferenceSearch();
      void resolveStrongReferenceMetadata(spectrum.id);
      clientLog('reference.search.complete', {
        spectrumId: spectrum.id,
        queryFingerprint: body.query?.fingerprint || null,
        matches: Array.isArray(body.matches) ? body.matches.length : 0,
        topMatches: Array.isArray(body.matches)
          ? body.matches.slice(0, 3).map((match) => ({ id: match.id, score: match.score }))
          : [],
        durationMs: Math.round(performance.now() - startedAt),
      });
      setStatus(t('referenceReady'));
    } catch (error) {
      const message = error?.name === 'AbortError' ? `Reference search timed out after ${referenceSearchTimeoutMs / 1000}s` : error.message;
      const unavailableMessage = t(referenceSearchDirect ? 'referenceUnavailable' : 'referenceProxyUnavailable');
      referenceSearchesBySpectrum.set(spectrum.id, { error: message || unavailableMessage, fetchedAt: new Date().toISOString() });
      renderActiveReferenceSearch();
      clientError('reference.search.error', { url: referenceSearchApi, name: error.name, message });
      setStatus(unavailableMessage, true);
    } finally {
      window.clearTimeout(timeout);
      if (searchLocalReferencesBtn) {
        delete searchLocalReferencesBtn.dataset.busy;
        updateReferenceSearchControls();
      }
    }
  }

  async function analyzeConfirmedPeaks() {
    const payload = buildConfirmedPeaksPayload();
    if (!payload.confirmedPeakIds.length) {
      setStatus('No confirmed peaks to analyze.', true);
      return;
    }
    if (analysisCard) analysisCard.hidden = false;
    if (analysisStatus) analysisStatus.textContent = 'Analyzing...';
    if (analysisResult) analysisResult.textContent = '';
    if (analyzeConfirmedBtn) analyzeConfirmedBtn.disabled = true;
    console.info('[FTIR analysis] request.start', {
      url: analysisApi,
      origin: window.location.origin,
      confirmedPeaks: payload.confirmedPeakIds.length,
      observations: payload.peakObservations.length,
      files: payload.spectra.length,
    });
    try {
      const startedAt = performance.now();
      const response = await fetch(analysisApi, {
        method: 'POST',
        headers: apiRequestHeaders({ includeLlmPreferences: true }),
        credentials: apiCredentials,
        body: JSON.stringify(payload),
      });
      console.info('[FTIR analysis] response', { status: response.status, ok: response.ok, durationMs: Math.round(performance.now() - startedAt) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Analysis failed (${response.status})`);
      if (analysisStatus) analysisStatus.textContent = 'Complete';
      analysisData = body.result || body;
      applyAnalysisSuggestions(analysisData);
      if (analysisResult) analysisResult.innerHTML = renderAnalysisReport(analysisData);
      // Analysis must not change the user's current chart context. In
      // particular, switching Candidates → Confirmed forces a redraw and can
      // make an auto-scaled view look as if it has jumped.
      renderStripesTable();
      scheduleLocalSave();
      setStatus('Confirmed peaks analyzed.');
    } catch (error) {
      const accessDiagnostic = await diagnoseApiAccess();
      console.error('[FTIR analysis] request.failed', {
        url: analysisApi,
        origin: window.location.origin,
        name: error.name,
        message: error.message,
        hint: 'Check backend process, URL and CORS settings.',
        accessDiagnostic,
      });
      if (analysisStatus) analysisStatus.textContent = 'Unavailable';
      if (analysisResult) analysisResult.textContent = error.message || 'Analysis failed';
      setStatus('Analysis service unavailable. The local session is unchanged.', true);
    } finally {
      if (analyzeConfirmedBtn) analyzeConfirmedBtn.disabled = false;
    }
  }

  function updateBaselineSelectOptions(cols = lastColumns || []) {
    if (BASELINE_DISABLED) return;
    if (!baselineSeriesSelect) return;
    baselineSeriesSelect.innerHTML = '';
    cols.forEach((col) => {
      const opt = document.createElement('option');
      opt.value = col;
      opt.textContent = customNames.get(col) || col;
      baselineSeriesSelect.appendChild(opt);
    });
    if (cols.length === 0) {
      baselineSeriesSelect.disabled = true;
      baselinePreviewBtn.disabled = true;
      baselineApplyBtn.disabled = true;
      baselineRevertBtn.disabled = true;
      baselineDegreeInput.disabled = true;
      return;
    }
    baselineSeriesSelect.disabled = false;
    baselineDegreeInput.disabled = false;
    const target = baselineSeries && cols.includes(baselineSeries) ? baselineSeries : cols[0];
    baselineSeriesSelect.value = target;
    baselinePreviewBtn.disabled = false;
    baselineApplyBtn.disabled = false;
    baselineRevertBtn.disabled = !baselineSeries && !baselinePreviewModel;
  }

  function applyBaselineModel(model) {
    if (!model) return;
    if (BASELINE_DISABLED) return;
    baselineSeries = model.series;
    baselineModel = { series: model.series, degree: model.degree, coeffs: model.coeffs.slice() };
    baselineMap = model.map ? new Map(model.map) : new Map();
    baselinePreviewModel = null;
    defaultYRange = computeAdjustedExtent(lastData) || defaultYRange;
    chartNavigationBounds.yMin = null;
    chartNavigationBounds.yMax = null;
    chartViewport.yMin = null;
    chartViewport.yMax = null;
    chartYViewportActive = false;
    yMinInput.value = '';
    yMaxInput.value = '';
    updateBaselineSelectOptions();
    renderChartFromData(lastData);
    scheduleLocalSave();
  }

  function clearBaseline() {
    if (BASELINE_DISABLED) return;
    baselineSeries = null;
    baselineModel = null;
    baselineMap = new Map();
    baselinePreviewModel = null;
    defaultYRange = computeAdjustedExtent(lastData) || defaultYRange;
    chartNavigationBounds.yMin = null;
    chartNavigationBounds.yMax = null;
    chartViewport.yMin = null;
    chartViewport.yMax = null;
    chartYViewportActive = false;
    yMinInput.value = '';
    yMaxInput.value = '';
    updateBaselineSelectOptions();
    renderChartFromData(lastData);
    scheduleLocalSave();
  }

  function setActiveStripeSet(setId) {
    if (!setId) return;
    if (!stripeSets[setId]) {
      stripeSets[setId] = [];
    }
    activeStripeSet = setId;
    stripeSetBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.set === setId);
    });
    renderChartFromData(lastData);
    renderStripesTable();
    scheduleLocalSave();
  }

  function renderStripesTable() {
    if (!peaksBody || !peaksEmpty) return;
    if (confirmAllPeaksBtn) confirmAllPeaksBtn.disabled = !lastData || !activeSpectrumCandidates().length;
    peaksBody.innerHTML = '';
    const stripes = currentStripes();
    if (!stripes.length) {
      peaksEmpty.style.display = 'block';
      scheduleLocalSave();
      return;
    }
    peaksEmpty.style.display = 'none';
    stripes.forEach((stripe) => {
      const row = document.createElement('div');
      row.className = 'peaks-row';
      const colorSwatch = document.createElement('div');
      colorSwatch.className = 'peaks-color';
      colorSwatch.style.background = stripe.color;
      const val = document.createElement('input');
      val.type = 'number';
      val.step = '0.01';
      val.className = 'peaks-input';
      val.value = stripe.x.toFixed(2);
      val.addEventListener('change', () => {
        commitStripePosition(stripe, val.value);
      });

      const nameCell = document.createElement('input');
      nameCell.type = 'text';
      nameCell.className = 'peaks-input';
      nameCell.value = stripe.labelSource === 'manual' ? (stripe.label || '') : (stripe.analysisLabel || stripe.label || '');
      nameCell.placeholder = t('colLabel');
      nameCell.addEventListener('input', () => {
        stripe.label = nameCell.value;
        stripe.labelSource = 'manual';
        renderChartFromData(lastData, { skipLegend: true });
        scheduleLocalSave();
      });

      const tipCell = document.createElement('div');
      tipCell.className = 'peaks-tip';
      tipCell.textContent = stripe.analysisTip || stripe.tip || t('tipPlaceholder');
      const spectrum = lastSpectra.find((item) => item.id === stripe.spectrumId);
      const spectrumMeta = document.createElement('div');
      spectrumMeta.className = 'peaks-meta';
      spectrumMeta.textContent = `Spectrum: ${spectrum?.name || stripe.spectrumId || 'not assigned'}`;
      tipCell.prepend(spectrumMeta);
      if (stripe.widthCm1 !== undefined || stripe.intensity !== undefined || stripe.shape) {
        const meta = document.createElement('div');
        meta.className = 'peaks-meta';
        const width = finiteNumber(stripe.widthCm1);
        const fwhm = finiteNumber(stripe.fwhmCm1);
        const intensity = finiteNumber(stripe.intensity);
        const prominence = finiteNumber(stripe.prominence);
        const widthText = width !== null ? `${width.toFixed(2)} cm⁻¹` : '—';
        const fwhmText = fwhm !== null ? `${fwhm.toFixed(2)} cm⁻¹` : '—';
        const intensityText = intensity !== null ? `${intensity}%` : '—';
        const prominenceText = prominence !== null ? `${prominence.toFixed(3)}` : '—';
        meta.textContent = `Width: ${widthText} | FWHM: ${fwhmText} | Prominence: ${prominenceText} | Confidence: ${intensityText} | Shape: ${stripe.shape || '—'}`;
        tipCell.appendChild(meta);
      }
      if (stripe.manualMeasurementPending) {
        const measuring = document.createElement('div');
        measuring.className = 'peaks-meta';
        measuring.textContent = 'Parameters are being refined by the server…';
        tipCell.appendChild(measuring);
      }
      if (stripe.manualMeasurementError) {
        const measurementError = document.createElement('div');
        measurementError.className = 'peaks-quality-warning';
        measurementError.textContent = `Server measurement unavailable: ${stripe.manualMeasurementError}`;
        tipCell.appendChild(measurementError);
      }
      if (Array.isArray(stripe.qualityFlags) && stripe.qualityFlags.length) {
        const qualityLabels = {
          possible_atmospheric_co2: t('qualityPossibleCo2'),
          possible_low_frequency_artifact: t('qualityLowFrequency'),
          width_unresolved: t('qualityWidthUnresolved'),
        };
        const quality = document.createElement('div');
        quality.className = 'peaks-quality-warning';
        quality.textContent = `${t('peakQualityFlags')}: ${stripe.qualityFlags.map((flag) => qualityLabels[flag] || flag).join(', ')}`;
        tipCell.appendChild(quality);
      }
      const moveWrap = document.createElement('div');
      moveWrap.className = 'peaks-move';
      const measureBtn = document.createElement('button');
      measureBtn.type = 'button';
      measureBtn.className = 'peaks-move-btn';
      measureBtn.textContent = t('peakMeasureBoundaries');
      measureBtn.title = t('peakMeasureBoundariesHint');
      measureBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        startStripeMeasurement(activeStripeSet, stripe.id);
      });
      moveWrap.appendChild(measureBtn);
      ['candidates', 'confirmed'].forEach((setId) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'peaks-move-btn';
        btn.textContent = setId === 'candidates' ? '→ Cand' : '→ Conf';
        btn.disabled = setId === activeStripeSet;
        if (btn.disabled) {
          btn.style.display = 'none';
        }
        btn.addEventListener('click', () => {
          stripeSets[activeStripeSet] = (stripeSets[activeStripeSet] || []).filter((s) => s.id !== stripe.id);
          const target = stripeSets[setId] || [];
          stripeSets[setId] = [...target, { ...stripe, color: stripeColors[target.length % stripeColors.length] }];
          setActiveStripeSet(setId);
          scheduleLocalSave();
        });
        moveWrap.appendChild(btn);
      });
      const removeBtn = document.createElement('button');
      removeBtn.className = 'peaks-remove';
      removeBtn.setAttribute('aria-label', 'remove stripe');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        stripeSets[activeStripeSet] = (stripeSets[activeStripeSet] || []).filter((s) => s.id !== stripe.id);
        renderChartFromData(lastData);
        renderStripesTable();
        scheduleLocalSave();
      });
      row.append(colorSwatch, val, nameCell, tipCell, moveWrap, removeBtn);
      peaksBody.appendChild(row);
    });
  }

  function setControlsEnabled(enabled) {
    refreshBtn.disabled = !enabled;
    saveCsvBtn.disabled = !enabled;
    resetZoomBtn.disabled = !enabled;
    copyPngBtn.disabled = !enabled;
    copySvgBtn.disabled = !enabled;
    if (showPointsInput) showPointsInput.disabled = true;
    if (detectPeaksBtn) detectPeaksBtn.disabled = !enabled || !lastSpectra.length;
    if (openPeakSettingsBtn) openPeakSettingsBtn.disabled = !enabled || !lastSpectra.length;
    if (openPeakProcessingBtn) openPeakProcessingBtn.disabled = !enabled || !lastPeakProcessing || lastPeakProcessing.spectrumId !== activeSpectrumId;
    if (confirmAllPeaksBtn) confirmAllPeaksBtn.disabled = !enabled || !activeSpectrumCandidates().length;
    xMinInput.disabled = !enabled;
    xMaxInput.disabled = !enabled;
    yMinInput.disabled = !enabled;
    yMaxInput.disabled = !enabled;
    if (baselineSeriesSelect) baselineSeriesSelect.disabled = true;
    if (baselineDegreeInput) baselineDegreeInput.disabled = true;
    if (baselinePreviewBtn) baselinePreviewBtn.disabled = true;
    if (baselineApplyBtn) baselineApplyBtn.disabled = true;
    if (baselineRevertBtn) baselineRevertBtn.disabled = true;
    chartRow.classList.toggle('is-hidden', !enabled);
    chartControls?.classList.toggle('active', enabled);
    if (openChartSettingsBtn) openChartSettingsBtn.disabled = !enabled;
    yMinInput.placeholder = t('yAuto') || 'auto';
    yMaxInput.placeholder = t('yAuto') || 'auto';
    updateDetectorControls();
  }

  function currentUserProfile() {
    return window.FTIR_SETTINGS?.get?.() || userProfile;
  }

  function populateAppSettings(profile = currentUserProfile()) {
    if (!profile) return;
    if (settingsMode) settingsMode.value = profile.mode || 'development';
    if (settingsAnalysisApi) settingsAnalysisApi.value = profile.connections?.analysisApi || '';
    if (settingsPeakApi) settingsPeakApi.value = profile.connections?.peakDetectionApi || '';
    if (settingsReferenceApi) settingsReferenceApi.value = profile.connections?.referenceSearchApi || '';
    if (settingsApiCredentials) settingsApiCredentials.value = profile.connections?.apiCredentials === 'include' ? 'include' : 'omit';
    if (settingsLlmProvider) settingsLlmProvider.value = profile.llm?.provider || 'server';
    if (settingsLlmModel) settingsLlmModel.value = profile.llm?.model || '';
    if (settingsLlmApiKey) settingsLlmApiKey.value = profile.llm?.apiKey || '';
    if (settingsAnalysisToken) settingsAnalysisToken.value = profile.auth?.analysisAccessToken || '';
    if (settingsReferenceToken) settingsReferenceToken.value = profile.auth?.referenceServiceToken || '';
  }

  function profileFromSettingsForm() {
    const current = currentUserProfile();
    return {
      ...current,
      mode: settingsMode?.value || current.mode,
      connections: {
        ...current.connections,
        analysisApi: settingsAnalysisApi?.value.trim() || '',
        peakDetectionApi: settingsPeakApi?.value.trim() || '',
        referenceSearchApi: settingsReferenceApi?.value.trim() || '',
        apiCredentials: settingsApiCredentials?.value === 'include' ? 'include' : 'omit',
      },
      llm: {
        ...current.llm,
        provider: settingsLlmProvider?.value || 'server',
        model: settingsLlmModel?.value.trim() || '',
        apiKey: settingsLlmApiKey?.value.trim() || '',
      },
      auth: {
        ...current.auth,
        analysisAccessToken: settingsAnalysisToken?.value.trim() || '',
        referenceServiceToken: settingsReferenceToken?.value.trim() || '',
      },
    };
  }

  function downloadSettingsFile(settingsDocument, filename) {
    const blob = new Blob([JSON.stringify(settingsDocument, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function openAppSettings() {
    if (!appSettingsDialog) return;
    populateAppSettings();
    appSettingsDialog.showModal();
  }

  async function exportUserSettings(includeSecrets) {
    try {
      const password = includeSecrets ? window.prompt(t('settingsExportPassword')) : '';
      if (includeSecrets && !password) return;
      const document = await window.FTIR_SETTINGS.makeExport(includeSecrets, password);
      downloadSettingsFile(document, includeSecrets ? 'ftir-settings-encrypted.json' : 'ftir-settings.json');
    } catch (error) {
      setStatus(error.message || 'Settings export failed.', true);
    }
  }

  async function importUserSettings(file) {
    if (!file) return;
    try {
      const document = JSON.parse(await file.text());
      const password = document?.kind === 'ftir-user-settings-encrypted'
        ? window.prompt(t('settingsImportPassword'))
        : '';
      if (document?.kind === 'ftir-user-settings-encrypted' && !password) return;
      window.FTIR_SETTINGS.importDocument(document, password);
      setStatus(t('settingsImported'));
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      setStatus(error.message || 'Settings import failed.', true);
    } finally {
      if (importUserSettingsInput) importUserSettingsInput.value = '';
    }
  }

  refreshBtn.addEventListener('click', () => {
    if (lastData) {
      renderChartFromData(lastData);
    }
  });

  openAppSettingsBtn?.addEventListener('click', openAppSettings);
  closeAppSettingsBtn?.addEventListener('click', () => appSettingsDialog?.close());
  appSettingsForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      window.FTIR_SETTINGS.save(profileFromSettingsForm());
      setStatus(t('settingsSaved'));
      appSettingsDialog?.close();
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      setStatus(error.message || 'Settings save failed.', true);
    }
  });
  exportUserSettingsBtn?.addEventListener('click', () => { void exportUserSettings(false); });
  exportUserSettingsWithSecretsBtn?.addEventListener('click', () => { void exportUserSettings(true); });
  importUserSettingsBtn?.addEventListener('click', () => importUserSettingsInput?.click());
  importUserSettingsInput?.addEventListener('change', () => { void importUserSettings(importUserSettingsInput.files?.[0]); });
  resetUserSettingsBtn?.addEventListener('click', () => {
    if (!window.confirm('Reset this browser profile? Imported service URLs and all local tokens will be removed.')) return;
    window.FTIR_SETTINGS.reset();
    setStatus(t('settingsSaved'));
    appSettingsDialog?.close();
    window.setTimeout(() => window.location.reload(), 250);
  });

  spectrumSettingsForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const spectrumId = spectrumSettingsId?.value;
    const column = spectrumColumn(spectrumId);
    if (!column) {
      closeSpectrumSettings();
      return;
    }
    const name = spectrumSettingsName?.value.trim() || '';
    if (name) customNames.set(column, name);
    else customNames.delete(column);
    offsets.set(column, Number(spectrumSettingsOffset?.value) || 0);
    const spectrum = lastSpectra.find((item) => item.id === spectrumId);
    const role = spectrumSettingsRole?.value || 'unknown';
    spectrumRoles.set(spectrumId, role);
    if (spectrum) spectrum.role = role;
    closeSpectrumSettings();
    updateSpectrumSelector();
    updateBaselineSelectOptions();
    renderChartFromData(lastData);
    renderStripesTable();
    scheduleLocalSave();
  });

  openChartSettingsBtn?.addEventListener('click', () => {
    if (!chartSettingsDialog || !lastData) return;
    chartSettingsDialog.showModal();
  });
  closeChartSettingsBtn?.addEventListener('click', () => {
    updateNavigationBoundsFromInputs({ resetAutoY: true });
    applyRangeChanges();
    scheduleLocalSave();
    if (chartSettingsDialog?.open) chartSettingsDialog.close();
  });
  chartSettingsDialog?.addEventListener('click', (event) => {
    if (event.target === chartSettingsDialog) {
      updateNavigationBoundsFromInputs({ resetAutoY: true });
      applyRangeChanges();
      scheduleLocalSave();
      chartSettingsDialog.close();
    }
  });

  closeSpectrumSettingsBtn?.addEventListener('click', closeSpectrumSettings);
  spectrumSettingsDialog?.addEventListener('click', (event) => {
    if (event.target === spectrumSettingsDialog) closeSpectrumSettings();
  });
  removeSpectrumFromDialogBtn?.addEventListener('click', () => {
    const column = spectrumColumn(spectrumSettingsId?.value);
    closeSpectrumSettings();
    if (column) removeSeries(column);
  });

  detectPeaksBtn?.addEventListener('click', detectPeaks);

  peakDetectionHelpBtn?.addEventListener('click', () => {
    peakDetectionHelpDialog?.showModal();
  });
  closePeakDetectionHelpBtn?.addEventListener('click', () => {
    if (peakDetectionHelpDialog?.open) peakDetectionHelpDialog.close();
  });
  peakDetectionHelpDialog?.addEventListener('click', (event) => {
    if (event.target === peakDetectionHelpDialog) peakDetectionHelpDialog.close();
  });

  function renderPeakProcessingDiagnostics(processing, options = {}) {
    if (!peakProcessingChart) return;
    const compact = Boolean(options.compact);
    peakProcessingChart.innerHTML = '';
    const diagnostics = processing?.diagnostics;
    if (!diagnostics?.x?.length) {
      peakProcessingChart.textContent = t('peakProcessingEmpty');
      return;
    }
    const xValues = diagnostics.x.map(Number);
    const series = [
      { key: 'signal', label: t('peakProcessingSignal'), color: '#2563eb', dash: null },
      { key: 'baseline', label: t('peakProcessingBaseline'), color: '#dc2626', dash: '6,4' },
      { key: 'corrected', label: t('peakProcessingCorrected'), color: '#16a34a', dash: null },
      { key: 'broadCorrected', label: t('peakProcessingBroad'), color: '#9333ea', dash: '3,3' },
    ].map((item) => ({ ...item, values: (diagnostics[item.key] || []).map(Number) }));
    const points = series.flatMap((item) => item.values).filter(Number.isFinite);
    if (!points.length) {
      peakProcessingChart.textContent = t('peakProcessingEmpty');
      return;
    }
    const width = Math.max(compact ? 420 : 640, peakProcessingChart.clientWidth || (compact ? 680 : 900));
    const height = compact ? 300 : 360;
    const margin = { top: 28, right: 16, bottom: 40, left: 54 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const svg = d3.select(peakProcessingChart).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', t('peakProcessingTitle'));
    const x = d3.scaleLinear()
      .domain([d3.max(xValues), d3.min(xValues)])
      .range([0, innerWidth]);
    const extent = d3.extent(points);
    const padding = Math.max((extent[1] - extent[0]) * 0.08, 0.02);
    const y = d3.scaleLinear()
      .domain([extent[0] - padding, extent[1] + padding])
      .nice()
      .range([innerHeight, 0]);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    plot.append('g').attr('class', 'processing-grid')
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(''));
    plot.append('g').attr('class', 'processing-axis')
      .attr('transform', `translate(0,${innerHeight})`).call(d3.axisBottom(x));
    plot.append('g').attr('class', 'processing-axis').call(d3.axisLeft(y));
    const line = d3.line()
      .defined((item) => Number.isFinite(item.x) && Number.isFinite(item.y))
      .x((item) => x(item.x))
      .y((item) => y(item.y));
    series.forEach((item) => {
      const values = item.values.slice(0, xValues.length).map((value, index) => ({ x: xValues[index], y: value }));
      plot.append('path').datum(values).attr('class', 'processing-line')
        .attr('d', line).attr('stroke', item.color)
        .attr('stroke-dasharray', item.dash || null);
    });
    const legend = svg.append('g').attr('class', 'processing-legend').attr('transform', `translate(${margin.left},14)`);
    let legendX = 0;
    series.forEach((item) => {
      const group = legend.append('g').attr('transform', `translate(${legendX},0)`);
      group.append('line').attr('x1', 0).attr('x2', 22).attr('y1', 0).attr('y2', 0)
        .attr('stroke', item.color).attr('stroke-width', 2).attr('stroke-dasharray', item.dash || null);
      group.append('text').attr('x', 28).attr('y', 4).text(item.label);
      legendX += item.key === 'broadCorrected' ? 170 : 130;
    });
    svg.append('text').attr('class', 'processing-axis-label').attr('x', width / 2).attr('y', height - 5)
      .attr('text-anchor', 'middle').text('cm⁻¹');
    if (peakProcessingMeta) {
      peakProcessingMeta.textContent = `${processing.signalType || 'unknown'} · ${processing.baselineMethod || 'unknown'} / ${processing.baselineEngine || 'unknown'}`;
    }
  }

  openPeakProcessingBtn?.addEventListener('click', () => {
    if (!lastPeakProcessing || lastPeakProcessing.spectrumId !== activeSpectrumId) return;
    renderPeakProcessingDiagnostics(lastPeakProcessing);
    peakProcessingDialog?.showModal();
  });
  closePeakProcessingBtn?.addEventListener('click', () => {
    if (peakProcessingDialog?.open) peakProcessingDialog.close();
  });
  peakProcessingDialog?.addEventListener('click', (event) => {
    if (event.target === peakProcessingDialog) peakProcessingDialog.close();
  });

  openPeakSettingsBtn?.addEventListener('click', () => {
    if (!lastData || !activeSpectrumId) return;
    const applied = detectorAppliedSettings.get(activeSpectrumId);
    if (detectorBaselineMethod && applied?.baselineMethod) detectorBaselineMethod.value = applied.baselineMethod;
    if (detectorSignalType && applied?.signalType) detectorSignalType.value = applied.signalType;
    peakDetectorSettingsDialog?.showModal();
    previewPeakBaseline();
  });
  const closePeakSettings = () => {
    if (peakDetectorSettingsDialog?.open) peakDetectorSettingsDialog.close();
  };
  closePeakSettingsBtn?.addEventListener('click', closePeakSettings);
  cancelPeakSettingsBtn?.addEventListener('click', closePeakSettings);
  peakDetectorSettingsDialog?.addEventListener('click', (event) => {
    if (event.target === peakDetectorSettingsDialog) closePeakSettings();
  });
  applyPeakBaselineBtn?.addEventListener('click', applyPeakBaseline);
  detectorBaselineMethod?.addEventListener('change', () => {
    updateDetectorControls();
    previewPeakBaseline();
    scheduleLocalSave();
  });
  detectorSignalType?.addEventListener('change', () => {
    updateDetectorControls();
    if (peakDetectorSettingsDialog?.open) previewPeakBaseline();
    scheduleLocalSave();
  });
  [detectorMinProminence, detectorMinSeparation, detectorSmoothingWindow, baselineDegreeInput].forEach((input) => {
    input?.addEventListener('input', scheduleLocalSave);
    input?.addEventListener('change', scheduleLocalSave);
  });

  confirmAllPeaksBtn?.addEventListener('click', () => {
    const candidates = activeSpectrumCandidates();
    if (!candidates.length) {
      setStatus('No candidate peaks for the selected spectrum.', true);
      return;
    }
    const confirmed = Array.isArray(stripeSets.confirmed) ? stripeSets.confirmed : [];
    const confirmedIds = new Set(confirmed.map((stripe) => stripe.peakId || stripe.id));
    const newConfirmed = candidates.filter((stripe) => !confirmedIds.has(stripe.peakId || stripe.id));
    stripeSets.confirmed = [...confirmed, ...newConfirmed];
    const candidateIds = new Set(candidates.map((stripe) => stripe.id));
    stripeSets.candidates = (stripeSets.candidates || []).filter((stripe) => !candidateIds.has(stripe.id));
    activeStripeSet = 'confirmed';
    stripeSetBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.set === 'confirmed'));
    if (confirmAllPeaksBtn) confirmAllPeaksBtn.disabled = true;
    renderChartFromData(lastData);
    renderStripesTable();
    scheduleLocalSave();
    const spectrum = lastSpectra.find((item) => item.id === activeSpectrumId);
    setStatus(`Confirmed ${newConfirmed.length} peaks for ${spectrum?.name || activeSpectrumId}.`);
  });

  togglePeaksTableBtn?.addEventListener('click', () => {
    if (!peaksTableWrap) return;
    applyPeaksTableState(!peaksTableCollapsed);
    scheduleLocalSave();
  });

  const getBaselineParams = () => {
    if (BASELINE_DISABLED) return { series: null, degree: 2 };
    const series = baselineSeriesSelect?.value;
    let degree = parseInt(baselineDegreeInput?.value, 10);
    if (!Number.isFinite(degree)) degree = 2;
    degree = Math.min(Math.max(degree, 1), 8);
    if (baselineDegreeInput) baselineDegreeInput.value = String(degree);
    return { series, degree };
  };

  baselinePreviewBtn?.addEventListener('click', () => {});

  baselineApplyBtn?.addEventListener('click', () => {});

  baselineRevertBtn?.addEventListener('click', () => {});

  baselineSeriesSelect?.addEventListener('change', scheduleLocalSave);

  addStripeBtn?.addEventListener('click', () => {
    const xVal =
      markerActive && markerX !== null
        ? markerX
        : (() => {
            const viewport = getChartViewport(computeAdjustedExtent(lastData) || [0, 1]);
            const cx = viewport.xMax;
            const cn = viewport.xMin;
            return (cx + cn) / 2;
          })();
    const allStripes = Array.isArray(stripeSets[activeStripeSet])
      ? stripeSets[activeStripeSet]
      : [];
    const current = currentStripes();
    const color = stripeColors[current.length % stripeColors.length];
    stripeIdSeq += 1;
    const spectrumId = markerSpectrumId || lastSpectra[0]?.id || null;
    const peakId = `peak-${spectrumId || 'unassigned'}-${stripeIdSeq}`;
    const matches = tipsForX(xVal);
    const label = matches[0]?.class || matches[0]?.group || '';
    const tipText = matches
      .map((m) => [m.group, m.class, m.details].filter(Boolean).join(' — '))
      .join('; ');
    const nearestPoint = findNearestSpectrumPoint(xVal, spectrumId);
    const calculated = estimateManualPeakParameters(nearestPoint?.x ?? xVal, spectrumId);
    // Keep the manual marker at the selected coordinate. `originalNu` may
    // describe a nearby apex used only for the parameter calculation.
    const peakX = Number(xVal.toFixed(2));
    clientLog('peak.manual.add', {
      spectrumId,
      x: peakX,
      activeSet: activeStripeSet,
      previousPeaksForSpectrum: current.length,
      totalPeaksBefore: allStripes.length,
      calculated: {
        prominence: calculated.prominence ?? null,
        widthCm1: calculated.widthCm1 ?? null,
        fwhmCm1: calculated.fwhmCm1 ?? null,
        shape: calculated.shape || null,
        qualityFlags: calculated.qualityFlags || [],
      },
    });
    // `currentStripes()` is intentionally filtered to the selected spectrum
    // for display. Do not use that filtered array as the replacement for the
    // whole set, otherwise manual insertion removes peaks from other spectra.
    const stripe = {
      id: `stripe-${stripeIdSeq}`,
      peakId,
      spectrumId,
      x: peakX,
      color,
      label,
      tip: tipText,
      labelSource: label ? 'peak-db' : 'empty',
      source: 'manual',
      manualMeasurementPending: true,
      ...calculated,
    };
    stripeSets[activeStripeSet] = [...allStripes, stripe];
    renderChartFromData(lastData);
    renderStripesTable();
    scheduleLocalSave();
    void measureManualPeakOnServer(stripe);
  });

  copyStripesBtn?.addEventListener('click', () => {
    const stripes = currentStripes();
    if (!stripes.length) return;
    const header = ['wavenumber', 'label', 'tip', 'width_cm1', 'fwhm_cm1', 'intensity', 'shape'];
    const rows = stripes.map((s) => [
      s.x.toFixed(2),
      s.labelSource === 'manual' ? (s.label || '') : (s.analysisLabel || s.label || ''),
      s.analysisTip || s.tip || '',
      s.widthCm1 ?? '',
      s.fwhmCm1 ?? '',
      s.intensity ?? '',
      s.shape || '',
    ]);
    const report = analysisData
      ? [``, 'INTERPRETATION', analysisData.interpretation || '', `CONFIDENCE\t${analysisData.confidence || 'unknown'}`]
      : [];
    const tsv = [header.join('\t'), ...rows.map((r) => r.join('\t')), ...report].join('\n');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(tsv).then(
        () => setStatus('Copied stripes.'),
        () => setStatus('Copy failed.', true)
      );
    }
  });

  copyConfirmedPayloadBtn?.addEventListener('click', () => {
    const payload = buildConfirmedPeaksPayload();
    if (!payload.confirmedPeaks.length) {
      setStatus('No confirmed peaks to copy.', true);
      return;
    }
    const text = JSON.stringify(payload, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setStatus('Copied confirmed peaks JSON.'),
        () => setStatus('Copy failed.', true)
      );
    } else {
      setStatus('Clipboard is unavailable.', true);
    }
  });

  analyzeConfirmedBtn?.addEventListener('click', analyzeConfirmedPeaks);
  searchLocalReferencesBtn?.addEventListener('click', searchLocalReferences);
  referenceSidebarToggleBtn?.addEventListener('click', () => setReferenceSidebarOpen(!referenceSidebarOpen));
  clearLocalSessionBtn?.addEventListener('click', clearLocalSession);

  const copyCurrentSvg = () => {
    const svg = chartEl.querySelector('svg');
    if (!svg) {
      setStatus('No chart to copy', true);
      return null;
    }
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svg);
    return { svgText, svg };
  };

  copySvgBtn?.addEventListener('click', () => {
    const res = copyCurrentSvg();
    if (!res) return;
    const blob = new Blob([res.svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  copyPngBtn?.addEventListener('click', () => {
    const res = copyCurrentSvg();
    if (!res) return;
    const { svg, svgText } = res;
    const viewBox = svg.getAttribute('viewBox')?.split(' ').map(Number);
    const width = viewBox && viewBox[2] ? viewBox[2] : svg.clientWidth || 800;
    const height = viewBox && viewBox[3] ? viewBox[3] : svg.clientHeight || 420;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'chart.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(pngUrl);
      });
    };
    img.src = url;
  });

  exportSessionBtn?.addEventListener('click', () => {
    if (!lastFilesRaw.length) {
      setStatus('Nothing to export', true);
      return;
    }
    const session = buildSessionSnapshot();
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ftir_session.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importSessionBtn?.addEventListener('click', () => importSessionInput?.click());
  importSessionInput?.addEventListener('change', async () => {
    const f = importSessionInput.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const session = JSON.parse(text);
      if (!Array.isArray(session.files)) throw new Error('Invalid session');
      if (session.settings) applyPersistentSettings(session.settings);
      if (sampleInput) sampleInput.value = session.sampleIndex || '';
      fileNameInput.value = session.fileName || 'merged.csv';
      lastFilesRaw = session.files.map((x) => ({ name: x.name, content: x.content }));
      spectrumRoles = new Map((session.spectra || [])
        .filter((spectrum) => spectrum?.id)
        .map((spectrum) => [String(spectrum.id), spectrum.role || 'unknown']));
      stripeSets = session.stripeSets || stripeSets;
      referenceSearchesBySpectrum = restoreReferenceSearches(session.referenceSearches);
      analysisData = session.analysis || null;
      if (analysisPromptInput) analysisPromptInput.value = String(session.analysisPrompt || '').slice(0, 2000);
      activeStripeSet = session.activeStripeSet || activeStripeSet;
      stripeIdSeq = Number(session.stripeIdSeq) || stripeIdSeq;
      markerActive = Boolean(session.markerActive ?? session.settings?.peaks?.markerActive ?? markerActive);
      markerX = session.markerX !== undefined && session.markerX !== null ? Number(session.markerX) : session.settings?.peaks?.markerX ?? markerX;
      applyPeaksTableState(session.peaksTableCollapsed ?? session.settings?.peaks?.tableCollapsed ?? peaksTableCollapsed);
      if (!stripeSets[activeStripeSet]) stripeSets[activeStripeSet] = [];
      processFiles(lastFilesRaw, {
        fileName: session.fileName,
        sampleIndex: session.sampleIndex,
        offsets: session.offsets,
        visibleSeries: session.visibleSeries,
        baselineSeries: session.baselineSeries,
        baselineModel: session.baselineModel,
        detectorAppliedSettings: session.detectorAppliedSettings,
        detectorProcessedBySpectrum: session.detectorProcessedBySpectrum,
        xRange: session.xRange,
        yRange: session.yRange,
        chartBounds: session.chartBounds || session.settings?.chart?.bounds,
        viewport: session.viewport || session.settings?.chart?.viewport,
        yViewportActive: session.yViewportActive ?? session.settings?.chart?.yViewportActive,
        customNames: session.customNames,
        stripeSets: stripeSets,
        markerSpectrumId: session.markerSpectrumId,
        activeSpectrumId: session.activeSpectrumId,
      });
      if (session.settings) {
        applyPersistentSettings(session.settings);
        updateDetectorControls();
      }
      if (analysisData && analysisCard && analysisResult) {
        analysisCard.hidden = false;
        analysisStatus.textContent = 'Restored';
        analysisResult.innerHTML = renderAnalysisReport(analysisData);
      }
      renderActiveReferenceSearch();
      if (activeSpectrumId) void resolveStrongReferenceMetadata(activeSpectrumId);
      scheduleLocalSave();
    } catch (err) {
      console.error(err);
      setStatus('Failed to import session', true);
    } finally {
      importSessionInput.value = '';
    }
  });
  resetZoomBtn.addEventListener('click', () => {
    setNavigationBounds({
      xMin: defaultXRange.min,
      xMax: defaultXRange.max,
      yMin: null,
      yMax: null,
    });
    setChartViewport({
      xMin: defaultXRange.min,
      xMax: defaultXRange.max,
      yMin: null,
      yMax: null,
    });
    chartYViewportActive = false;
    setRangeInputs({
      xMax: defaultXRange.max,
      xMin: defaultXRange.min,
      yMin: null,
      yMax: null,
    });
    renderChartFromData(lastData);
    scheduleLocalSave();
  });
  const applyRangeChanges = () => {
    if (!lastData) return;
    renderChartFromData(lastData);
  };
  [xMinInput, xMaxInput, yMinInput, yMaxInput].forEach((el) => {
    el.addEventListener('input', () => {
      updateNavigationBoundsFromInputs({ resetAutoY: el === yMinInput || el === yMaxInput });
      scheduleLocalSave();
    });
    el.addEventListener('change', () => {
      updateNavigationBoundsFromInputs({ resetAutoY: el === yMinInput || el === yMaxInput });
      applyRangeChanges();
      scheduleLocalSave();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateNavigationBoundsFromInputs({ resetAutoY: el === yMinInput || el === yMaxInput });
        applyRangeChanges();
        scheduleLocalSave();
      }
    });
  });
  // show points disabled

  saveCsvBtn.addEventListener('click', async () => {
    if (!lastParsedRows.length || !lastColumns.length) return;
    const defaultName = fileNameInput.value.trim() || 'merged.csv';
    const activeCols = lastColumns.filter((col) => visibleSeries.get(col) !== false);
    if (!activeCols.length) {
      setStatus(t('statusNoVisible'), true);
      return;
    }
    const filteredCsv = buildCsvFromRows(lastParsedRows, activeCols);
    const blob = new Blob([filteredCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const downloadName = defaultName.toLowerCase().endsWith('.csv') ? defaultName : `${defaultName}.csv`;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(t('statusSaved')(downloadName));
  });

  async function handleMerge() {
    if (merging) return;
    merging = true;
    if (mergeBtn) mergeBtn.disabled = true;
    const files = Array.from(fileInput.files || []);
    if (!files.length) {
      setStatus(t('statusNoFiles'), true);
      merging = false;
      if (mergeBtn) mergeBtn.disabled = false;
      return;
    }
    setStatus(t('statusReading'));
    try {
      const payloadFiles = [];
      for (const f of files) {
        const content = await readFileText(f);
        payloadFiles.push({ name: f.name, content });
      }
      lastFilesRaw = payloadFiles;
      referenceSearchesBySpectrum = new Map();
      const downloadName = fileNameInput.value.trim() || 'merged.csv';
      setStatus(`${t('statusSending')} ${payloadFiles.length} files...`);
      processFiles(payloadFiles, { fileName: downloadName, markerSpectrumId: null });
    } catch (err) {
      console.error(err);
      setStatus(err.message, true);
    } finally {
      if (mergeBtn) mergeBtn.disabled = false;
      merging = false;
    }
  }

  async function appendFiles(fileList) {
    const newFiles = [];
    for (const f of fileList) {
      const content = await readFileText(f);
      newFiles.push({ name: f.name, content });
    }
    lastFilesRaw = [...(lastFilesRaw || []), ...newFiles];
    processFiles(lastFilesRaw, {
      fileName: fileNameInput.value,
      sampleIndex: sampleInput ? sampleInput.value : '',
      offsets: Object.fromEntries(offsets),
      visibleSeries: Object.fromEntries(visibleSeries),
      stripeSets,
      activeStripeSet,
      baselineSeries,
      baselineModel,
      xRange: { min: xMinInput.value, max: xMaxInput.value },
      yRange: { min: yMinInput.value, max: yMaxInput.value },
      chartBounds: { ...chartNavigationBounds },
      viewport: { ...chartViewport },
      yViewportActive: chartYViewportActive,
      customNames: Object.fromEntries(customNames),
      markerSpectrumId,
      activeSpectrumId,
    });
  }

  if (mergeBtn) mergeBtn.addEventListener('click', handleMerge);
  selectFilesBtn?.addEventListener('click', () => fileInput.click());

  document.addEventListener('keydown', (event) => {
    if (!markerUpdater || !markerActive) return;
    const key = event.key;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const step = event.shiftKey ? markerStep * 5 : markerStep;
      const direction = key === 'ArrowLeft' ? -step : step;
      markerUpdater(direction);
    }
  });
  function resetWorkspace() {
    merging = false;
    lastColumns = [];
    lastParsedRows = [];
    lastData = null;
    chartNavigationBounds = {
      xMin: defaultXRange.min,
      xMax: defaultXRange.max,
      yMin: null,
      yMax: null,
    };
    chartViewport = {
      xMin: defaultXRange.min,
      xMax: defaultXRange.max,
      yMin: null,
      yMax: null,
    };
    chartYViewportActive = false;
    lastSpectra = [];
    spectrumRoles = new Map();
    lastFilesRaw = [];
    lastPeakProcessing = null;
    if (openPeakProcessingBtn) openPeakProcessingBtn.disabled = true;
    markerSpectrumId = null;
    activeSpectrumId = null;
    updateSpectrumSelector();
    visibleSeries = new Map();
    offsets = new Map();
    baselineModel = null;
    baselinePreviewModel = null;
    baselineSeries = null;
    baselineMap = new Map();
    stripeSets = { candidates: [], confirmed: [] };
    detectorProcessedBySpectrum = new Map();
    detectorAppliedSettings = new Map();
    analysisData = null;
    referenceSearchesBySpectrum = new Map();
    setReferenceSidebarVisible(false);
    activeStripeSet = 'candidates';
    peaksTableCollapsed = false;
    applyPeaksTableState(false);
    stripeIdSeq = 0;
    fileInput.value = ''; // allow re-importing the same file
    if (mergeBtn) mergeBtn.disabled = false;
    setControlsEnabled(false);
    chartLegend.innerHTML = '';
    chartEl.innerHTML = '<p>No data loaded.</p>';
    chartRow.classList.add('is-hidden');
    if (peaksBody) peaksBody.innerHTML = '';
    if (peaksEmpty) peaksEmpty.style.display = 'block';
    downloadLinkEl.textContent = '';
    setStatus(t('statusNoFiles') || 'No data loaded');
    generateName();
  }

  function removeSeries(col) {
    if (!col) return;
    const removedSpectrumIds = new Set((lastData || [])
      .filter((point) => point.file === col && point.spectrumId)
      .map((point) => point.spectrumId));
    lastColumns = (lastColumns || []).filter((c) => c !== col);
    lastParsedRows = (lastParsedRows || []).map((row) => {
      const clone = { ...row };
      delete clone[col];
      return clone;
    });
    lastData = (lastData || []).filter((d) => d.file !== col);
    lastSpectra = (lastSpectra || []).filter((spectrum) => !removedSpectrumIds.has(spectrum.id));
    removedSpectrumIds.forEach((spectrumId) => {
      detectorProcessedBySpectrum.delete(spectrumId);
      detectorAppliedSettings.delete(spectrumId);
      referenceSearchesBySpectrum.delete(spectrumId);
    });
    Object.keys(stripeSets).forEach((setId) => {
      stripeSets[setId] = (stripeSets[setId] || []).filter((stripe) => !removedSpectrumIds.has(stripe.spectrumId));
    });
    if (removedSpectrumIds.has(markerSpectrumId)) markerSpectrumId = lastSpectra[0]?.id || null;
    if (removedSpectrumIds.has(activeSpectrumId)) activeSpectrumId = lastSpectra[0]?.id || null;
    lastPeakProcessing = detectorProcessedBySpectrum.get(activeSpectrumId) || null;
    updateDetectorControls();
    offsets.delete(col);
    visibleSeries.delete(col);
    customNames.delete(col);
    if (baselineSeries === col) {
      baselineSeries = null;
      baselineMap = new Map();
    }
    // remove one matching raw file by sanitized name
    let removed = false;
    lastFilesRaw = (lastFilesRaw || []).filter((f) => {
      if (removed) return true;
      if (sanitizeName(f.name) === col) {
        removed = true;
        return false;
      }
      return true;
    });
    const hasData = lastColumns.length > 0 && lastData && lastData.length > 0;
    if (!hasData) {
      resetWorkspace();
      return;
    }
    defaultYRange = computeAdjustedExtent(lastData) || defaultYRange;
    updateBaselineSelectOptions();
    updateSpectrumSelector();
    renderChartFromData(lastData);
    renderStripesTable();
    renderActiveReferenceSearch();
    scheduleLocalSave();
  }
  restoreLocalSettings();
  restoreLocalSession();
})();
  // pan mode button removed
