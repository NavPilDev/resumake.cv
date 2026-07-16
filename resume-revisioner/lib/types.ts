export interface Bullet {
  id: string;
  text: string;
  tags: string[];
  has_metric: boolean;
}

export interface JobEntry {
  company: string;
  role: string;
  dates: string;
  date_confidence: string;
  location?: string;
  bullets: Bullet[];
}

export interface ProjectLink {
  name: string;
  href: string;
}

export interface ProjectEntry {
  name: string;
  dates: string;
  date_confidence: string;
  links?: ProjectLink[];
  bullets: Bullet[];
}

export interface EducationEntry {
  institution: string;
  credential: string;
  dates: string;
  date_confidence: string;
  location?: string;
  details?: string[];
  links?: ProjectLink[];
}

export interface TechnicalSkillEntry {
  skill: string;
  source: string;
}

export interface TechnicalSkills {
  [category: string]: TechnicalSkillEntry[];
}

export interface ExperienceData {
  meta: {
    name: string;
    email: string;
    linkedin: string;
    github: string;
    website: string;
  };
  jobs: JobEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  technical_skills: TechnicalSkills;
}

export interface Section {
  id: string;
  kind: "job" | "project";
  label: string;
  dates: string;
  bullets: Bullet[];
  /** Job-only, for the resume subheading's right-aligned location column. */
  location?: string;
  /** Split out from `label` for jobs so the LaTeX generator can lay out
   * company/role in separate table cells instead of re-parsing the string. */
  company?: string;
  role?: string;
  /** Project-only. */
  links?: ProjectLink[];
}

export interface ScoredBullet extends Bullet {
  /** 0-100 relevance score, always present in both modes. Keyword mode
   * normalizes its raw overlap count against the best bullet in the run;
   * Ollama mode asks the model directly for a 0-100 judgment. */
  score: number;
  /** Keyword-mode matched terms. Empty/absent in Ollama mode. */
  matchedKeywords?: string[];
  /** Ollama mode's justification for the score — more specific for low scores. Absent in keyword mode. */
  reason?: string;
}

export interface RankedSection {
  id: string;
  kind: "job" | "project";
  label: string;
  dates: string;
  location?: string;
  company?: string;
  role?: string;
  links?: ProjectLink[];
  totalBullets: number;
  shownBullets: ScoredBullet[];
}

export interface GapKeyword {
  keyword: string;
  /** Occurrence count in the JD. Absent for Ollama-sourced gaps. */
  frequency?: number;
}

export type AnalyzeMode = "keyword" | "ollama";

export interface AnalyzeResponse {
  mode: AnalyzeMode;
  sections: RankedSection[];
  gaps: GapKeyword[];
  /** Ollama-only short fit/strengths/gaps summary paragraph. */
  overview?: string;
  /** Non-fatal pipeline step failures (e.g. the gaps or overview call errored) — surfaced so a failure isn't mistaken for a clean result. */
  warnings?: string[];
}

export interface AnalyzeRequest {
  jdText: string;
  maxBullets: number;
  mode?: AnalyzeMode;
  ollamaModel?: string;
  ollamaHost?: string;
}

/** NDJSON progress events streamed by /api/analyze while mode=ollama. */
export type AnalyzeProgressEvent =
  | { type: "progress"; stage: "scoring" | "gaps" | "overview"; current?: number; total?: number; label?: string }
  | { type: "result"; data: AnalyzeResponse }
  | { type: "error"; message: string };

export interface GenerateResumeSectionInput {
  id: string;
  kind: "job" | "project";
  company?: string;
  role?: string;
  location?: string;
  /** Project name (kind="project"); ignored for jobs, which use company/role instead. */
  label: string;
  dates: string;
  links?: ProjectLink[];
  /** Final bullet text (post-override), best-first, already trimmed to the analysis's max-bullets-per-role setting. */
  bullets: { id: string; text: string; score: number }[];
}

export interface GenerateResumeRequest {
  filename: string;
  maxJobs: number;
  maxProjects: number;
  maxPages: number;
  sections: GenerateResumeSectionInput[];
  /** Set after the user has seen a "this file already exists" 409 and chosen to proceed anyway. */
  confirmOverwrite?: boolean;
}

export interface GenerateResumeResponse {
  texPath: string;
  pdfPath?: string;
  pagesUsed: number | null;
  trimmedItems: string[];
  warnings?: string[];
}

export interface ImproveRequest {
  bulletText: string;
  tags: string[];
  jdText: string;
  ollamaModel?: string;
  ollamaHost?: string;
}

export interface ImproveResponse {
  improvedText: string;
}
