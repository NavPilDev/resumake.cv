<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project context

See the root [AGENTS.md](../.claude/AGENTS.md) for the overall repo/Resumake.cv plan. In short: this app is the current home of **Resumake.cv**, a planned single local, Ollama-powered program — write code with that eventual standalone-tool audience in mind, not just this repo's own data.

- [`experience.yaml`](../experience.yaml) is read fresh from the repo root on every request (see [`lib/repoPaths.ts`](lib/repoPaths.ts) / [`lib/loadExperience.ts`](lib/loadExperience.ts)) — don't cache it across requests.
- The **"input your experience"** feature (editing the `experience.yaml` bullet bank from the UI, instead of hand-editing YAML) is built — see the "My Experience" tab section in [README.md](README.md) — but is still actively evolving, so check current `app/`/`lib/` files rather than assuming the README already documents the latest state.
- The **"My Resumes"** tab is planned but not yet built — see below for the design. Don't assume any `app/`/`lib/` files for it exist yet; check before treating it as implemented.
- See [README.md](README.md) for how the existing analyze/improve/generate-resume flow works before changing it.

## Planned: "My Resumes" tab

A third top-level tab for creating and managing individual tailored resumes, each backed by LaTeX that stays hidden behind form fields — the user never sees or edits `.tex` source directly (unless downloading it). Two modes, **Create Resume** and **Edit Resume**, share a file browser and section-editing UI.

- **File browser** (left rail, always visible in this tab): lists saved resumes and lets the user create folders to organize them, plus a button to start a new resume. This is the navigation/organization surface for both modes.
- **Create Resume**: two-column layout. Left column reads `experience.yaml` (same source as the "Tailor Resume"/"My Experience" tabs — see [`lib/loadExperience.ts`](lib/loadExperience.ts)) and lets the user tick individual fields, jobs, projects, and other sections on/off, with addable/removable sections and checkbox/choice controls. Right column renders a live PDF preview reflecting only what's currently enabled. On save, prompt for a title and a save location in the file browser (default: file browser root).
- **Edit Resume**: user picks an existing saved resume and gets the same addable/removable section editing as Create Resume, pre-populated from what was saved. Saves back to the same file-browser location. Also offers PDF and `.tex` download.
- **Rich text formatting** inside editable text fields (e.g. bullet/summary text): Ctrl+B for bold, Ctrl+I for italic, applied as highlighted/selected-text formatting rather than a separate markup syntax.
- **LaTeX stays server-side / abstracted**: selections and text made through the form fields drive LaTeX generation and PDF compilation under the hood (same general approach as the existing tailored-resume flow — see [lib/latexTemplate.ts](lib/latexTemplate.ts), [lib/resumeFit.ts](lib/resumeFit.ts), [lib/latexCompile.ts](lib/latexCompile.ts)) — the user only ever interacts with fields/checkboxes and the rendered PDF, never raw `.tex`, except via explicit download.
- **Storage**: saved resumes and folders live in [`/saved`](../saved) at the repo root — the file browser's root maps directly to this directory. This is a deliberate repo-cleanup move: every other top-level folder (`latex-resumes/`, `application-tracker/`, `company-notes/`, etc.) is expected to eventually go away, leaving just the Resumake.cv app directory and `/saved` as the one place a user's real data lives. **This supersedes the older root-`AGENTS.md`/README guidance that called `/saved` a test/backup-only directory used just for `experience.yaml`** — once this feature lands, `/saved` is live user data and must not be treated as disposable or test-only.
- **Section scope**: for now, sections in Create/Edit strictly mirror what's already in `experience.yaml` (jobs, projects, education, certifications, skills) — no custom/free-form sections yet. Free-form custom sections are a planned future addition; don't build for them prematurely, but don't structure the section model in a way that would make adding them later painful.
- **Save/preview flow**: there is a single explicit save action — Ctrl+S or clicking a Save button above the PDF preview (the button turns green when there are unsaved changes, otherwise inert/neutral). Triggering it both (a) regenerates the underlying LaTeX from current form state and (b) recompiles and re-renders the PDF preview on the frontend, in one action. There is no separate live/debounced-as-you-type recompile — the preview only updates on save.
