# Resume

Abhinav Pillai's personal job-application toolkit: LaTeX sources for resumes/cover letters/reference sheets, a single YAML bullet bank that feeds all of them, a Next.js app that tailors a resume to a job description, an application tracker, and per-company notes.

## Resumeak

Everything in this repo is converging into **Resumeak** — a single local program, powered by [Ollama](https://ollama.com) so no data leaves your machine, that anyone can run to manage their own job search the same way this repo does: one experience bank, tailored resumes generated on demand, application tracking, and company notes, all in one tool instead of a pile of scripts and folders.

Resumeak's code currently lives in [`resume-revisioner/`](resume-revisioner) (it hasn't been renamed yet). That app already does JD analysis + tailored `.tex` resume generation against [`experience.yaml`](experience.yaml); an **"input your experience"** UI (letting you build/edit your bullet bank from the app instead of hand-editing the YAML) is in progress. [`application-tracker/`](application-tracker) and the LaTeX/notes tooling below are expected to fold in as Resumeak grows.

## Project Structure

- [`experience.yaml`](experience.yaml) — master source of truth for resume bullets (jobs, projects, education, skills), tagged and scored against job descriptions by resume-revisioner
- [`resume-revisioner/`](resume-revisioner) — Next.js + Ollama app that scores `experience.yaml` bullets against a pasted JD, surfaces skill gaps, and generates a tailored, page-fit LaTeX resume. Home of the in-progress Resumeak build — see its [README](resume-revisioner/README.md)
- [`application-tracker/`](application-tracker) — Next.js app for tracking job applications (early scaffold)
- [`company-notes/`](company-notes) — per-company research notes, from [`company-notes-template.md`](company-notes/company-notes-template.md)
- [`latex-resumes/`](latex-resumes) — `master-resume.tex`, hand-maintained `resume.tex`, and generated `tailored-resume.tex` outputs
- [`latex-covers/`](latex-covers) — cover letter LaTeX source + writing guide
- [`latex-references/`](latex-references) — reference sheet LaTeX source
- [`latex-case-study/`](latex-case-study) — project one-pager / case study LaTeX template

## Requirements

Compiling any of the `latex-*` sources requires the following, **both of which are mandatory**:

1. **[TeX Live](https://tug.org/texlive/)** — the LaTeX distribution used to compile `.tex` files into PDF. Install the full distribution (not a minimal one) so packages like `fontawesome5`, `titlesec`, and `tabularx` are available.
2. **[LaTeX Workshop](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop)** VS Code / Cursor extension — provides build-on-save, PDF preview, and syntax support. Install it from the Extensions marketplace in either editor.

Running `resume-revisioner` (or `application-tracker`) additionally requires Node.js, and, for Ollama-backed analysis/generation, [Ollama](https://ollama.com) running locally with a model pulled.

## Setup

1. Install TeX Live for your OS:
   - **Windows**: download and run the [installer](https://tug.org/texlive/windows.html)
   - **macOS**: install [MacTeX](https://tug.org/mactex/)
   - **Linux**: `sudo apt install texlive-full` (or your distro's equivalent)
2. Install the LaTeX Workshop extension in VS Code or Cursor.
3. Open this folder in VS Code/Cursor, open a `.tex` file, and build with LaTeX Workshop (default keybind `Ctrl+Alt+B`) or save the file to trigger an automatic build.
4. The compiled PDF will appear alongside the `.tex` file; use LaTeX Workshop's built-in PDF viewer to preview it.
5. For the resume-revisioner app, see its [README](resume-revisioner/README.md) — `npm install && npm run dev` inside that folder.
