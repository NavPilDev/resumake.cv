# Repo context for agents

This repo is a personal job-application toolkit: LaTeX resume/cover-letter/reference sources, a single [`experience.yaml`](experience.yaml) bullet bank that feeds them, a Next.js app (`resume-revisioner`) that tailors resumes to job descriptions, an application tracker, and per-company notes. See [README.md](README.md) for the full project structure.

## The Resumake.cv plan

Everything here is converging into **Resumake.cv** — a single local program, powered by Ollama (no data leaves the machine), meant to be run by other people, not just the repo owner. That means code going into `resume-revisioner/` should be written with that eventual standalone-tool audience in mind (e.g. don't hardcode assumptions that only hold for this specific repo's data unless there's no other reasonable way).

- Resumake.cv's code currently lives in [`resume-revisioner/`](resume-revisioner) — it hasn't been renamed yet, so don't be surprised the app is still called "resume-revisioner" in `package.json`, routes, etc.
- `application-tracker/` and the `latex-*`/`company-notes/` folders are expected to fold into Resumake.cv over time, but haven't yet — treat them as separate, standalone pieces for now unless told otherwise.
- The **"input your experience"** feature — a UI for building/editing the `experience.yaml` bullet bank from the app itself, instead of hand-editing the YAML file — is now built as the "My Experience" tab in `resume-revisioner/`: manual entry forms for jobs/projects/education/certifications/skills, multi-file or pasted-text import via Ollama extraction (with a compare-versions UI when attachments disagree), and an explicit Save step. It's still actively evolving, so check current `app/`/`lib/` files rather than assuming any README fully describes it.
- A **"My Resumes"** tab is planned (not yet built) for `resume-revisioner/`: create/edit individual tailored resumes via LaTeX-backed form fields (LaTeX itself stays hidden from the user), with an in-browser file browser for organizing saved resumes into folders. See [`resume-revisioner/AGENTS.md`](resume-revisioner/AGENTS.md) for the full design.

## Shared data

- [`experience.yaml`](experience.yaml) is the single source of truth for resume content (jobs, projects, education, skills). `resume-revisioner` reads it fresh on every request — don't cache it across requests.
- `/saved` is currently just a backup/test-data directory (holds a spare `experience.yaml`), but it's the planned permanent home for the "My Resumes" feature's saved resumes and folders (see [`resume-revisioner/AGENTS.md`](resume-revisioner/AGENTS.md)) — once that ships, treat `/saved` as real user data, not disposable test output. It, along with the Resumake.cv app directory itself, is meant to be the only thing left in this repo long-term; everything else (`latex-resumes/`, `application-tracker/`, `company-notes/`, etc.) is expected to fold in or go away.
- Generated LaTeX output (tailored resumes, etc.) is written into `latex-resumes/`, compiled via `latexmk` using `latex-resumes/.latexmkrc`'s `build`/`out` dirs.

## Sub-project rules

Each Next.js app has its own `AGENTS.md` with framework-specific rules — read the relevant one before editing code there:

- [`resume-revisioner/AGENTS.md`](resume-revisioner/AGENTS.md)
- [`application-tracker/AGENTS.md`](application-tracker/AGENTS.md)
