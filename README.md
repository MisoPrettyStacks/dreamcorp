# DreamCorp

**Type one sentence. Wake up to a company.**

DreamCorp is an interactive demo of the "autonomous AI company" concept: you describe a
business idea in one sentence, a founder agent interviews you, AI agents "build" the
company, and a live dashboard shows your virtual workforce running it.

Everything is simulated locally in your browser. There is no backend, no API key, and no
network traffic — all state lives in `localStorage` under keys prefixed with `dreamcorp:`.

## What's inside

- `index.html` — app shell plus a static, readable landing page (works with JS disabled)
- `styles.css` — original dark theme (vanilla CSS, no frameworks)
- `app.js` — hash-routed single-page app (vanilla JS, no libraries):
  - `#/` landing page with animated demo stats, workforce grid, testimonials, FAQ
  - `#/new` founding wizard: idea → 3-question founder interview → company brief → build cinematic
  - `#/dashboard` company OS: live stats, canvas revenue chart, agent activity feed,
    agent on/off toggles, auto-completing task list, and a rule-based CEO-agent chat

## Run locally

No build step. Serve the folder with any static server (or just open `index.html`):

```bash
cd dreamcorp
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly via `file://` also works.

## Deploy free on GitHub Pages

1. Create a new GitHub repository (e.g. `dreamcorp`) and push this folder's contents.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`.
4. Save. Your site goes live at `https://<your-username>.github.io/dreamcorp/` within a minute or two.

No build configuration is needed — Pages serves the static files as-is.

## Demo mode

A "Demo" badge is always visible. Figures on the landing page are illustrative, the
workforce/testimonials are invented, and dashboard revenue, visitors, orders, agent
activity, tasks, and chat replies are generated locally. Use **Reset demo** in the
dashboard footer to clear all stored data and start over.

## License

MIT — see [LICENSE](LICENSE).
