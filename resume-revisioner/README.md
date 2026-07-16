# resume-revisioner

Local tool for tailoring [`experience.yaml`](../experience.yaml) to a specific job description. Paste in a JD, get your bullet bank ranked, and see which JD keywords aren't covered by any bullet. Two analysis methods: a dependency-free keyword-overlap scorer, or a local Ollama LLM for judgment-based ranking.

## Run it

```bash
npm install   # first time only
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. Paste the raw job description text into the textarea, pick an analysis method, and set a max-bullets-per-role limit (default 4) — this caps how many bullets are shown per job/project section, not a global total.
2. `POST /api/analyze` ([app/api/analyze/route.ts](app/api/analyze/route.ts)) reads `experience.yaml` from the repo root fresh on every request, so edits there show up without restarting the server.

### Keyword overlap mode

- Scoring ([lib/scoring.ts](lib/scoring.ts)): each bullet is scored by how many of its tags (weighted 2x) and significant text words (weighted 1x) appear in the JD. Bullets are ranked within their job/project section and the top N (per the max-bullets setting) are shown.
- Gaps (`findGaps` in [lib/scoring.ts](lib/scoring.ts)): unigrams and bigrams are extracted from the JD (sentence-aware, so bigrams don't bridge two sentences), filtered against a stopword list, then checked against the full bullet bank. Anything with zero coverage — and not just an incidental pairing of two skills you do have — is listed as a gap.

### Ollama mode

Requires [Ollama](https://ollama.com) running locally with a model already pulled (`ollama pull llama3.2:3b`, or whatever model you set in the UI — check what you have with `ollama list`).

- [lib/ollama.ts](lib/ollama.ts) makes two separate calls to `${host}/api/chat` (default `http://localhost:11434`, `format: "json"`): one asks the model to pick and justify the top bullets per section, the other asks it to find JD skills missing from the resume. They're kept separate (rather than one combined prompt) because small local models lose track of a "pick bullets AND find gaps" instruction bundled with a large bullet-bank JSON dump in a single call.
- The model's bullet picks are validated against the real bullet ids per section — it can't invent or misattribute a bullet, and any section it botches falls back to that section's original bullet order.
- The model's gap claims go through a deterministic safety net: any "gap" is dropped if every one of its meaningful words already shows up somewhere in the bullet bank (tags or text), since small models otherwise tend to hallucinate generic "typical job requirements" or mix up what's already on the resume vs. what's in the JD.
- This is noticeably slower than keyword mode (seconds to a couple minutes depending on your hardware and model size) and, being an LLM, can still occasionally miss or misjudge things — treat its picks as a second opinion, not ground truth.

Nothing is written back to `experience.yaml` or any `.tex` file — this only prints recommendations for you to review and copy in yourself.

## Adjusting keyword matching

- Stopwords / JD filler words: [lib/stopwords.ts](lib/stopwords.ts)
- Normalization + phrase extraction: [lib/keywords.ts](lib/keywords.ts)
- Scoring/ranking/gap logic: [lib/scoring.ts](lib/scoring.ts)
- Ollama prompts/parsing/validation: [lib/ollama.ts](lib/ollama.ts)
