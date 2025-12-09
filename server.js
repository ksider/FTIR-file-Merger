#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MAX_BODY = 20 * 1024 * 1024; // 20MB safety limit
const PUBLIC_DIR = path.join(__dirname, 'public');
const GENERATED_DIR = path.join(__dirname, 'generated');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
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

function quoteCsv(value) {
  return JSON.stringify(value ?? '');
}

function safeFileName(name) {
  const base = (name || 'merged').replace(/[^a-z0-9_\-\.]+/gi, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return base || 'merged';
}

function safeColName(file) {
  return path.parse(file).name.replace(/[^a-zA-Z0-9_\-]+/g, '_') || 'col';
}

function makeUniqueColumns(names) {
  const used = new Map();
  return names.map((name) => {
    const base = name || 'col';
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}_${count}`;
  });
}

function mergeFiles(files) {
  const columns = makeUniqueColumns(files.map((f) => safeColName(f.name)));
  const table = new Map(); // key: wavenumber string, value: { x:number, vals: Map }
  let totalRows = 0;

  files.forEach((f, idx) => {
    const col = columns[idx];
    const rows = parseInfraredText(f.content);
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
    lines.push([
      row.x,
      ...columns.map((c) => (row.vals.has(c) ? row.vals.get(c) : '')),
    ].join(','));
  }
  return { csv: lines.join('\n'), totalRows };
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(urlPath).replace(/^(\.\.[\\/])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const type = ext === '.html'
      ? 'text/html; charset=utf-8'
      : ext === '.js'
        ? 'application/javascript; charset=utf-8'
        : ext === '.css'
          ? 'text/css; charset=utf-8'
          : 'text/plain; charset=utf-8';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/merge') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) {
        res.writeHead(413);
        res.end('Payload too large');
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload || !Array.isArray(payload.files)) {
          res.writeHead(400);
          res.end('Invalid payload');
          return;
        }
        const files = payload.files.map((f) => ({
          name: f.name || 'unknown',
          content: f.content || '',
        }));
        const requestedName = typeof payload.name === 'string' ? payload.name : 'merged';
        const safeName = safeFileName(requestedName);
        const fileName = safeName.toLowerCase().endsWith('.csv') ? safeName : `${safeName}.csv`;
        const { csv, totalRows } = mergeFiles(files);
        ensureDir(GENERATED_DIR);
        fs.writeFileSync(path.join(GENERATED_DIR, fileName), csv, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'X-Total-Rows': String(totalRows),
        });
        res.end(csv);
      } catch (err) {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/generated/')) {
    const rel = req.url.replace('/generated/', '');
    const safeName = path.normalize(rel).replace(/^(\.\.[\\/])+/, '');
    const filePath = path.join(GENERATED_DIR, safeName);
    if (!filePath.startsWith(GENERATED_DIR) || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${path.basename(filePath)}"` });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
