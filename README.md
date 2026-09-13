# FTIR Merger roadmap (ideas)

- **Export & sharing**
  - [x] Export/import session (uploaded spectra, stripes, baseline choice, offsets) as a JSON to restore a workspace.
  - [x] Copy chart as PNG/SVG with legend and stripes.
  - Inline “copy visible CSV” respecting visibility/baseline/offsets.

- **Stripes & peak intelligence**
  - [x] Allow multiple stripe sets (e.g., “candidate peaks”, “confirmed peaks”) with toggles.
  - Bulk add stripes from typed ranges (e.g., `1710-1730`) or paste from CSV.
  - Quick filters on the tips DB; highlight matches directly on chart.
  - Show nearest library match on hover/marker, not only on added stripes.

- **Baseline & corrections**
  - Polynomial/spline baseline fit with preview and apply/revert.
  - Per-series smoothing (Savitzky–Golay) and normalization (max=1 or area=1).
  - Auto-align peaks between series (cross-correlation) for easier comparison.

- **Chart UX**
  - Toggle stacking/offset view vs. absolute; quick “reset offsets” button.
  - Snap marker to nearest peak; show delta between two markers.
  - Keyboard navigation between peaks/stripes; hotkeys for zoom presets.
  - Mini-map/overview for large datasets; zoom presets (full, 4000–500, custom).

- **Data handling**
  - Detect headers/units in TXT, allow column mapping.
  - Support other formats (CSV with multiple spectra, JCAMP-DX).
  - Caching parsed files; warn on inconsistent x-grids, offer resampling.

- **Internationalization**
  - Switchable tips DB language; plug multiple DB files.

- **Quality-of-life**
  - Theme toggle (light/dark), font size slider.
  - Persistent user settings (language, baseline choice, offsets) in local storage.
  - Error banner/log area instead of console-only errors.

- **Testing & validation**
  - Add sample datasets and scripted regression checks for merge/offset/baseline.
  - Visual regression snapshots for chart rendering on key flows.

## How to use (frontend)

1) **Open** `index.html` locally in a modern browser (Chrome/Firefox/Safari). Everything runs client-side.  
2) **Add spectra** via the toolbar “upload” button. Supported: TXT (pairs), JCAMP-DX (`.jdx/.dx/.jcm/.jsm` including packed DIFDUP/PAC), and the provided examples in `exmaple/`. Files append to the current session.  
3) **Name output** in the CSV name field.  
4) **Adjust view**: pan with mouse wheel button, zoom with scroll, edit X/Y ranges, toggle visibility in the legend, offset curves via legend inputs.  
5) **Peaks/stripes**: set a marker by clicking the chart, then “Add stripe”. Manage stripes in the table (candidates/confirmed sets, move/edit/remove). Copy the table via “Copy table”.  
6) **Export/import session**: use toolbar icons to save/load a JSON workspace (files, visibility, offsets, stripes, baseline choice).  
7) **Save chart/CSV**: copy PNG/SVG via toolbar buttons; “Save CSV” exports only visible series with current baseline offsets applied.  
8) **Baseline**: baseline UI is currently hidden by design; Y auto-scaling respects applied baseline when enabled in code.  
9) **Internationalization**: language toggle EN/RU/SR in header. Translations live in `config.js`.

## Analysis backend (optional)

The frontend remains usable without a backend. The server is an isolated proxy for
future LLM interpretation and accepts only confirmed peaks from the frontend.

```bash
cd server
cp .env.example .env
npm start
```

For a local Gemini test, edit `server/.env` and enter the key manually in the
`GEMINI_API_KEY` value. Never commit this file. The configured economical model
is `gemini-3.5-flash-lite`.

For a local smoke test without a key, set `LLM_PROVIDER=mock` first:

```bash
curl http://127.0.0.1:8787/health
```

The analysis endpoint is `POST /api/analyze` and requires the versioned JSON
payload copied by the `Copy confirmed JSON` button. To enable a cloud provider,
set `LLM_PROVIDER=gemini` and `GEMINI_API_KEY`, or `LLM_PROVIDER=mistral` and
`MISTRAL_API_KEY`, in the server environment. Never place real keys in `.env`
commits, frontend files, GitHub Actions logs, or exported sessions.

The server enforces a request size limit, basic per-client rate limit, payload
validation, provider timeout, and reads the canonical references from
`REFERENCE_DIR`. For a standalone server repository, keep
`references/bands_master.md` and `references/diagnostic_zones.md` beside
`server.js`. It does not modify candidate or confirmed stripes.

### Docker deployment

The backend can be deployed independently from the static frontend:

```bash
cd server
cp .env.example .env
# Put the API key only in .env or your hosting secret manager.
docker compose up --build -d
curl http://127.0.0.1:8787/health
```

Set `ALLOWED_ORIGIN` to the exact public frontend origin before deployment,
for example `https://ftir.example.com`. Set the frontend API URL in
`config.js` as `analysisApi: 'https://api.example.com/api/analyze'`.

## Configuration

- Edit `config.js` to change default X range/zones, translations, and footer links:
  ```js
  footerLinks: { site: 'https://your-site', github: 'https://github.com/you' }
  ```
- Peak tips database is loaded from `peak-db.js`; JCAMP tips from `FTIR_base.csv` are preprocessed there.

## Development notes

- Core logic: `app.js` (parsing, chart rendering with D3, session management, stripes, JCAMP decoding).  
- Styles: `styles.css`.  
- No frontend build step is required; open `index.html`. The backend is optional
  until the LLM analysis button is connected.

## License

This project is licensed under the GPL-3.0-or-later.
