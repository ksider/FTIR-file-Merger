#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function parseFile(filePath) {
  const rows = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && !Number.isNaN(Number(parts[0])) && !Number.isNaN(Number(parts[1]))) {
      rows.push([Number(parts[0]), Number(parts[1])]);
    }
  }
  return rows;
}

function quoteCsv(value) {
  return JSON.stringify(value ?? '');
}

function safeColName(file) {
  const base = path.parse(file).name;
  return base.replace(/[^a-zA-Z0-9_\-]+/g, '_') || 'col';
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

function mergeColumns(fileData) {
  const columns = makeUniqueColumns(fileData.map((f) => safeColName(f.name)));
  const table = new Map(); // key: wavenumber string, value: { x: number, values: Map }

  fileData.forEach((f, idx) => {
    const col = columns[idx];
    for (const [x, y] of f.rows) {
      const key = String(x);
      if (!table.has(key)) table.set(key, { x: Number(x), vals: new Map() });
      table.get(key).vals.set(col, y);
    }
  });

  const header = ['wavenumber', ...columns];
  const sorted = Array.from(table.values()).sort((a, b) => b.x - a.x);
  const lines = [header.join(',')];
  for (const row of sorted) {
    const line = [
      row.x,
      ...columns.map((c) => (row.vals.has(c) ? row.vals.get(c) : '')),
    ];
    lines.push(line.join(','));
  }
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node convert.js [inputDir] [outputFile]');
    console.log('Defaults: inputDir=./example, outputFile=merged.csv');
    return;
  }

  const inputDir = args[0] ? path.resolve(args[0]) : path.resolve(__dirname, 'example');
  const outputFile = args[1] ? path.resolve(args[1]) : path.resolve(process.cwd(), 'merged.csv');

  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(inputDir).filter((f) => f.toLowerCase().endsWith('.txt')).sort();
  if (!files.length) {
    console.error('No .txt files found in', inputDir);
    process.exit(1);
  }

  const fileData = [];
  let totalRows = 0;
  for (const file of files) {
    const full = path.join(inputDir, file);
    const rows = await parseFile(full);
    fileData.push({ name: file, rows });
    totalRows += rows.length;
  }
  const csv = mergeColumns(fileData);
  fs.writeFileSync(outputFile, csv, 'utf8');
  console.log(`Merged ${files.length} files, ${totalRows} points -> ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
