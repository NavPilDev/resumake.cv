import { termIncluded, tokenize } from "./keywords";
import { buildBulletHaystack } from "./scoring";
import { STOPWORDS } from "./stopwords";
import type {
  AnalyzeProgressEvent,
  AnalyzeResponse,
  GapKeyword,
  RankedSection,
  ScoredBullet,
  Section,
} from "./types";

const DEFAULT_HOST = "http://localhost:11434";
const REQUEST_TIMEOUT_MS = 120_000;
const SYSTEM_PROMPT =
  "You are a precise resume-tailoring assistant. Respond with strictly valid JSON only — no markdown fences, no commentary, no trailing commas.";

async function callOllamaChat(host: string, model: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        format: "json",
        stream: false,
        options: { temperature: 0.2 },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Ollama at ${host} didn't respond within ${REQUEST_TIMEOUT_MS / 1000}s. The model may be too large for this machine, or still loading — try again.`
      );
    }
    throw new Error(
      `Could not reach Ollama at ${host}. Is \`ollama serve\` running? (${
        err instanceof Error ? err.message : String(err)
      })`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama request failed (${res.status}). ${text || "Check that the model name is correct and pulled (`ollama list`)."}`
    );
  }

  const data = await res.json();
  const content = data?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama returned an empty response.");
  }
  return content;
}

function parseModelJson<T>(raw: string): T {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        // fall through to error below
      }
    }
    throw new Error("Ollama returned invalid JSON — try again or use a different model.");
  }
}

/** Shared low-level helper: send a prompt, get parsed JSON back. Reused by
 * section scoring, gap-finding, overview generation, the improve-bullet
 * endpoint, and experience extraction — each just builds its own prompt and
 * validates its own shape. Exported so lib/experienceExtraction.ts inherits
 * the same connection-failure/timeout/invalid-JSON error messages. */
export async function ollamaJsonChat<T>(host: string, model: string, prompt: string): Promise<T> {
  const raw = await callOllamaChat(host, model, prompt);
  return parseModelJson<T>(raw);
}

function humanizeTag(tag: string): string {
  return tag.replace(/-/g, " ");
}

// ---------------------------------------------------------------------------
// Per-section bullet scoring
// ---------------------------------------------------------------------------

interface SectionScorePick {
  id?: unknown;
  score?: unknown;
  reason?: unknown;
}

interface SectionScoreResponseShape {
  bullets?: SectionScorePick[];
}

function buildSectionScoringPrompt(section: Section, jdText: string): string {
  const bullets = section.bullets.map((b) => ({ id: b.id, text: b.text, tags: b.tags }));
  return `JOB DESCRIPTION:
"""
${jdText.trim()}
"""

RESUME SECTION: "${section.label}"
BULLETS:
${JSON.stringify(bullets, null, 2)}

TASK: Score each bullet's relevance to the job description above on a 0-100 scale (100 = directly demonstrates a core requirement of the role, 0 = completely unrelated). For every bullet, write a "reason": one specific sentence (20 words or fewer). If the score is low, name what's missing or why it doesn't align — don't just say "not relevant" or "low relevance".

Respond with ONLY one JSON object, no markdown fences, no commentary, covering EVERY bullet id exactly once:
{
  "bullets": [ { "id": "<bullet id>", "score": <integer 0-100>, "reason": "<reason>" } ]
}`;
}

function hydrateSectionFromPicks(
  section: Section,
  parsed: SectionScoreResponseShape,
  maxBullets: number
): RankedSection {
  const picks = Array.isArray(parsed.bullets) ? parsed.bullets : [];
  const byId = new Map<string, SectionScorePick>();
  for (const p of picks) {
    if (typeof p?.id === "string") byId.set(p.id, p);
  }

  const scored: ScoredBullet[] = section.bullets.map((bullet) => {
    const pick = byId.get(bullet.id);
    const rawScore = typeof pick?.score === "number" && Number.isFinite(pick.score) ? pick.score : 0;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    const reason =
      typeof pick?.reason === "string" && pick.reason.trim()
        ? pick.reason.trim()
        : pick
          ? undefined
          : "Ollama did not return a score for this bullet — review manually.";
    return { ...bullet, score, reason, matchedKeywords: [] };
  });

  const ranked = [...scored].sort((a, b) => {
    const diff = b.score - a.score;
    if (diff !== 0) return diff;
    if (a.has_metric !== b.has_metric) return a.has_metric ? -1 : 1;
    return 0;
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
}

// ---------------------------------------------------------------------------
// Gap-finding (unchanged approach from before: tag-list framing + deterministic
// "already covered" safety net against small-model hallucination)
// ---------------------------------------------------------------------------

interface GapsResponseShape {
  gaps?: unknown[];
}

function buildGapsPrompt(sections: Section[], jdText: string): string {
  const allTags = Array.from(
    new Set(sections.flatMap((s) => s.bullets.flatMap((b) => b.tags.map(humanizeTag))))
  ).sort();

  return `JOB DESCRIPTION:
"""
${jdText.trim()}
"""

SKILLS/TECHNOLOGIES ALREADY ON THE RESUME (do not list any of these, or close synonyms of them, as a gap):
${allTags.join(", ")}

TASK: Read the job description above carefully. List up to 10 short phrases (3-6 words each, no trailing ellipsis or punctuation) for skills, technologies, or qualifications that are EXPLICITLY stated in the job description text above but are NOT in the "already on the resume" list. Only use wording that actually appears in the job description — do not invent, assume, or add generic requirements just because they're common for similar roles (e.g. don't add "Agile", "CI/CD", "cloud platforms", or "security testing" unless the job description text above literally mentions them). If the job description only supports fewer than 10 genuine gaps, return fewer — do not pad the list.

Respond with ONLY one JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "gaps": ["<phrase>", "..."]
}`;
}

function isAlreadyCovered(phrase: string, bulletHaystack: string): boolean {
  const words = tokenize(phrase).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  if (words.length === 0) return termIncluded(bulletHaystack, phrase);
  return words.every((w) => termIncluded(bulletHaystack, w));
}

function hydrateGaps(parsed: GapsResponseShape, bulletHaystack: string): GapKeyword[] {
  const gaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];
  const seen = new Set<string>();
  const result: GapKeyword[] = [];
  for (const g of gaps) {
    if (typeof g !== "string") continue;
    const keyword = g.trim();
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    if (isAlreadyCovered(keyword, bulletHaystack)) continue;
    seen.add(key);
    result.push({ keyword });
    if (result.length >= 15) break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Overview generation
// ---------------------------------------------------------------------------

interface OverviewResponseShape {
  overview?: unknown;
}

function buildOverviewPrompt(sections: RankedSection[], gaps: GapKeyword[], jdText: string): string {
  const scoreLines = sections
    .map((s) => `- ${s.label}: top score ${Math.max(0, ...s.shownBullets.map((b) => b.score))}`)
    .join("\n");
  const gapList = gaps.length > 0 ? gaps.map((g) => g.keyword).join(", ") : "none identified";

  return `JOB DESCRIPTION:
"""
${jdText.trim()}
"""

BULLET SCORES BY RESUME SECTION (0-100 relevance to the job description):
${scoreLines}

IDENTIFIED GAPS: ${gapList}

TASK: Write a short candidate-fit overview (3-5 sentences): overall alignment with the role, the 2-3 strongest matching experiences (name them specifically), and the most important gaps to address in a cover letter or interview. Be direct and specific about actual technologies/skills — no generic filler like "the candidate seems like a good fit". IMPORTANT: the bullet scores measure how well the candidate's EXISTING resume bullets match the job description — they are not a list of the candidate's skills. The IDENTIFIED GAPS list is the authoritative source for what's missing from the resume. Never say the candidate has, is "familiar with", or is "notable for" a skill/technology solely because it's mentioned in the job description — only attribute a skill to the candidate if it's implied by their actual bullet content (reflected in a high score), and only call something a gap if it appears in the IDENTIFIED GAPS list above.

Respond with ONLY one JSON object, no markdown fences, no commentary: { "overview": "<3-5 sentences>" }`;
}

function hydrateOverview(parsed: OverviewResponseShape): string | undefined {
  return typeof parsed.overview === "string" && parsed.overview.trim()
    ? parsed.overview.trim()
    : undefined;
}

// ---------------------------------------------------------------------------
// Orchestration: streams progress events, then a final result event
// ---------------------------------------------------------------------------

export async function* analyzeWithOllamaStream(
  sections: Section[],
  jdText: string,
  maxBullets: number,
  options: { model: string; host?: string }
): AsyncGenerator<AnalyzeProgressEvent, void, void> {
  const host = (options.host || DEFAULT_HOST).replace(/\/+$/, "");
  const model = options.model;

  const rankedSections: RankedSection[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    yield { type: "progress", stage: "scoring", current: i + 1, total: sections.length, label: section.label };

    let parsed: SectionScoreResponseShape;
    try {
      parsed = await ollamaJsonChat<SectionScoreResponseShape>(
        host,
        model,
        buildSectionScoringPrompt(section, jdText)
      );
    } catch (err) {
      // One section's failure shouldn't sink the whole analysis — fall back
      // to zero-scored bullets (still shown, in original order) and surface
      // the error via each bullet's reason so it's visible in the UI.
      const message = err instanceof Error ? err.message : String(err);
      parsed = {
        bullets: section.bullets.map((b) => ({ id: b.id, score: 0, reason: `Scoring failed: ${message}` })),
      };
    }
    rankedSections.push(hydrateSectionFromPicks(section, parsed, maxBullets));
  }

  const warnings: string[] = [];

  yield { type: "progress", stage: "gaps" };
  const bulletHaystack = buildBulletHaystack(sections);
  let gaps: GapKeyword[] = [];
  try {
    const gapsParsed = await ollamaJsonChat<GapsResponseShape>(host, model, buildGapsPrompt(sections, jdText));
    gaps = hydrateGaps(gapsParsed, bulletHaystack);
  } catch (err) {
    warnings.push(
      `Skill-gap detection failed (${err instanceof Error ? err.message : String(err)}) — the empty list below may not mean full coverage.`
    );
  }

  yield { type: "progress", stage: "overview" };
  let overview: string | undefined;
  try {
    const overviewParsed = await ollamaJsonChat<OverviewResponseShape>(
      host,
      model,
      buildOverviewPrompt(rankedSections, gaps, jdText)
    );
    overview = hydrateOverview(overviewParsed);
  } catch (err) {
    warnings.push(`Overview generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const result: AnalyzeResponse = {
    mode: "ollama",
    sections: rankedSections,
    gaps,
    overview,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
  yield { type: "result", data: result };
}

/** Standalone helper for the improve-bullet endpoint. */
export async function improveWithOllama(
  bulletText: string,
  tags: string[],
  jdText: string,
  options: { model: string; host?: string }
): Promise<string> {
  const host = (options.host || DEFAULT_HOST).replace(/\/+$/, "");
  const prompt = `JOB DESCRIPTION:
"""
${jdText.trim()}
"""

ORIGINAL RESUME BULLET:
"${bulletText}"
Tags: ${tags.join(", ") || "none"}

TASK: Rewrite the bullet to better align with the job description above. Keep it ONE sentence, in resume-bullet style (past tense, action-verb led). Do NOT invent skills, tools, technologies, or metrics that aren't implied by the original bullet — only rephrase, reorder, and emphasize what's already true. If the original has no reasonable connection to the job description, make only light wording improvements rather than forcing an unrelated connection.

Respond with ONLY one JSON object, no markdown fences, no commentary: { "improvedText": "<rewritten bullet>" }`;

  const parsed = await ollamaJsonChat<{ improvedText?: unknown }>(host, options.model, prompt);
  const improved = typeof parsed.improvedText === "string" ? parsed.improvedText.trim() : "";
  if (!improved) {
    throw new Error("Ollama did not return an improved bullet — try again.");
  }
  return improved;
}
