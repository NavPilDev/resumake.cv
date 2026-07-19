const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  ai_ml_and_robotics: "AI/ML & Robotics",
};

/** Turns a stored category key (e.g. "frameworks_and_tools") into a display
 * label (e.g. "Frameworks & Tools") for the experience-input UI. Mirrors
 * latexTemplate.ts's own humanizeCategory, which needs a LaTeX-escaped "\&"
 * instead of a plain one and so isn't reused directly here. */
export function humanizeSkillCategory(key: string): string {
  if (CATEGORY_LABEL_OVERRIDES[key]) return CATEGORY_LABEL_OVERRIDES[key];
  return key
    .split("_")
    .map((w) => (w === "and" ? "&" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Turns a user-typed category name (e.g. "Frameworks & Tools") into the
 * snake_case key experience.yaml's technical_skills map uses, so hand-added
 * categories are stored the same way as ones already in the file. */
export function slugifySkillCategory(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
