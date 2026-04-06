# AGENTS.md

## Cursor Cloud specific instructions

Napzinho is a single-file static web app (`index.html`) — no build step, no package manager, no backend. All data lives in browser `localStorage`.

### Running the app

Serve the repo root with any static HTTP server:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html` in Chrome.

### External CDN dependencies

Chart.js 4.4.1 and Google Fonts (Nunito, Fraunces) are loaded from CDNs at runtime. Internet access is required on first page load.

### PWA (install + offline)

- `manifest.webmanifest`, `sw.js`, `icons/*` — install prompt and offline cache after first load.
- Regenerate icons: `pip install pillow && python3 scripts/generate_icons.py`

### Store deployment (Play / App Store)

See `docs/STORE_DEPLOYMENT.md`. This repo is a static PWA; store listings need TWA (Android) or a native wrapper (iOS), plus HTTPS hosting.

### Linting / Testing / Building

There is no lint config, test framework, or build system. The entire app is vanilla HTML/CSS/JS in one file. Validation is done by serving the file and manually interacting with it in a browser.
