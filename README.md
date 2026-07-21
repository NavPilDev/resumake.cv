

<img width="1010" height="195" alt="logo" src="https://github.com/user-attachments/assets/576399cf-85b7-477e-8c29-a4c4d91a8a8e" />

# resumake.cv (Work in Progress!)

A local, [Ollama](https://ollama.com)-powered toolkit for job seekers -- tailor a resume to a job description, generate and manage supporting materials, and keep every bit of your personal data on your own machine instead of handing it to another "free" web app.

> **Status:** actively converging into a single app. The current build lives in [`resume-revisioner/`](resume-revisioner) (not yet renamed in `package.json`/routes/etc.). My Experience, Tailor Resume, and My Resumes are built and usable today -- see [Features](#features) for what's live and [Roadmap](#roadmap) for what's next.

## about

<img width="1010" height="195" alt="about" src="https://github.com/user-attachments/assets/4cdfa652-1d28-43ef-bc35-8483f78f4e49" />



As I am currently in the process of finding a job, I found that I spent alot of time on tailoring my resume in sites such as overleaf via LaTeX. This would be things such changing out projects for others that were more relevant to job descriptions, or adding more detail here and there.

Now don't get me wrong, LaTeX is great, but it does take longer than it needs to take for simple modifications of pdf documents. This is especially exlemplifed if you don't know how to use LaTeX well. Earlier this summer, I introduced my friends to overleaf and subsequently LaTeX. My friends. who were just starting out with LaTeX, found its commands and intricate type definitions to be confusing. Though, they interestingly noted that the platform would provide great value to them if they knew how to work LaTeX effeciently.

Lastly, I always felt privacy concerns for where my resume information was going when using services such as chatgpt, overleaf, and simplify to refine my resume for recruiting seasons. It felt like my information was being sold, in the face of something being provided for "free".

To alleviate these problems with the job process, I have created resumake.cv to make tailoring resumes and procuring supporting materials such as cover letters, reference sheets, company research, and case studies as easy as possible.

The process is made to be very easy, where anyone can come into the platform and move things around within their resume very quickly, without being held back by knowledge of a language like LaTeX(although there is also LaTeX support built in!). The process of switching experience(jobs, projects, and more), is made blazingly fast due to the centralized experience.yaml file that every user is onboarded with. To help eliminate privacy concerns, There is also a local ollama agent that helps procure the relevant information for creating these materials. A detailed explanation is provided below.

It's being rebuilt into **Resumake.cv**, a single local program anyone can run to manage their own job search: one experience bank, tailored resumes and supporting materials generated on demand, application tracking, and company notes, all in one tool. Switching out a job or project on a resume is fast because everything reads from one central [`experience.yaml`](experience.yaml): no hunting through old `.tex` files. LaTeX is fully supported for anyone who wants direct control over it, but nothing in the app requires knowing it. Because everything runs against a local Ollama model, none of your resume content, job descriptions, or personal data ever leaves your machine.

## features

<img width="1010" height="195" alt="features" src="https://github.com/user-attachments/assets/a423d3c2-5c49-4bbc-94ac-2b3e14cbbc64" />

### My Experience

[`experience.yaml`](experience.yaml) is the single source of truth for your work history, projects, education, certifications, and skills. New users are prompted to fill this out first. Build or edit it visually instead of hand-editing YAML or LaTeX, including importing from existing resumes (PDF/Markdown/text/JSON) via local Ollama extraction, with a compare view when multiple sources disagree. Every other feature below reads from this one file, so switching which jobs/projects show up on a resume is fast and doesn't touch your source `.tex`.

### Tailor Resume

Paste a job description and get every bullet in your experience bank scored 0-100 against it: either instantly via keyword overlap, or more thoroughly via a local Ollama model that scores section-by-section and explains *why* a bullet scored low.

- **Skill gap detection**: surfaces JD keywords/phrases your bullet bank doesn't cover, filtered against a stopword list and cross-checked via Ollama so it doesn't just re-flag something you already have.
- **Bullet improvement**: low-scoring bullets get an "Improve with Ollama" rewrite suggestion with a before/after diff; every bullet also supports direct inline editing.
- **Tailored resume generation**: generates a `.tex` file from the AI-suggested best-fit selections and compiles it to a page-fit PDF via `latexmk`. If it's over your page limit, it automatically trims the weakest bullets/sections (in priority order) until it fits, with every trim reported. Output lands in a local, git-ignored `latex-resumes/` -- a quick one-off, separate from the persistent library below.

### My Resumes

Build named, organized resumes from your experience bank without starting from a blank JD every time. Toggle which jobs, projects, education, certifications, and skills are included with a simplified form -- or drop into a full LaTeX editor if you'd rather work directly in the source. Resumes are organized into folders via an in-app file browser, with PDF preview and direct `.tex`/PDF download, saved to your local [`/saved`](#project-structure) directory.

### Also in this repo (standalone, not yet integrated)

- [`application-tracker/`](application-tracker): early scaffold for tracking applications; see [Roadmap](#roadmap) for where this is headed.
- [`company-notes/`](company-notes): a lightweight markdown template for capturing per-company research before applying or interviewing; see [Roadmap](#roadmap) for the planned in-app version.

## Project Structure

- [`experience.yaml`](experience.yaml): your experience bank that holds all of your experience(contact info, job history, projects, certifications, techinical skills, and more). This file never hits the internet, and is stored locally. (see [Privacy](#privacy--your-data)).
- [`resume-revisioner/`](resume-revisioner): the Next.js + Ollama app; current home of Resumake.cv. See its [README](resume-revisioner/README.md) for how the tailoring/scoring/generation pipeline works.
- `/saved`: git-ignored local storage for resumes created via the **My Resumes** tab. User can organize their resumes into folders through the app's file browser (see [Privacy](#privacy--your-data)).
The following are scaffolds for features that will be added. (see [Roadmap](#roadmap)
- [`application-tracker/`](application-tracker): Next.js app for tracking applications (early scaffold, standalone for now).
- [`company-notes/`](company-notes): per-company research notes, from [`company-notes-template.md`](company-notes/company-notes-template.md) (standalone for now).
- [`latex-case-study/`](latex-case-study): reusable LaTeX template for a project one-pager / case study. Unlike the paths above, this one ships filled with placeholders, not personal data, so it stays tracked in git.

## requirements

<img width="1010" height="195" alt="required" src="https://github.com/user-attachments/assets/98d2db70-ff26-4c82-af18-9c06f62d7f22" />

- **[Node.js](https://nodejs.org)** 20+ and npm, to run `resume-revisioner` (and `application-tracker`).
- **[Ollama](https://ollama.com)** running locally with a model pulled (e.g. `ollama pull llama3.2:3b`): needed for Ollama-mode analysis, bullet improvement, and experience extraction. Keyword-overlap mode works without it.
- **[TeX Live](https://tug.org/texlive/)** (full distribution, not minimal): required to compile generated resumes to PDF. Needs packages like `fontawesome5`, `titlesec`, and `tabularx`.
- **[LaTeX Workshop](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop)** VS Code / Cursor extension: optional, but useful if you want to view or edit `.tex` output directly.

## installation

<img width="1010" height="195" alt="install" src="https://github.com/user-attachments/assets/f7789302-2a3e-4488-95f2-7b581ce86d11" />

1. Clone this repo.
```
git clone https://github.com/navpildev/resume.cv
```
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

## usage

<img width="1010" height="195" alt="usage" src="https://github.com/user-attachments/assets/9d5ce341-ac20-417d-9384-91ce2d81b13d" />


1. Open **My Experience** and either import an existing resume or fill in your work history, projects, education, and skills by hand -- this becomes `experience.yaml`.
2. Go to **Tailor Resume**, paste a job description, and run an analysis (keyword or Ollama mode).
3. Review bullet scores and skill gaps, improve or edit weak bullets, then generate a tailored resume -- it compiles straight to a page-fit PDF.
4. Or, use **My Resumes** to build a named, reusable resume by toggling sections from your experience bank (or editing the LaTeX directly), and save it into an organized folder for later.

## roadmap

<img width="1010" height="195" alt="roadmap" src="https://github.com/user-attachments/assets/59b28110-7006-4820-b54b-710fcc8abb94" />

This project has a long way to go -- the following are planned, not yet built:

- **Company research**: an in-app replacement for the current [`company-notes/`](company-notes) template: an Ollama-driven web-search agent synthesizes publicly available info about a company, team, and contacts into your notes, which you can edit and download as `.tex`/PDF from the app itself.
- **Application tracker**: a real replacement for the current [`application-tracker/`](application-tracker) scaffold. Link a Gmail/Zoho inbox (with a dedicated folder for job applications), and a local Ollama agent checks it roughly hourly (or whenever the app opens) to keep your application statuses up to date automatically, plus follow-up reminders when you haven't heard back in a while.
- **Project suggestions**: an Ollama agent compares your experience bank against recently-analyzed job descriptions and suggests concrete next projects to close the gaps it finds.
- **Settings**: an Ollama model picker, light/dark theme, and other preferences as they come up.
- **Inline LaTeX suggestions** *(under consideration)*: Ollama-driven tab-complete while editing `.tex` directly. Not committed to yet -- still weighing the implementation cost.
- Company research and job-description crawling are expected to be backed by a local, Ollama-driven web scraper and a RAG-style vector index for fast, accurate retrieval -- still entirely on-machine, nothing sent to a hosted API.
- **Dockerized Setup Process**: Once all features are locked in, the whole project will be dockerized so that anyone on any system can easily download and use resumake.cv without having to worry about installing everything correctly.

## Privacy & your data

Everything runs locally -- your experience bank, job descriptions, and generated resumes never leave your machine, and any AI-assisted analysis or generation runs against your own local Ollama install, not a hosted API. `experience.yaml`, `/saved`, and `latex-resumes/` are all git-ignored by design; nothing you enter through the app gets committed to this repo.

## License

[PolyForm Noncommercial 1.0.0](LICENSE): free to use, modify, and share for any noncommercial purpose. Commercial use requires separate permission from the author.
