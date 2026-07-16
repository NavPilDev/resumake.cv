# resume-revisioner

Local tool for tailoring [`experience.yaml`](../experience.yaml) to a specific job description. Paste in a JD, get your bullet bank ranked by keyword overlap, and see which JD keywords aren't covered by any bullet.

## Run it

```bash
npm install   # first time only
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. Paste the raw job description text into the textarea and set a max-bullets-per-role limit (default 4).
2. `POST /api/analyze` ([app/api/analyze/route.ts](app/api/analyze/route.ts)) reads `experience.yaml` from the repo root fresh on every request, so edits there show up without restarting the server.
3. Scoring ([lib/scoring.ts](lib/scoring.ts)): each bullet is scored by how many of its tags (weighted 2x) and significant text words (weighted 1x) appear in the JD. Bullets are ranked within their job/project section and the top N (per the max-bullets setting) are shown.
4. Gaps ([lib/scoring.ts](lib/scoring.ts) `findGaps`): unigrams and bigrams are extracted from the JD (sentence-aware, so bigrams don't bridge two sentences), filtered against a stopword list, then checked against the full bullet bank. Anything with zero coverage — and not just an incidental pairing of two skills you do have — is listed as a gap to address in a cover letter or interview prep.

Nothing is written back to `experience.yaml` or any `.tex` file — this only prints recommendations for you to review and copy in yourself.

## Adjusting keyword matching

- Stopwords / JD filler words: [lib/stopwords.ts](lib/stopwords.ts)
- Normalization + phrase extraction: [lib/keywords.ts](lib/keywords.ts)
- Scoring/ranking/gap logic: [lib/scoring.ts](lib/scoring.ts)
