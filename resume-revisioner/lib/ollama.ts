import { termIncluded, tokenize } from "./keywords";
import { buildBulletHaystack } from "./scoring";
import { STOPWORDS } from "./stopwords";
import type { AnalyzeResponse, Bullet, GapKeyword, RankedSection, ScoredBullet, Section } from "./types";

const DEFAULT_HOST = "http://localhost:11434";
const REQUEST_TIMEOUT_MS = 120_000;
const SYSTEM_PROMPT =
  "You are a precise resume-tailoring assistant. Respond with strictly valid JSON only — no markdown fences, no commentary, no trailing commas.";

interface ModelBulletPick {
  id?: unknown;
  why?: unknown;
}

interface ModelSectionPick {
  id?: unknown;
  bullets?: ModelBulletPick[];
}

interface RankingResponseShape {
  sections?: ModelSectionPick[];
}

interface GapsResponseShape {
  gaps?: unknown[];
}

function buildBulletBank(sections: Section[]) {
  return sections.map((s) => ({
    id: s.id,
    label: s.label,
    bullets: s.bullets.map((b) => ({ id: b.id, text: b.text, tags: b.tags })),
  }));
}

function humanizeTag(tag: string): string {
  return tag.replace(/-/g, " ");
}

function buildRankingPrompt(sections: Section[], jdText: string, maxBullets: number): string {
  const bank = buildBulletBank(sections);
  return `JOB DESCRIPTION:
"""
${jdText.trim()}
"""

BULLET BANK (grouped by resume section, each bullet has an id, its text, and tags):
${JSON.stringify(bank, null, 2)}

TASK: For every section above (use its exact "id" string), choose up to ${maxBullets} of its own bullets that best match the job description, ordered most to least relevant. Never invent a bullet id or borrow one from a different section. If a section has bullets but none seem relevant, still return its most generally impressive bullets (a resume section shouldn't be left empty) — do not return fewer bullets than available up to the ${maxBullets} limit unless the section itself has fewer than ${maxBullets} bullets. For each chosen bullet, write a "why" field: a specific reason (12 words or fewer) tying it to something in the job description.

Respond with ONLY one JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "sections": [
    { "id": "<section id>", "bullets": [ { "id": "<bullet id>", "why": "<reason>" } ] }
  ]
}`;
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

function hydrateSections(
  sections: Section[],
  parsed: RankingResponseShape,
  maxBullets: number
): RankedSection[] {
  const modelSections = Array.isArray(parsed.sections) ? parsed.sections : [];

  return sections.map((section) => {
    const bulletsById = new Map<string, Bullet>(section.bullets.map((b) => [b.id, b]));
    const modelSection = modelSections.find((s) => s?.id === section.id);
    const picks = Array.isArray(modelSection?.bullets) ? modelSection.bullets : [];

    const seen = new Set<string>();
    const chosen: ScoredBullet[] = [];
    for (const pick of picks) {
      if (chosen.length >= maxBullets) break;
      const id = typeof pick?.id === "string" ? pick.id : undefined;
      if (!id || seen.has(id)) continue;
      const bullet = bulletsById.get(id);
      if (!bullet) continue;
      seen.add(id);
      chosen.push({
        ...bullet,
        reason: typeof pick.why === "string" ? pick.why : undefined,
        matchedKeywords: [],
      });
    }

    // Model gave nothing usable for this section — fall back to original
    // order so every non-empty section still shows something.
    if (chosen.length === 0 && section.bullets.length > 0) {
      for (const bullet of section.bullets.slice(0, maxBullets)) {
        chosen.push({ ...bullet, matchedKeywords: [] });
      }
    }

    return {
      id: section.id,
      kind: section.kind,
      label: section.label,
      dates: section.dates,
      totalBullets: section.bullets.length,
      shownBullets: chosen,
    };
  });
}

/** A multi-word gap phrase is "already covered" if every one of its
 * meaningful words shows up somewhere in the bank, even if not as that
 * exact phrase — e.g. "ROS2 and computer vision" when tags already have
 * both "ros2" and "computer-vision" individually. */
function isAlreadyCovered(phrase: string, bulletHaystack: string): boolean {
  const words = tokenize(phrase).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  if (words.length === 0) return termIncluded(bulletHaystack, phrase);
  return words.every((w) => termIncluded(bulletHaystack, w));
}

/** Hydrates the model's raw gap list, deduplicates, and — as a deterministic
 * safety net against small-model hallucination — drops anything that
 * actually already appears in the bullet bank (tags or text), regardless of
 * what the model claims. */
function hydrateGaps(parsed: GapsResponseShape, bulletHaystack: string): GapKeyword[] {
  const gaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];
  const seen = new Set<string>();
  const result: GapKeyword[] = [];
  for (const g of gaps) {
    if (typeof g !== "string") continue;
    const keyword = g.trim();
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    if (isAlreadyCovered(keyword, bulletHaystack)) continue; // already covered — not a real gap
    seen.add(key);
    result.push({ keyword });
    if (result.length >= 15) break;
  }
  return result;
}

export async function analyzeWithOllama(
  sections: Section[],
  jdText: string,
  maxBullets: number,
  options: { model: string; host?: string }
): Promise<AnalyzeResponse> {
  const host = (options.host || DEFAULT_HOST).replace(/\/+$/, "");

  const [rankingRaw, gapsRaw] = await Promise.all([
    callOllamaChat(host, options.model, buildRankingPrompt(sections, jdText, maxBullets)),
    callOllamaChat(host, options.model, buildGapsPrompt(sections, jdText)),
  ]);

  const rankingParsed = parseModelJson<RankingResponseShape>(rankingRaw);
  const gapsParsed = parseModelJson<GapsResponseShape>(gapsRaw);
  const bulletHaystack = buildBulletHaystack(sections);

  return {
    mode: "ollama",
    sections: hydrateSections(sections, rankingParsed, maxBullets),
    gaps: hydrateGaps(gapsParsed, bulletHaystack),
  };
}
