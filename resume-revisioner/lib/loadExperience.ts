import fs from "fs";
import yaml from "js-yaml";
import { resolveRepoPath } from "./repoPaths";
import type { ExperienceData } from "./types";

export function loadExperience(): ExperienceData {
  const filePath = resolveRepoPath("experience.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  return yaml.load(raw) as ExperienceData;
}
