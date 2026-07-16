import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import type { ExperienceData } from "./types";

function resolveExperiencePath(): string {
  const cwdCandidate = path.join(process.cwd(), "experience.yaml");
  if (fs.existsSync(cwdCandidate)) return cwdCandidate;

  const parentCandidate = path.join(process.cwd(), "..", "experience.yaml");
  if (fs.existsSync(parentCandidate)) return parentCandidate;

  throw new Error(
    "Could not find experience.yaml (looked in the current working directory and its parent)."
  );
}

export function loadExperience(): ExperienceData {
  const filePath = resolveExperiencePath();
  const raw = fs.readFileSync(filePath, "utf8");
  return yaml.load(raw) as ExperienceData;
}
