# Resumake.cv

A local, [Ollama](https://ollama.com)-powered toolkit for tailoring resumes to job descriptions — no data leaves your machine. One experience bank feeds tailored LaTeX resumes, keyword-gap analysis, application tracking, and company research notes, instead of a pile of scripts and folders.

> **Status:** actively converging into a single app. The current build lives in [`resume-revisioner/`](resume-revisioner) (not yet renamed in `package.json`/routes/etc.). See [Project Structure](#project-structure) and [Roadmap](#roadmap) below.

## About

This started as one person's personal job-application toolkit — LaTeX resume/cover-letter sources, a YAML bullet bank, and a pile of scripts — and is being rebuilt into **Resumake.cv**, a single local program anyone can run to manage their own job search: one experience bank, tailored resumes generated on demand, application tracking, and company notes, all in one tool. Because everything runs against a local Ollama model, none of your resume content, job descriptions, or personal data ever leaves your machine.

## Features

- **Experience bank** — [`experience.yaml`](experience.yaml) is the single source of truth for your work history, projects, education, certifications, and skills. Build or edit it visually from the **My Experience** tab instead of hand-editing YAML, including importing from existing resumes (PDF/Markdown/text/JSON) via local Ollama extraction, with a compare view when multiple sources disagree.
- **JD tailoring & scoring** — paste a job description and get every bullet in your experience bank scored 0–100 against it, either instantly via keyword overlap or, more thoroughly, via a local Ollama model that scores section-by-section and explains *why* a bullet scored low.
- **Skill gap detection** — surfaces JD keywords/phrases your bullet bank doesn't cover, filtered against a stopword list and cross-checked so it doesn't just re-flag something you already have.
- **Bullet improvement** — low-scoring bullets get an "Improve with Ollama" rewrite suggestion with a before/after diff; every bullet also supports direct inline editing.
- **Tailored resume generation** — generates a real `.tex` file and compiles it to a page-fit PDF via `latexmk`, automatically trimming the weakest bullets/sections (in priority order) until it fits your page budget, with every trim reported.
- **Application tracker** — early-stage companion app for tracking where you've applied ([`application-tracker/`](application-tracker)).
- **Company notes** — a lightweight template for capturing per-company research before applying or interviewing ([`company-notes/`](company-notes)).

## Project Structure

- [`experience.yaml`](experience.yaml) — your experience bank. Git-ignored — lives only on your machine (see [Privacy](#privacy--your-data)).
- [`resume-revisioner/`](resume-revisioner) — the Next.js + Ollama app; current home of Resumake.cv. See its [README](resume-revisioner/README.md) for how the tailoring/scoring/generation pipeline works.
- [`application-tracker/`](application-tracker) — Next.js app for tracking applications (early scaffold).
- [`company-notes/`](company-notes) — per-company research notes, from [`company-notes-template.md`](company-notes/company-notes-template.md).
- [`latex-case-study/`](latex-case-study) — reusable LaTeX template for a project one-pager / case study. Unlike the paths below, this one ships filled with placeholders, not personal data, so it stays tracked in git.
- `/saved` — git-ignored local storage for your generated resumes, cover letters, and reference sheets (see [Privacy](#privacy--your-data)).

## Requirements

- **[Node.js](https://nodejs.org)** 20+ and npm, to run `resume-revisioner` (and `application-tracker`).
- **[Ollama](https://ollama.com)** running locally with a model pulled (e.g. `ollama pull llama3.2:3b`) — needed for Ollama-mode analysis, bullet improvement, and experience extraction. Keyword-overlap mode works without it.
- **[TeX Live](https://tug.org/texlive/)** (full distribution, not minimal) — required to compile generated resumes to PDF. Needs packages like `fontawesome5`, `titlesec`, and `tabularx`.
- **[LaTeX Workshop](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop)** VS Code / Cursor extension — optional, but useful if you want to view or edit `.tex` output directly.

## Installation

1. Clone this repo.
2. Install TeX Live for your OS:
   - **Windows**: [installer](https://tug.org/texlive/windows.html)
   - **macOS**: [MacTeX](https://tug.org/mactex/)
   - **Linux**: `sudo apt install texlive-full` (or your distro's equivalent)
3. Install [Ollama](https://ollama.com) and pull a model: `ollama pull llama3.2:3b`
4. Install dependencies and start the app:
   ```bash
   cd resume-revisioner
   npm install
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Open **My Experience** and either import an existing resume or fill in your work history, projects, education, and skills by hand — this becomes `experience.yaml`.
2. Go to **Tailor Resume**, paste a job description, and run an analysis (keyword or Ollama mode).
3. Review bullet scores and skill gaps, improve or edit weak bullets, then generate a tailored resume — it compiles straight to a page-fit PDF.

## Roadmap

- **My Resumes tab** (planned) — create/edit individual tailored resumes through form fields backed by LaTeX, with an in-app file browser for organizing saved resumes under `/saved`. LaTeX itself stays hidden from the user.
- [`application-tracker/`](application-tracker) and [`company-notes/`](company-notes) are expected to fold into the main app over time.
- Once complete, `resume-revisioner/` gets renamed to match the Resumake.cv name throughout (`package.json`, routes, etc.).

## Privacy & your data

Everything runs locally — your experience bank, job descriptions, and generated resumes never leave your machine, and any AI-assisted analysis or generation runs against your own local Ollama install, not a hosted API. `experience.yaml` and `/saved` are git-ignored by design; nothing you enter through the app gets committed to this repo.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free to use, modify, and share for any noncommercial purpose. Commercial use requires separate permission from the author.
