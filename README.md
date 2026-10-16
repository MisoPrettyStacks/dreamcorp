# DreamCorp

**Type one sentence. Wake up to a company.**

DreamCorp is the frontend for a real AI-workforce company foundry. You describe a
business idea in one sentence, answer a founding interview with real options (site
type, backend modules, email, autonomy level), and your AI workforce provisions the
company for real:

- **Public website** — a dedicated repo with a live site on its own URL
- **Backend app** — database, working inbox, and your own admin login
- **Tutorial** — a step-by-step guide to navigating and using your backend
- **Agent workforce** — scheduled cycles with daily briefings, plus directives you
  give in chat, executed for real and logged

## What's inside

- `index.html` — app shell plus a static, readable landing page (works with JS disabled)
- `styles.css` — original dark theme (vanilla CSS, no frameworks)
- `app.js` — hash-routed single-page app (vanilla JS, no libraries):
  - `#/` landing page: hero, deliverables strip, how-it-works, workforce, autonomy levels, pricing, FAQ
  - `#/new` founding wizard: idea → 3-question founder interview → build options →
    email choice → autonomy level → brief review → provisioning handoff
    (copies a `FOUND NEW COMPANY` brief to paste to your AI workforce in chat)
  - `#/dashboard` mission control with live data: My Companies (`companies.json`),
    Agent Activity (`activity.json`), Directives (`directives.json`)
- `companies.json`, `activity.json`, `directives.json` — real data maintained by the
  AI workforce (start as empty arrays)

Only the unfinished wizard draft is kept in `localStorage` (keys prefixed with
`dreamcorp:`). Everything else is real infrastructure.

## Autonomy levels

- **Autopilot** — agents act on their own: publish updates, run cycles, execute directives hands-free
- **Approval mode** — agents draft everything into a pending queue; nothing goes live until you approve in chat
- **Oversight** — agents research and propose only; every action needs your explicit go-ahead

## Email, honestly

Each company gets a real working inbox inside its backend from day one. A public
`you@company` address can't be minted by software alone — it needs a domain plus a
short guided setup with a provider. Choose "real address later" in the interview and
the workforce prepares everything for that setup.

## Run locally

No build step. Serve the folder with any static server (or just open `index.html`):

```bash
cd dreamcorp
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly via `file://` also works (fetches of the JSON data
files need http, and degrade to friendly empty states otherwise).

## Deploy free on GitHub Pages

1. Create a new GitHub repository (e.g. `dreamcorp`) and push this folder's contents.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`.
4. Save. Your site goes live at `https://<your-username>.github.io/dreamcorp/` within a minute or two.

No build configuration is needed — Pages serves the static files as-is. The AI
workforce keeps `companies.json`, `activity.json`, and `directives.json` updated
in the repo, so the dashboard always shows live data.

## License

MIT — see [LICENSE](LICENSE).
