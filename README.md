# FTIR TXT → CSV Merger

This repo now ships the full offline viewer as a Node-served app and keeps the original offline build untouched for reference.

- **Node web app**: `server.js` hosts the FTIR viewer from `public/` (copied from `offline/`) and exposes APIs for merging and persisting sessions.
- **CLI**: `convert.js` merges all `.txt` in a folder into `wavenumber` + one column per file.
- **Legacy offline**: unchanged copy in `offline/` if you want to open the app directly from disk.

## Requirements
Node.js 18+

## Run the web app
```bash
node server.js
```
Open http://localhost:3000

UI features (from the offline app):
- Multi-select FTIR files (.txt, JCAMP variants), per-series visibility + Y offsets, baseline preview, stripes/peaks table, PNG/SVG copy, session export/import.
- Configurable X/Y ranges with zone highlights; EN/RU/SR translations; footer links are set in `public/config.js`.
- CSV export currently happens client-side; the server also saves merged CSVs for `/merge`/`/api/merge` requests to `generated/`.

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
