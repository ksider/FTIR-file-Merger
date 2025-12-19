(() => {
  const config = window.APP_CONFIG || {};
  const translations = config.translations || {};
  const supportedLangs = config.supportedLangs || Object.keys(translations) || ['en'];
  const footerLinks = config.footerLinks || {};
  const chartSettings = config.chart || {};
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
  const exportSessionBtn = document.getElementById('exportSession');
  const importSessionBtn = document.getElementById('importSession');
  const importSessionInput = document.getElementById('importSessionInput');
  const selectFilesBtn = document.getElementById('selectFiles');
  const stripeSetBtns = document.querySelectorAll('.stripe-set-btn');
  const peakDb = Array.isArray(window.FTIR_BASE) ? window.FTIR_BASE : [];
  const footerSite = document.getElementById('footerSite');
  const footerGithub = document.getElementById('footerGithub');

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

  const sanitizeName = (name) => (name || '').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'col';

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

    const svg = d3.create('svg').attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

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
      svg.style('cursor', 'col-resize');
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
    svg.style('cursor', markerActive ? 'col-resize' : 'crosshair');

    const handlePointer = (event) => {
      const [px, py] = d3.pointer(event, g.node());
      if (px < 0 || px > innerW || py < 0 || py > innerH) return;
      const xVal = x.invert(px);
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
          yMin: yMinVal,
          yMax: yMaxVal,
        };
        svg.style('cursor', 'grab');
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
        const dx = panStartDomain.x - currentX;
        const dy = panStartDomain.y - currentY;
        const newXMin = (Number(xMinInput.value) || defaultXRange.min) + dx;
        const newXMax = (Number(xMaxInput.value) || defaultXRange.max) + dx;
        let newYMin = panStartDomain.yMin + dy;
        let newYMax = panStartDomain.yMax + dy;
        const baseRange = defaultYRange || yDomainAuto;
        if (baseRange && baseRange.length === 2) {
          newYMin = Math.max(newYMin, baseRange[0]);
          newYMax = Math.min(newYMax, baseRange[1]);
        }
        xMinInput.value = newXMin;
        xMaxInput.value = newXMax;
        yMinInput.value = String(newYMin);
        yMaxInput.value = String(newYMax);
        renderChartFromData(lastData, { skipLegend: true });
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
      }
      svg.style('cursor', markerActive ? 'col-resize' : 'crosshair');
      clearZoneHighlight();
    });

    svg.on('click', (event) => {
      if (event.detail === 2) return; // let dblclick handle it
      if (event.ctrlKey) return;
      handlePointer(event);
    });

    svg.on('dblclick', (event) => {
      if (event.ctrlKey) return;
      event.preventDefault();
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
    const columns = payloadFiles.map((f) => sanitizeName(f.name));
    const table = new Map();
    let totalRows = 0;
    const failedFiles = [];
    payloadFiles.forEach((file, idx) => {
      const col = columns[idx];
      const rows = parseSpectraContent(file.content, file.name);
      if (!rows.length) {
        if ((file.name || '').toLowerCase().endsWith('.jcm')) {
          failedFiles.push(`${file.name || col} (packed JCM not supported yet)`);
        } else {
          failedFiles.push(file.name || col);
        }
        return;
      }
      totalRows += rows.length;
      for (const [x, y] of rows) {
        const key = String(x);
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
      });

      const nameCell = document.createElement('input');
      nameCell.type = 'text';
      nameCell.className = 'peaks-input';
      nameCell.value = stripe.label || '';
      nameCell.placeholder = t('colLabel');
      nameCell.addEventListener('input', () => {
        stripe.label = nameCell.value;
        renderChartFromData(lastData, { skipLegend: true });
      });

      const tipCell = document.createElement('div');
      tipCell.className = 'peaks-tip';
      tipCell.textContent = stripe.tip || t('tipPlaceholder');
      const moveWrap = document.createElement('div');
      moveWrap.className = 'peaks-move';
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
    stripeSets[activeStripeSet] = [...current, { id: `stripe-${stripeIdSeq}`, x: xVal, color, label, tip: tipText }];
    renderChartFromData(lastData);
    renderStripesTable();
  });

  copyStripesBtn?.addEventListener('click', () => {
    const stripes = currentStripes();
    if (!stripes.length) return;
    const header = ['wavenumber', 'label', 'tip'];
    const rows = stripes.map((s) => [s.x.toFixed(2), s.label || '', s.tip || '']);
    const tsv = [header.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(tsv).then(
        () => setStatus('Copied stripes.'),
        () => setStatus('Copy failed.', true)
      );
    }
  });

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
    defaultYRange = computeAdjustedExtent(lastData) || defaultYRange;
    updateBaselineSelectOptions();
    renderChartFromData(lastData);
    renderStripesTable();
  }
})();
  // pan mode button removed
