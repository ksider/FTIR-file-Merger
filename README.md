# FTIR TXT → CSV Merger

This repo ships the full offline viewer as a Node-served app and keeps the original offline build untouched for reference.

- **Node web app**: `server.js` hosts the FTIR viewer from `public/` (copied from `offline/`) and exposes APIs for merging and persisting sessions.
- **CLI**: `convert.js` merges all `.txt` in a folder into `wavenumber` + one column per file.
- **Legacy offline**: unchanged copy in `offline/` if you want to open the app directly from disk.

## Requirements
Node.js 18+

## Install dependencies
This project uses only built-in Node APIs—no npm install is required.

## Run the web app (server + browser UI)
```bash
node server.js
```
Open http://localhost:3000

What you get in the UI:
- Multi-file upload (.txt, JCAMP variants), chart with zone highlights, per-series visibility + Y offsets, baseline preview, stripes/peaks table, PNG/SVG copy, session export/import.
- Configurable X/Y ranges; translations EN/RU/SR; footer links configured in `public/config.js`.
- CSV export currently happens client-side; `/merge`/`/api/merge` also save server copies to `generated/`.

Server endpoints:
- `POST /merge` → accepts `{ name, files:[{name,content}] }`, returns CSV download (attachment). Saves a copy to `generated/<name>.csv`.
- `POST /api/merge` → same payload, responds JSON `{ fileName, totalRows, csvPath }` after saving CSV.
- `POST /api/sessions` → body is your session object (anything the UI wants to persist). Saves to `generated/sessions/<id>.json`, responds `{ id, savedAt }`.
- `GET /api/sessions/:id` → returns previously saved session JSON.
- Static assets are served from `public/`; generated CSVs are downloadable under `/generated/<file>.csv`.

How to use the UI:
1) Open `http://localhost:3000`.
2) Click the upload icon to add spectra; supported: `.txt`, `.jdx/.dx/.jcm/.jsm`.
3) Adjust X/Y ranges, toggle series in the legend, set Y offsets per series.
4) Place a marker on the chart, add stripes/peaks, and copy the table if needed.
5) Export/import sessions (JSON) for state portability; copy chart as PNG/SVG; save CSV (visible series only).
6) Translations switch in the header; footer links come from `public/config.js`.

## Architecture
- `server.js`: minimal HTTP server. Serves static assets from `public/`, streams generated CSVs from `generated/`, and exposes JSON APIs:
  - `POST /merge` → download CSV (for browsers).
  - `POST /api/merge` → JSON `{ fileName, totalRows, csvPath }` after saving merged CSV.
  - `POST /api/sessions` → persist a session JSON to `generated/sessions/<id>.json`, responds with `{ id, savedAt }`.
  - `GET /api/sessions/:id` → read a previously saved session.
- `public/`: Node-served version of the offline viewer (copied from `offline/`), uses D3 + `jcampconverter` and `peak-db.js` for tips.
- `generated/`: runtime output (CSV exports and saved sessions); safe to delete/regenerate.
- `offline/`: original offline drop-in kept intact for comparison or air-gapped use.

Future server extensions (collab, server-side session storage, auth) can hook into `/api/sessions` and extend `server.js` without touching `offline/`.

## CLI conversion
```bash
# default: reads ./example, writes merged.csv
node convert.js

# custom input folder and output file
node convert.js path/to/folder output.csv
```
Output format: `wavenumber` + %T columns per file (column name = sanitized file name without extension).

CLI details:
- Input must be plain text files with `wavenumber value` pairs per line (whitespace-separated).
- Sorting: output is sorted descending by wavenumber (4000 → 500 style).
- Column naming: derived from the file name; duplicates get `_1`, `_2`, etc.

## Electron (offline, optional)
```bash
cd electron-app
npm install
npm start
```

### Build Windows .exe (Electron)
Already configured in `electron-app/package.json` using electron-builder.
```bash
cd electron-app
# if PowerShell blocks scripts: run in cmd.exe or use `npm.cmd` / `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
npm install
npm run dist
```
Artifacts will appear in `electron-app/dist/` (NSIS installer by default). To make a portable exe instead of installer, change `"target": "portable"` under `"win"` in `package.json`.

## Sample data
See `example/` for source `.txt` files and the reference `example/merged.csv`. 
