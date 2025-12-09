# FTIR TXT → CSV Merger

This repo has two main ways to run, plus an optional offline app:

- **Web app** (server + browser): `server.js` serves static files and handles `/merge` (builds CSV, saves a copy to `generated/`). UI supports multi-file upload, auto file-name generation, auto-download toggle, chart with clickable legend and per-series Y offsets, axis settings, and language switcher.
- **CLI**: `convert.js` merges all `.txt` in a folder into `wavenumber` + one column per file.
- **(Optional) Electron**: offline app in `electron-app/`; ignore if not needed.

## Requirements
Node.js 18+

## Run the web app
```bash
node server.js
```
Open http://localhost:3000

UI features:
- Multi-select `.txt`, auto-generate output name.
- “Auto-download” checkbox: if on, CSV downloads immediately; if off, a download link appears.
- Chart: legend below the chart is clickable (toggle series), each item has a Y-offset field; X/Y ranges are configurable (X reversed 4000→500).
- Languages: EN/RU/SR (switch in header).
- Server saves a copy to `generated/<name>.csv`.

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
