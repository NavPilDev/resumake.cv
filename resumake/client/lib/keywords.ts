import { STOPWORDS } from "./stopwords";

/** Lowercase, unify separators to spaces, strip anything but a few
 * meaningful symbols (+ # . for terms like "C++", "C#", "Node.js"). */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-_/]/g, " ")
    .replace(/[^a-z0-9+#. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Wraps a normalized string in spaces so whole-word/phrase boundary
 * checks via `.includes(' term ')` work at the string edges too. */
export function pad(normalized: string): string {
  return ` ${normalized} `;
}

/** Does `term` appear as a whole word/phrase inside the already-padded,
 * already-normalized haystack? */
export function termIncluded(paddedNormalizedHaystack: string, term: string): boolean {
  const normTerm = normalizeForMatch(term.replace(/-/g, " "));
  if (!normTerm) return false;
  return paddedNormalizedHaystack.includes(` ${normTerm} `);
}

export function tokenize(text: string): string[] {
  return normalizeForMatch(text).split(" ").filter(Boolean);
}

export interface CandidatePhrase {
  phrase: string;
  frequency: number;
}

/** Simple frequency-based unigram + bigram extraction from raw JD text,
 * skipping stopwords. Bigrams catch common multi-word skill phrases
 * ("machine learning", "product management") that unigrams alone miss.
 * Bigrams are only formed within a sentence, so they don't bridge two
 * unrelated sentences (e.g. "...PostgreSQL. Familiarity..." must not
 * yield the bigram "postgresql familiarity"). A period only ends a
 * sentence when followed by whitespace/end-of-string, so mid-word dots
 * like "Node.js" survive tokenization intact. */
export function extractCandidatePhrases(jdText: string): CandidatePhrase[] {
  const sentences = jdText.split(/[!?;\n]+|\.(?=\s|$)/);
  const counts = new Map<string, number>();

  for (const sentence of sentences) {
    const tokens = tokenize(sentence);
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.length >= 2 && !STOPWORDS.has(t)) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const next = tokens[i + 1];
      if (
        next &&
        t.length >= 2 &&
        next.length >= 2 &&
        !STOPWORDS.has(t) &&
        !STOPWORDS.has(next)
      ) {
        const bigram = `${t} ${next}`;
        counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .map(([phrase, frequency]) => ({ phrase, frequency }))
    .sort((a, b) => b.frequency - a.frequency || a.phrase.localeCompare(b.phrase));
}
