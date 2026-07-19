import { normalizeForMatch, pad, termIncluded, tokenize, extractCandidatePhrases } from "./keywords";
import { STOPWORDS } from "./stopwords";
import type {
  Bullet,
  ExperienceData,
  GapKeyword,
  RankedSection,
  ScoredBullet,
  Section,
} from "./types";

export function toSections(data: ExperienceData): Section[] {
  const jobSections: Section[] = (data.jobs ?? [])
    .filter((job) => job.included !== false)
    .map((job, i) => ({
      id: `job-${i}-${slug(job.company)}`,
      kind: "job",
      label: `${job.company} — ${job.role}`,
      dates: job.dates,
      location: job.location,
      company: job.company,
      role: job.role,
      bullets: job.bullets,
    }));

  const projectSections: Section[] = (data.projects ?? [])
    .filter((project) => project.included !== false)
    .map((project, i) => ({
      id: `project-${i}-${slug(project.name)}`,
      kind: "project",
      label: project.name,
      dates: project.dates,
      links: project.links,
      bullets: project.bullets,
    }));

  return [...jobSections, ...projectSections];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Words within a bullet's own text (beyond its curated tags) that are
 * long/specific enough to count as matchable skill signal. */
function significantTextWords(text: string): string[] {
  return Array.from(
    new Set(tokenize(text).filter((w) => w.length >= 4 && !STOPWORDS.has(w)))
  );
}

interface RawScoredBullet extends Bullet {
  rawScore: number;
  matchedKeywords: string[];
}

function scoreBulletRaw(bullet: Bullet, paddedJD: string): RawScoredBullet {
  const matchedTags = bullet.tags.filter((t) => termIncluded(paddedJD, t));

  // Skip text words already implied by a matched tag (e.g. don't surface
  // "full"/"stack" separately when the "full-stack" tag already matched).
  const tagWordSet = new Set(matchedTags.flatMap((t) => tokenize(t)));
  const matchedTextWords = significantTextWords(bullet.text).filter(
    (w) => !tagWordSet.has(w) && termIncluded(paddedJD, w)
  );

  const rawScore = matchedTags.length * 2 + matchedTextWords.length;
  const matchedKeywords = Array.from(new Set([...matchedTags, ...matchedTextWords]));

  return { ...bullet, rawScore, matchedKeywords };
}

export function rankSections(
  sections: Section[],
  jdText: string,
  maxBullets: number
): RankedSection[] {
  const paddedJD = pad(normalizeForMatch(jdText));

  const scoredBySection = sections.map((section) => ({
    section,
    bullets: section.bullets.map((b) => scoreBulletRaw(b, paddedJD)),
  }));

  // Normalize against the best-matching bullet across the WHOLE bank (not
  // per-section) so a "70" in one job means the same relative strength as a
  // "70" in another — keeps scores comparable across sections, and gives
  // Ollama mode's 0-100 scale a directly comparable keyword-mode counterpart.
  const maxRaw = Math.max(1, ...scoredBySection.flatMap((s) => s.bullets.map((b) => b.rawScore)));

  return scoredBySection.map(({ section, bullets }) => {
    const scored: ScoredBullet[] = bullets.map(({ rawScore, ...b }) => ({
      ...b,
      score: Math.round((rawScore / maxRaw) * 100),
    }));

    const ranked = [...scored].sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      if (a.has_metric !== b.has_metric) return a.has_metric ? -1 : 1;
      return 0; // stable sort keeps original bullet order as final tiebreak
    });

    return {
      id: section.id,
      kind: section.kind,
      label: section.label,
      dates: section.dates,
      location: section.location,
      company: section.company,
      role: section.role,
      links: section.links,
      totalBullets: section.bullets.length,
      shownBullets: ranked.slice(0, Math.max(1, maxBullets)),
    };
  });
}

/** Padded, normalized blob of every tag + bullet text in the bank, for
 * whole-word/phrase "is this already covered?" checks via termIncluded. */
export function buildBulletHaystack(sections: Section[]): string {
  const allBullets = sections.flatMap((s) => s.bullets);
  return pad(
    normalizeForMatch(
      allBullets.map((b) => `${b.tags.join(" ")} ${b.text}`).join(" ")
    )
  );
}

/** JD keywords/phrases with no coverage anywhere in the bullet bank
 * (tags or bullet text) — candidates for a cover letter or interview prep. */
export function findGaps(sections: Section[], jdText: string, limit = 20): GapKeyword[] {
  const bulletHaystack = buildBulletHaystack(sections);

  const candidates = extractCandidatePhrases(jdText)
    .filter((c) => !termIncluded(bulletHaystack, c.phrase))
    // A bigram whose two words are each independently covered elsewhere in
    // the bullet bank is likely incidental JD adjacency ("python react"),
    // not a real compound-skill gap ("machine learning", where "machine"
    // itself is never covered) — drop those.
    .filter((c) => {
      if (!c.phrase.includes(" ")) return true;
      const words = c.phrase.split(" ");
      return !words.every((w) => termIncluded(bulletHaystack, w));
    });

  // Drop unigrams that are already implied by a surviving bigram gap,
  // e.g. skip standalone "learning" if "machine learning" is already listed.
  const bigramGaps = candidates.filter((c) => c.phrase.includes(" "));
  const deduped = candidates.filter((c) => {
    if (!c.phrase.includes(" ")) {
      return !bigramGaps.some((b) => b.phrase !== c.phrase && pad(b.phrase).includes(` ${c.phrase} `));
    }
    return true;
  });

  return deduped.slice(0, limit).map((c) => ({ keyword: c.phrase, frequency: c.frequency }));
}
