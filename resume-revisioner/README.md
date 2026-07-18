# resume-revisioner

Local tool for tailoring [`experience.yaml`](../experience.yaml) to a specific job description. Paste in a JD, get your bullet bank scored (0-100), see which JD keywords aren't covered, tweak the results, and generate a tailored `.tex` resume — all without ever writing back to `experience.yaml` until you explicitly export it.

> **Note:** this is also where [Resumeak](../README.md#resumeak) — a planned single local, Ollama-powered program that bundles this JD-tailoring flow, experience-bank editing, application tracking, and company notes into one tool anyone can run — is being built. It hasn't been renamed yet, so it's still `resume-revisioner` in `package.json`, routes, etc. An **"input your experience"** feature (building/editing the `experience.yaml` bullet bank from the app UI, instead of hand-editing YAML) is currently in progress.

## Run it

```bash
npm install   # first time only
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. Paste the raw job description text into the textarea, pick an analysis method, and set a max-bullets-per-role limit (default 4) — this caps how many bullets are shown per job/project section, not a global total.
2. `POST /api/analyze` ([app/api/analyze/route.ts](app/api/analyze/route.ts)) reads `experience.yaml` from the repo root fresh on every request, so edits there show up without restarting the server.
3. Every bullet gets a **0-100 score**, on the same scale regardless of analysis method, so "low score" and the improve-bullet threshold behave consistently either way.

### Keyword overlap mode

- Scoring ([lib/scoring.ts](lib/scoring.ts)): each bullet is scored by how many of its tags (weighted 2x) and significant text words (weighted 1x) appear in the JD, then normalized to 0-100 against the best-matching bullet in the whole run. Bullets are ranked within their job/project section and the top N (per the max-bullets setting) are shown.
- Gaps (`findGaps` in [lib/scoring.ts](lib/scoring.ts)): unigrams and bigrams are extracted from the JD (sentence-aware, so bigrams don't bridge two sentences), filtered against a stopword list, then checked against the full bullet bank. Anything with zero coverage — and not just an incidental pairing of two skills you do have — is listed as a gap.
- Instant, no dependencies, runs entirely in the request handler.

### Ollama mode

Requires [Ollama](https://ollama.com) running locally with a model already pulled (`ollama pull llama3.2:3b`, or whatever model you set in the UI — check what you have with `ollama list`).

- [lib/ollama.ts](lib/ollama.ts)'s `analyzeWithOllamaStream` is an async generator that scores **one resume section at a time** (a small, focused prompt per job/project — the model only ever sees a handful of bullets plus the JD), then does one call for gap-finding and one for an overview. Small local models lose track of instructions when a "score everything AND find gaps" prompt is bundled with the whole bullet bank at once — per-section calls fixed that.
- `POST /api/analyze` streams NDJSON progress events (`{"type":"progress","stage":"scoring","current":i,"total":n,"label":"..."}` etc.) so the frontend shows a real per-section progress bar instead of a blind spinner — see `stageLabel` in [app/page.tsx](app/page.tsx).
- Every bullet gets a `reason` — the model is asked to be specific about *why* a bullet scored low, not just "not relevant".
- After scoring, an **analysis overview** (2-3 sentences on fit, strengths, and gaps) is generated from the scores + gaps. Its prompt explicitly warns the model not to confuse "mentioned in the JD" with "the candidate has this skill" — caught it doing exactly that hallucination during testing before the fix.
- The gap list goes through a deterministic safety net regardless of what the model claims: a "gap" is dropped if every one of its meaningful words already shows up somewhere in the bullet bank (tags or text), since small models otherwise mix up what's already on the resume vs. what's in the JD.
- If the gaps or overview step errors out, that's surfaced as a visible warning in the UI — it does *not* silently render as "no gaps found", which would be misleading.
- Noticeably slower than keyword mode (the 20-section bullet bank here takes roughly 1.5-2.5 minutes end to end on a single local GPU) and, being an LLM, can still occasionally miss or misjudge things — treat its picks as a second opinion, not ground truth.

### Improving and editing bullets

- Any bullet scoring below 50 gets an **"Improve with Ollama"** button ([app/api/improve/route.ts](app/api/improve/route.ts) + [app/components/BulletCard.tsx](app/components/BulletCard.tsx)) — available regardless of which analysis mode you ran, since it's a separate, focused Ollama call. Shows a before/after diff; "Use this version" applies it, "Discard" throws it away.
- Every bullet has an **Edit** button for direct inline rewrites.
- Both feed into the same per-bullet override map in [app/page.tsx](app/page.tsx), which is what actually gets used for resume generation below — your edits and accepted improvements are never lost, but nothing is written back to `experience.yaml` itself.

### Generating a tailored resume

The "Generate tailored resume" panel (right sidebar, right under Skill gaps — both stay pinned in view via `position: sticky` and scroll independently of the page once their content outgrows the viewport) writes a real `.tex` file into `latex-resumes/` and compiles it to PDF:

- [lib/latexTemplate.ts](lib/latexTemplate.ts) builds the document using the exact preamble/custom commands from `latex-resumes/master-resume.tex` (kept in sync manually — update both if you change the template's packages or commands). Education and Technical Skills are pulled as-is from `experience.yaml`'s `education`/`technical_skills` arrays and are never trimmed.
- You set **max jobs**, **max projects**, and **max pages**. [lib/resumeFit.ts](lib/resumeFit.ts) picks the top-scoring sections of each kind, then [lib/latexCompile.ts](lib/latexCompile.ts) actually compiles with `latexmk` (using `latex-resumes/.latexmkrc`'s `build`/`out` dirs) and reads the real page count back out of the log — this isn't a heuristic, it's the genuine compiled page count.
- If it doesn't fit, it trims in priority order and recompiles: weakest bullet from the lowest-scoring project → whole lowest-scoring project → weakest bullet from the lowest-scoring job → whole lowest-scoring job. All of this happens under a scratch filename first; your real requested filename is only written once (or if the budget can't be hit, once at the end with whatever fits best), so a page-fit attempt in progress never leaves a broken file under the name you asked for.
- [lib/generateResume.ts](lib/generateResume.ts)'s `generateResumeStream` is an async generator, and `POST /api/generate-resume` streams its NDJSON progress events the same way the Ollama analysis does — so each compile/trim pass shows up live in the UI instead of a single blind "Compiling…" spinner, since a resume that needs a lot of trimming can mean a dozen-plus latexmk invocations in a row.
- Every trim is reported, but collapsed by default behind a "View generation notes (N)" toggle next to the success message — expand it to see exactly what got cut (and any warnings) without it cluttering the main result.
- If `<filename>.tex` already exists in `latex-resumes/`, generating sends a `needs_confirmation` event instead of silently overwriting — click the button again (it relabels to "Overwrite and Generate") to confirm.
- LaTeX special characters (`% & # _ { } ~ ^ \`) are escaped via [lib/latexEscape.ts](lib/latexEscape.ts).
- Job entries in `experience.yaml` can carry a `location:` field, which fills in the generated resume's job location column (`toSections` in [lib/scoring.ts](lib/scoring.ts) reads it if present).

## Adjusting keyword matching

- Stopwords / JD filler words: [lib/stopwords.ts](lib/stopwords.ts)
- Normalization + phrase extraction: [lib/keywords.ts](lib/keywords.ts)
- Scoring/ranking/gap logic: [lib/scoring.ts](lib/scoring.ts)
- Ollama prompts/parsing/streaming/improve: [lib/ollama.ts](lib/ollama.ts)
- LaTeX template/escaping/page-fit/compile: [lib/latexTemplate.ts](lib/latexTemplate.ts), [lib/latexEscape.ts](lib/latexEscape.ts), [lib/resumeFit.ts](lib/resumeFit.ts), [lib/latexCompile.ts](lib/latexCompile.ts)
