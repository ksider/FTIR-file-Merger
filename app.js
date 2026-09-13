(() => {
  const config = window.APP_CONFIG || {};
  const translations = config.translations || {};
  const supportedLangs = config.supportedLangs || Object.keys(translations) || ['en'];
  const footerLinks = config.footerLinks || {};
  const chartSettings = config.chart || {};
  const analysisApi = config.analysisApi || '/api/analyze';
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
  const chartLegend = document.getElementById('chartLegend');
  const i18nTargets = document.querySelectorAll('[data-i18n]');
  const langLinks = document.querySelectorAll('.lang-link');
  const addStripeBtn = document.getElementById('addStripe');
  const peaksBody = document.getElementById('peaksBody');
  const peaksEmpty = document.getElementById('peaksEmpty');
  const copyStripesBtn = document.getElementById('copyStripes');
  const copyConfirmedPayloadBtn = document.getElementById('copyConfirmedPayload');
  const analyzeConfirmedBtn = document.getElementById('analyzeConfirmed');
  const analysisCard = document.getElementById('analysisCard');
  const analysisStatus = document.getElementById('analysisStatus');
  const analysisResult = document.getElementById('analysisResult');
  const exportSessionBtn = document.getElementById('exportSession');
  const importSessionBtn = document.getElementById('importSession');
  const importSessionInput = document.getElementById('importSessionInput');
  const clearLocalSessionBtn = document.getElementById('clearLocalSession');
  const selectFilesBtn = document.getElementById('selectFiles');
  const stripeSetBtns = document.querySelectorAll('.stripe-set-btn');
  const peakDb = Array.isArray(window.FTIR_BASE) ? window.FTIR_BASE : [];
  const footerSite = document.getElementById('footerSite');
  const footerGithub = document.getElementById('footerGithub');
  const footerCoffee = document.getElementById('footerCoffee');

  const browserLang = ((navigator.language || 'en').slice(0, 2) || 'en').toLowerCase();
  let currentLang = supportedLangs.includes(browserLang) ? browserLang : 'en';

  let lastData = null;
  let offsets = new Map();
  let lastParsedRows = [];
  let lastColumns = [];
  let visibleSeries = new Map();
  let markerActive = false;
  let markerX = null;
  let markerUpdater = null;
  let markerStep = 1;
  let merging = false;
let defaultYRange = null;
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
let customNames = new Map();
let isPanning = false;
let panStartDomain = null;
let panMode = false;
let showPoints = false;
let panRaf = null;
let panQueued = null;
let measurementState = null;
let analysisData = null;
const LOCAL_SESSION_KEY = 'ftir_merger_local_session_v1';
let localSaveTimer = null;

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

  function t(key, arg) {
    const dict = translations[currentLang] || translations.en || {};
    const val = dict[key];
    const fallback = (translations.en || {})[key] || key;
    const resolved = typeof val === 'function' ? val(arg) : val;
    return resolved !== undefined ? resolved : fallback;
  }

  function applyTranslations() {
    i18nTargets.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
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
  }

  function setLanguage(lang) {
    currentLang = supportedLangs.includes(lang) ? lang : 'en';
    applyTranslations();
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

  function setRangeInputs({ xMin, xMax, yMin, yMax }) {
    if (typeof xMin === 'number') xMinInput.value = String(xMin);
    if (typeof xMax === 'number') xMaxInput.value = String(xMax);
    if (yMin !== undefined) yMinInput.value = yMin === null ? '' : String(yMin);
    if (yMax !== undefined) yMaxInput.value = yMax === null ? '' : String(yMax);
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

  function applyZoom(factor, centerX, centerY) {
    if (!lastData || !lastData.length) return;
    const currentXMax = Number(xMaxInput.value) || defaultXRange.max;
    const currentXMin = Number(xMinInput.value) || defaultXRange.min;
    const autoExtent = computeAdjustedExtent(lastData) || [0, 1];
    const currentYMin = yMinInput.value === '' ? autoExtent[0] : Number(yMinInput.value);
    const currentYMax = yMaxInput.value === '' ? autoExtent[1] : Number(yMaxInput.value);
    const baseYMin = defaultYRange ? defaultYRange[0] : autoExtent[0];
    const baseYMax = defaultYRange ? defaultYRange[1] : autoExtent[1];
    const safeFactor = Math.min(Math.max(factor, 0.5), 1.8); // limit per tick
    const zoomRange = (min, max, center, f) => {
      const minOff = min - center;
      const maxOff = max - center;
      let a = center + minOff * f;
      let b = center + maxOff * f;
      if (a < b) return [a, b];
      return [b, a];
    };
    let [nextXMin, nextXMax] = zoomRange(currentXMin, currentXMax, centerX, safeFactor);
    let [nextYMin, nextYMax] = zoomRange(currentYMin, currentYMax, centerY, safeFactor);

    const minSpanX = (defaultXRange.max - defaultXRange.min) * 0.01;
    const minSpanY = Math.abs(baseYMax - baseYMin) * 0.01 || 1;
    if (Math.abs(nextXMax - nextXMin) < minSpanX) {
      const half = minSpanX / 2;
      nextXMin = centerX - half;
      nextXMax = centerX + half;
    }
    if (Math.abs(nextYMax - nextYMin) < minSpanY) {
      const half = minSpanY / 2;
      nextYMin = centerY - half;
      nextYMax = centerY + half;
    }

    // Clamp back toward defaults on zoom-out
    const isZoomOut = factor > 1;
    if (isZoomOut) {
      nextXMin = Math.max(nextXMin, defaultXRange.min);
      nextXMax = Math.min(nextXMax, defaultXRange.max);
      nextYMin = Math.max(nextYMin, baseYMin);
      nextYMax = Math.min(nextYMax, baseYMax);
    }

    setRangeInputs({ xMax: nextXMax, xMin: nextXMin, yMin: nextYMin, yMax: nextYMax });
    renderChartFromData(lastData);
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
  if (sampleInput) sampleInput.addEventListener('input', generateName);
  generateName();

  function renderChartFromData(data, options = {}) {
    const { skipLegend = false } = options;
    if (!window.d3) return;
    if (!data || !data.length) return;
    const filteredRaw = data.filter((d) => typeof d.x === 'number' && typeof d.y === 'number' && d.x <= defaultXRange.max && d.x >= defaultXRange.min);
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
    const xMaxVal = Number(xMaxInput.value) || defaultXRange.max;
    const xMinVal = Number(xMinInput.value) || defaultXRange.min;
    const yMinVal = yMinInput.value === '' ? yDomainAuto[0] : Number(yMinInput.value);
    const yMaxVal = yMaxInput.value === '' ? yDomainAuto[1] : Number(yMaxInput.value);
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
      activeStripes.forEach((stripe) => {
        const sx = x(stripe.x);
        stripesLayer
          .append('line')
          .attr('x1', sx)
          .attr('x2', sx)
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', stripe.color || '#111')
          .attr('stroke-width', isCandidates ? 1.4 : 2.2)
          .attr('stroke-dasharray', isCandidates ? '6,4' : '4,2')
          .attr('opacity', isCandidates ? 0.7 : 1);
        stripesLayer
          .append('text')
          .attr('x', sx)
          .attr('y', -8)
          .attr('text-anchor', 'middle')
          .attr('fill', '#111827')
          .attr('font-size', 12)
          .attr('font-weight', '700')
          .text(`${stripe.x.toFixed(0)}`);
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
        const item = document.createElement('div');
        item.className = 'legend-item';
        if (baselineSeries === file) item.classList.add('baseline');
        if (visibleSeries.get(file) === false) item.classList.add('inactive');
        const swatch = document.createElement('div');
        swatch.className = 'legend-swatch';
        swatch.style.background = color(file);
        const labelInput = document.createElement('input');
        labelInput.className = 'legend-name-input';
        labelInput.value = customNames.get(file) || file;
        labelInput.title = file;
        labelInput.addEventListener('click', (e) => e.stopPropagation());
        labelInput.addEventListener('input', () => {
          customNames.set(file, labelInput.value);
          renderChartFromData(lastData, { skipLegend: true });
        });
        const offsetInput = document.createElement('input');
        offsetInput.type = 'number';
        offsetInput.step = '0.1';
        offsetInput.value = offsets.get(file) || 0;
        offsetInput.className = 'legend-offset';
        offsetInput.addEventListener('click', (e) => e.stopPropagation());
        offsetInput.addEventListener('input', () => {
          offsets.set(file, Number(offsetInput.value) || 0);
          renderChartFromData(lastData, { skipLegend: true });
          scheduleLocalSave();
        });
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'legend-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove series';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeSeries(file);
        });
        item.appendChild(swatch);
        item.appendChild(labelInput);
        // baseline toggle hidden
        item.appendChild(offsetInput);
        item.appendChild(removeBtn);
        item.addEventListener('click', () => {
          const current = visibleSeries.get(file);
          visibleSeries.set(file, current === false ? true : false);
          renderChartFromData(lastData);
        });
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

    const applyMarker = (xVal) => {
      const clamped = clampX(xVal);
      markerActive = true;
      markerX = clamped;
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

    const handlePointer = (event) => {
      const [px, py] = d3.pointer(event, g.node());
      if (px < 0 || px > innerW || py < 0 || py > innerH) return;
      const xVal = x.invert(px);
      if (measurementState) {
        applyMarker(xVal);
        measureStripeFromChart(xVal);
        return;
      }
      applyMarker(xVal);
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

    svg.on('pointerdown', (event) => {
      const [px, py] = d3.pointer(event, g.node());
      if (isPanEvent(event)) {
        isPanning = true;
        panStartDomain = {
          x: x.invert(px),
          y: y.invert(py),
          xMin: Number(xMinInput.value) || defaultXRange.min,
          xMax: Number(xMaxInput.value) || defaultXRange.max,
          yMin: yMinVal,
          yMax: yMaxVal,
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
        const newXMin = panStartDomain.xMin - dx;
        const newXMax = panStartDomain.xMax - dx;
        let newYMin = panStartDomain.yMin - dy;
        let newYMax = panStartDomain.yMax - dy;
        const baseRange = defaultYRange || yDomainAuto;
        if (baseRange && baseRange.length === 2) {
          newYMin = Math.max(newYMin, baseRange[0]);
          newYMax = Math.min(newYMax, baseRange[1]);
        }
        panQueued = { newXMin, newXMax, newYMin, newYMax };
        if (!panRaf) {
          panRaf = requestAnimationFrame(() => {
            if (panQueued) {
              const { newXMin: qMinX, newXMax: qMaxX, newYMin: qMinY, newYMax: qMaxY } = panQueued;
              xMinInput.value = qMinX;
              xMaxInput.value = qMaxX;
              yMinInput.value = String(qMinY);
              yMaxInput.value = String(qMaxY);
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

    svg.on(
      'wheel',
      (event) => {
        event.preventDefault();
        const delta = event.deltaY;
        const factor = Math.exp(delta * 0.0008);
        const [px, py] = d3.pointer(event, g.node());
        const xVal = x.invert(px);
        const yVal = y.invert(py);
        applyZoom(factor, xVal, yVal);
      },
      { passive: false }
    );
    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
    const handleKeyPan = (event) => {
      if (!lastData) return;
      const key = event.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
      event.preventDefault();
      const baseXMin = defaultXRange.min;
      const baseXMax = defaultXRange.max;
      const xSpan = Math.abs((Number(xMaxInput.value) || baseXMax) - (Number(xMinInput.value) || baseXMin)) || Math.abs(baseXMax - baseXMin);
      const ySpanDefault = defaultYRange ? Math.abs(defaultYRange[1] - defaultYRange[0]) : Math.abs(yDomainAuto[1] - yDomainAuto[0]);
      const ySpanCurrent = Math.abs((yMaxInput.value === '' ? yDomainAuto[1] : Number(yMaxInput.value)) - (yMinInput.value === '' ? yDomainAuto[0] : Number(yMinInput.value))) || ySpanDefault || 1;
      const stepX = xSpan * 0.05;
      const stepY = ySpanCurrent * 0.05;
      let currXMin = Number(xMinInput.value) || baseXMin;
      let currXMax = Number(xMaxInput.value) || baseXMax;
      let currYMin = yMinInput.value === '' ? yDomainAuto[0] : Number(yMinInput.value);
      let currYMax = yMaxInput.value === '' ? yDomainAuto[1] : Number(yMaxInput.value);
      const baseYMin = defaultYRange ? defaultYRange[0] : yDomainAuto[0];
      const baseYMax = defaultYRange ? defaultYRange[1] : yDomainAuto[1];
      if (key === 'ArrowLeft') {
        currXMin = clamp(currXMin + stepX, baseXMin, baseXMax - stepX);
        currXMax = clamp(currXMax + stepX, baseXMin + stepX, baseXMax);
      }
      if (key === 'ArrowRight') {
        currXMin = clamp(currXMin - stepX, baseXMin, baseXMax - stepX);
        currXMax = clamp(currXMax - stepX, baseXMin + stepX, baseXMax);
      }
      if (key === 'ArrowUp') {
        currYMin = clamp(currYMin + stepY, baseYMin, baseYMax - stepY);
        currYMax = clamp(currYMax + stepY, baseYMin + stepY, baseYMax);
      }
      if (key === 'ArrowDown') {
        currYMin = clamp(currYMin - stepY, baseYMin, baseYMax - stepY);
        currYMax = clamp(currYMax - stepY, baseYMin + stepY, baseYMax);
      }
      xMinInput.value = currXMin;
      xMaxInput.value = currXMax;
      yMinInput.value = String(currYMin);
      yMaxInput.value = String(currYMax);
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
    const downloadName = opts.fileName || fileNameInput.value.trim() || 'merged.csv';
    const columns = [];
    const table = new Map();
    let totalRows = 0;
    const failedFiles = [];
    payloadFiles.forEach((file) => {
      const parsed = parseSpectraContent(file.content, file.name);
      if (parsed && parsed.type === 'csv') {
        const { xKey, columns: csvCols, rows } = parsed;
        csvCols.forEach((csvCol) => {
          const colName = makeUniqueColumnName(columns, csvCol);
          let added = 0;
          rows.forEach((row) => {
            const x = row[xKey];
            const y = row[csvCol];
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const key = String(x);
            if (!table.has(key)) table.set(key, { x: Number(x), vals: new Map() });
            table.get(key).vals.set(colName, y);
            added++;
          });
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
      for (const [x, y] of rows) {
        const key = String(x);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (!table.has(key)) table.set(key, { x: Number(x), vals: new Map() });
        table.get(key).vals.set(col, y);
      }
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
    const series = [];
    for (const col of cols) {
      for (const row of parsed) {
        if (typeof row[col] === 'number' && typeof row.wavenumber === 'number') {
          series.push({ file: col, x: row.wavenumber, y: row[col] });
        }
      }
    }
    if (!series.length) {
      setStatus(t('statusNoNumeric'), true);
      return;
    }
    lastData = series;
    defaultYRange = computeAdjustedExtent(series) || d3.extent(series, (d) => d.y);
    stripeSets = opts.stripeSets || stripeSets;
    if (!stripeSets[activeStripeSet]) stripeSets[activeStripeSet] = [];
    baselinePreviewModel = null;
    baselineModel = null;
    baselineSeries = null;
    baselineMap = new Map();
    offsets = new Map();
    cols.forEach((col) => offsets.set(col, (opts.offsets && opts.offsets[col]) || 0));
    customNames = new Map(Object.entries(opts.customNames || {}));
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
    downloadLinkEl.textContent = '';
    if (failedFiles.length) {
      setStatus(`Imported with issues. Failed: ${failedFiles.join(', ')}`, true);
    } else {
      setStatus(t('statusReadyToSave'));
    }
    setControlsEnabled(true);
    renderChartFromData(lastData);
    renderStripesTable();
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

  function currentStripes() {
    return stripeSets[activeStripeSet] || [];
  }

  function findNearestSpectrumPoint(xVal) {
    let nearest = null;
    let bestDistance = Infinity;
    for (const point of lastData || []) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      const distance = Math.abs(point.x - xVal);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = point;
      }
    }
    return nearest;
  }

  function estimatePeakShape(centerX, leftX, rightX) {
    const minX = Math.min(leftX, rightX);
    const maxX = Math.max(leftX, rightX);
    const centerPoint = findNearestSpectrumPoint(centerX);
    if (!centerPoint) return { shape: 'unknown', fwhmCm1: null };
    const points = (lastData || [])
      .filter((point) => point.file === centerPoint.file && point.x >= minX && point.x <= maxX)
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
    const centerPoint = findNearestSpectrumPoint(centerX);
    const leftPoint = findNearestSpectrumPoint(leftX);
    const rightPoint = findNearestSpectrumPoint(xVal);
    const edgeValues = [leftPoint?.y, rightPoint?.y].filter(Number.isFinite);
    const allValues = (lastData || []).map((point) => point.y).filter(Number.isFinite);
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
    measurementState = { setId, stripeId, centerX: Number(stripe.x), step: 'left' };
    setActiveStripeSet(setId);
    chartEl.classList.add('chart-measuring');
    setStatus('Width mode: click the left boundary, then the right boundary.');
  }

  function buildConfirmedPeaksPayload() {
    const confirmed = Array.isArray(stripeSets.confirmed) ? stripeSets.confirmed : [];
    return {
      version: '1.0',
      spectrum: {
        files: lastFilesRaw.map((file) => file.name).filter(Boolean),
        sample: sampleInput?.value || '',
        series: lastColumns.slice(),
      },
      confirmedPeaks: confirmed.map((stripe) => ({
        id: stripe.id || null,
        nu: Number.isFinite(Number(stripe.x)) ? Number(stripe.x) : null,
        label: stripe.labelSource === 'manual' ? (stripe.label || '') : (stripe.analysisLabel || stripe.label || ''),
        widthCm1: Number.isFinite(Number(stripe.widthCm1)) ? Number(stripe.widthCm1) : null,
        fwhmCm1: Number.isFinite(Number(stripe.fwhmCm1)) ? Number(stripe.fwhmCm1) : null,
        intensity: stripe.intensity || null,
        shape: stripe.shape || null,
        source: stripe.source || 'manual',
        localWindow: Array.isArray(stripe.localWindow) ? stripe.localWindow : null,
      })),
      analysis: analysisData,
    };
  }

  function buildSessionSnapshot() {
    return {
      version: 1,
      files: lastFilesRaw,
      fileName: fileNameInput.value,
      sampleIndex: sampleInput ? sampleInput.value : '',
      offsets: Object.fromEntries(offsets),
      stripeSets,
      activeStripeSet,
      visibleSeries: Object.fromEntries(visibleSeries),
      baselineSeries,
      baselineModel,
      xRange: { min: xMinInput.value, max: xMaxInput.value },
      yRange: { min: yMinInput.value, max: yMaxInput.value },
      customNames: Object.fromEntries(customNames),
      analysis: analysisData,
    };
  }

  function saveLocalSession() {
    if (!lastFilesRaw.length) return;
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(buildSessionSnapshot()));
    } catch (error) {
      console.warn('[FTIR local session] save failed', { name: error.name, message: error.message });
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
    } catch (error) {
      console.warn('[FTIR local session] clear failed', { name: error.name, message: error.message });
    }
    resetWorkspace();
    if (analysisCard) analysisCard.hidden = true;
    setStatus('Local session cleared.');
  }

  function restoreLocalSession() {
    try {
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session || session.version !== 1 || !Array.isArray(session.files) || !session.files.length) return;
      lastFilesRaw = session.files.map((file) => ({ name: file.name, content: file.content }));
      stripeSets = session.stripeSets || stripeSets;
      activeStripeSet = session.activeStripeSet || activeStripeSet;
      if (!stripeSets[activeStripeSet]) stripeSets[activeStripeSet] = [];
      processFiles(lastFilesRaw, {
        fileName: session.fileName,
        sampleIndex: session.sampleIndex,
        offsets: session.offsets,
        visibleSeries: session.visibleSeries,
        baselineSeries: session.baselineSeries,
        baselineModel: session.baselineModel,
        xRange: session.xRange,
        yRange: session.yRange,
        customNames: session.customNames,
        stripeSets,
      });
      analysisData = session.analysis || null;
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
      const label = candidate.group || candidate.assignment || candidate.label || 'Assignment not returned';
      const confidence = candidate.likelihood || candidate.confidence || 'unknown';
      const confidenceClass = String(confidence).toLowerCase().replace(/[^a-z]+/g, '-');
      const peak = Number.isFinite(Number(candidate.nu)) ? `<span class="analysis-peak">${escapeHtml(candidate.nu)} cm⁻¹</span>` : '';
      return `<article class="analysis-candidate">
        <div class="analysis-candidate-head"><span class="analysis-rank">${index + 1}</span><h4>${escapeHtml(label)}</h4><span class="analysis-confidence ${confidenceClass}">${escapeHtml(confidence)}</span></div>
        ${peak}
        ${candidate.reasoning || candidate.explanation ? `<p>${escapeHtml(candidate.reasoning || candidate.explanation)}</p>` : `<p class="analysis-warning">No explanation returned for this candidate.</p>`}
      </article>`;
    }).join('');
    const supporting = Array.isArray(result.supporting_peaks) && result.supporting_peaks.length
      ? `<section class="analysis-section"><h4>Supporting peaks</h4><div class="analysis-tags">${result.supporting_peaks.map((peak) => {
        const value = typeof peak === 'object' ? peak.nu : peak;
        const label = typeof peak === 'object' ? (peak.assignment || peak.label || '') : '';
        return `<span class="analysis-tag"><strong>${escapeHtml(value)} cm⁻¹</strong>${label ? ` ${escapeHtml(label)}` : ''}</span>`;
      }).join('')}</div></section>`
      : '';
    const sections = [
      result.missing_evidence?.length ? `<section class="analysis-section"><h4>Missing evidence</h4>${list(result.missing_evidence)}</section>` : '',
      result.limitations?.length ? `<section class="analysis-section"><h4>Limitations</h4>${list(result.limitations)}</section>` : '',
    ].join('');
    return `<div class="analysis-report">
      <section class="analysis-summary"><h4>Interpretation</h4><p>${escapeHtml(result.interpretation || 'No summary provided.')}</p></section>
      ${candidateCards ? `<section class="analysis-section"><h4>Candidate assignments</h4><div class="analysis-candidates">${candidateCards}</div></section>` : ''}
      ${supporting}${sections}
      <div class="analysis-footer"><span>Confidence: <strong>${escapeHtml(result.confidence || 'unknown')}</strong></span>${result.model ? `<span>Model: ${escapeHtml(result.model)}</span>` : ''}</div>
    </div>`;
  }

  function applyAnalysisSuggestions(result) {
    const confirmed = Array.isArray(stripeSets.confirmed) ? stripeSets.confirmed : [];
    const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
    let applied = 0;
    candidates.forEach((candidate) => {
      const explicitNu = candidate.nu ?? candidate.wavenumber ?? candidate.peak;
      const candidateNu = Number(explicitNu);
      const stripe = confirmed.reduce((nearest, item) => {
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

  async function analyzeConfirmedPeaks() {
    const payload = buildConfirmedPeaksPayload();
    if (!payload.confirmedPeaks.length) {
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
      confirmedPeaks: payload.confirmedPeaks.length,
      files: payload.spectrum.files.length,
    });
    try {
      const startedAt = performance.now();
      const response = await fetch(analysisApi, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.info('[FTIR analysis] response', { status: response.status, ok: response.ok, durationMs: Math.round(performance.now() - startedAt) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Analysis failed (${response.status})`);
      if (analysisStatus) analysisStatus.textContent = 'Complete';
      analysisData = body.result || body;
      applyAnalysisSuggestions(analysisData);
      if (analysisResult) analysisResult.innerHTML = renderAnalysisReport(analysisData);
      if (stripeSets.confirmed?.length) setActiveStripeSet('confirmed');
      renderStripesTable();
      scheduleLocalSave();
      setStatus('Confirmed peaks analyzed.');
    } catch (error) {
      console.error('[FTIR analysis] request.failed', {
        url: analysisApi,
        origin: window.location.origin,
        name: error.name,
        message: error.message,
        hint: 'Check backend process, URL and CORS settings.',
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
    yMinInput.value = '';
    yMaxInput.value = '';
    updateBaselineSelectOptions();
    renderChartFromData(lastData);
  }

  function clearBaseline() {
    if (BASELINE_DISABLED) return;
    baselineSeries = null;
    baselineModel = null;
    baselineMap = new Map();
    baselinePreviewModel = null;
    defaultYRange = computeAdjustedExtent(lastData) || defaultYRange;
    yMinInput.value = '';
    yMaxInput.value = '';
    updateBaselineSelectOptions();
    renderChartFromData(lastData);
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
  }

  function renderStripesTable() {
    if (!peaksBody || !peaksEmpty) return;
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
        const num = Number(val.value);
        if (!Number.isFinite(num)) return;
        stripe.x = num;
        renderChartFromData(lastData, { skipLegend: true });
        renderStripesTable();
        scheduleLocalSave();
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
      if (stripe.widthCm1 !== undefined || stripe.intensity !== undefined || stripe.shape) {
        const meta = document.createElement('div');
        meta.className = 'peaks-meta';
        const widthText = Number.isFinite(Number(stripe.widthCm1)) ? `${Number(stripe.widthCm1).toFixed(2)} cm⁻¹` : '—';
        const fwhmText = Number.isFinite(Number(stripe.fwhmCm1)) ? `${Number(stripe.fwhmCm1).toFixed(2)} cm⁻¹` : '—';
        const intensityText = Number.isFinite(Number(stripe.intensity)) ? `${stripe.intensity}%` : '—';
        meta.textContent = `Width: ${widthText} | FWHM: ${fwhmText} | Intensity: ${intensityText} | Shape: ${stripe.shape || '—'}`;
        tipCell.appendChild(meta);
      }
      const moveWrap = document.createElement('div');
      moveWrap.className = 'peaks-move';
      const measureBtn = document.createElement('button');
      measureBtn.type = 'button';
      measureBtn.className = 'peaks-move-btn';
      measureBtn.textContent = 'Measure';
      measureBtn.title = 'Measure center, width and relative intensity on the chart';
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
          stripeSets[activeStripeSet] = stripes.filter((s) => s.id !== stripe.id);
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
        stripeSets[activeStripeSet] = stripes.filter((s) => s.id !== stripe.id);
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
    document.getElementById('chartControls').classList.toggle('active', enabled);
    if (enabled) {
      xMaxInput.value = String(defaultXRange.max);
      xMinInput.value = String(defaultXRange.min);
      yMinInput.value = '';
      yMaxInput.value = '';
      yMinInput.placeholder = t('yAuto') || 'auto';
      yMaxInput.placeholder = t('yAuto') || 'auto';
      visibleSeries = new Map();
    }
  }

  refreshBtn.addEventListener('click', () => {
    if (lastData) {
      renderChartFromData(lastData);
    }
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

  baselineSeriesSelect?.addEventListener('change', () => {});

  addStripeBtn?.addEventListener('click', () => {
    const xVal =
      markerActive && markerX !== null
        ? markerX
        : (() => {
            const cx = Number(xMaxInput.value) || defaultXRange.max;
            const cn = Number(xMinInput.value) || defaultXRange.min;
            return (cx + cn) / 2;
          })();
    const current = currentStripes();
    const color = stripeColors[current.length % stripeColors.length];
    stripeIdSeq += 1;
    const matches = tipsForX(xVal);
    const label = matches[0]?.class || matches[0]?.group || '';
    const tipText = matches
      .map((m) => [m.group, m.class, m.details].filter(Boolean).join(' — '))
      .join('; ');
    stripeSets[activeStripeSet] = [...current, { id: `stripe-${stripeIdSeq}`, x: xVal, color, label, tip: tipText, labelSource: label ? 'peak-db' : 'empty' }];
    renderChartFromData(lastData);
    renderStripesTable();
    scheduleLocalSave();
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
    const session = {
      files: lastFilesRaw,
      fileName: fileNameInput.value,
      sampleIndex: sampleInput ? sampleInput.value : '',
      offsets: Object.fromEntries(offsets),
      stripeSets,
      activeStripeSet,
      visibleSeries: Object.fromEntries(visibleSeries),
      baselineSeries,
      baselineModel,
      xRange: { min: xMinInput.value, max: xMaxInput.value },
      yRange: { min: yMinInput.value, max: yMaxInput.value },
      customNames: Object.fromEntries(customNames),
      analysis: analysisData,
    };
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
      if (sampleInput) sampleInput.value = session.sampleIndex || '';
      fileNameInput.value = session.fileName || 'merged.csv';
      lastFilesRaw = session.files.map((x) => ({ name: x.name, content: x.content }));
      stripeSets = session.stripeSets || stripeSets;
      analysisData = session.analysis || null;
      activeStripeSet = session.activeStripeSet || activeStripeSet;
      if (!stripeSets[activeStripeSet]) stripeSets[activeStripeSet] = [];
      processFiles(lastFilesRaw, {
        fileName: session.fileName,
        sampleIndex: session.sampleIndex,
        offsets: session.offsets,
        visibleSeries: session.visibleSeries,
        baselineSeries: session.baselineSeries,
        baselineModel: session.baselineModel,
        xRange: session.xRange,
        yRange: session.yRange,
        customNames: session.customNames,
        stripeSets: stripeSets,
      });
      if (analysisData && analysisCard && analysisResult) {
        analysisCard.hidden = false;
        analysisStatus.textContent = 'Restored';
        analysisResult.innerHTML = renderAnalysisReport(analysisData);
      }
    } catch (err) {
      console.error(err);
      setStatus('Failed to import session', true);
    } finally {
      importSessionInput.value = '';
    }
  });
  resetZoomBtn.addEventListener('click', () => {
    setRangeInputs({
      xMax: defaultXRange.max,
      xMin: defaultXRange.min,
      yMin: null,
      yMax: null,
    });
    renderChartFromData(lastData);
  });
  const applyRangeChanges = () => {
    if (!lastData) return;
    renderChartFromData(lastData);
  };
  [xMinInput, xMaxInput, yMinInput, yMaxInput].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyRangeChanges();
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
      const downloadName = fileNameInput.value.trim() || 'merged.csv';
      setStatus(`${t('statusSending')} ${payloadFiles.length} files...`);
      processFiles(payloadFiles, { fileName: downloadName });
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
      customNames: Object.fromEntries(customNames),
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
    lastFilesRaw = [];
    visibleSeries = new Map();
    offsets = new Map();
    baselineModel = null;
    baselinePreviewModel = null;
    baselineSeries = null;
    baselineMap = new Map();
    stripeSets = { candidates: [], confirmed: [] };
    analysisData = null;
    activeStripeSet = 'candidates';
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
    lastColumns = (lastColumns || []).filter((c) => c !== col);
    lastParsedRows = (lastParsedRows || []).map((row) => {
      const clone = { ...row };
      delete clone[col];
      return clone;
    });
    lastData = (lastData || []).filter((d) => d.file !== col);
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
    renderChartFromData(lastData);
    renderStripesTable();
    scheduleLocalSave();
  }
  restoreLocalSession();
})();
  // pan mode button removed
