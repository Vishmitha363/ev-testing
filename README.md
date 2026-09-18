# EV Testing and Validation

A single-page workspace for EV component testing, used at BNC Motors. It runs
entirely in the browser — there is no server, no install and no database.

**Live site:** enable GitHub Pages for this repository (Settings → Pages →
Deploy from a branch → `main` / `root`), then open the address Pages shows.

## What it does

| Tool | Purpose |
|---|---|
| **Product & Test Cases** | Type any product and get its test cases, each with the governing standard, a step-by-step procedure and PASS/FAIL criteria. Download them all as Word. |
| **Product Validation Test Report** | Fill in the PVT report — photos with annotations, result tables, auto-written objective, procedure and conclusion — and export a clean A4 PDF. |
| **RCA Report** | A full 8D / 5-Why / Fishbone root-cause report, editable section by section, exported as PDF or Word. |
| **Document Summary & 8D** | Add any file (PDF, Word, Excel, PowerPoint, images, text, CSV, RTF) or paste text, and get the key points in plain words. Supplier 8D reports can be evaluated against the 8D method. |
| **Ask AI** | A chat assistant for test standards and procedures, in the bottom-right corner. |

## Using it

Open the site in Chrome or Edge. Everything except the AI features works with no
internet connection: the report, the tables, the photos and the PDF export.

Your work is stored **in your own browser** (drafts, My Reports, My RCAs). It is
never uploaded anywhere. Clearing the browser's site data clears it, so export a
PDF or Word file for anything you want to keep.

## AI features and keys

The AI features (test cases online, RCA Generate, Correct English, Document
Summary, Ask AI) send what you give them to an online AI service.

**This repository contains no API keys.** On a static host such as GitHub Pages
the app uses free, no-account services, which are slower and sometimes busy.
For faster and more reliable answers — and to read photos and scanned PDFs — add
your own free key in **Ask AI → ⚙️ settings**:

- **Google Gemini** — <https://aistudio.google.com/apikey> (best for pictures)
- **OpenRouter** — <https://openrouter.ai/keys> (fastest for text)

A key entered there is kept in your browser only.

## Running it locally

Download the repository and open `index.html`. No build step, no dependencies to
install. The `vendor/` folder holds the PDF and Word libraries, so the app also
works with no internet.

## Notes for maintainers

- `index.html` links `style.css` and `script.js` with a `?v=` number. Bump it
  whenever either file changes, or browsers keep serving the old one.
- `netlify.toml` and `netlify/functions/ai.mjs` (in the Netlify copy of this app)
  hide the API keys on a server so visitors do not need their own. GitHub Pages
  cannot run them; the app detects this and falls back automatically.
- PDFs are parsed with pdf.js. Served over http(s) it runs in a real worker with
  script execution disabled; opened as a local file it must run on the main
  thread, where that setting cannot be used.
