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
}

export interface Section {
  id: string;
  kind: "job" | "project";
  label: string;
  dates: string;
  bullets: Bullet[];
}

export interface ScoredBullet extends Bullet {
  /** Keyword-mode overlap score. Absent in Ollama mode (rank order matters, not the number). */
  score?: number;
  /** Keyword-mode matched terms. Empty/absent in Ollama mode. */
  matchedKeywords?: string[];
  /** Ollama mode's one-line justification for picking this bullet. Absent in keyword mode. */
  reason?: string;
}

export interface RankedSection {
  id: string;
  kind: "job" | "project";
  label: string;
  dates: string;
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
}

export interface AnalyzeRequest {
  jdText: string;
  maxBullets: number;
  mode?: AnalyzeMode;
  ollamaModel?: string;
  ollamaHost?: string;
}
