import { buildResumeTex } from "@/lib/latexTemplate";
import { compileSavedResume, selectionToTemplateInput } from "@/lib/buildSavedResume";
import { loadExperience } from "@/lib/loadExperience";
import {
  findManifestPath,
  loadManifest,
  overwriteManifestAtPath,
  type ResumeManifest,
  type ResumeUpdateRequest,
} from "@/lib/resumeFiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const manifest = loadManifest(id);
  if (!manifest) {
    return Response.json({ error: "Resume not found." }, { status: 404 });
  }
  return Response.json(manifest);
}

function isValidUpdateRequest(value: unknown): value is ResumeUpdateRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ResumeUpdateRequest>;
  return (
    !!v.selection &&
    typeof v.selection === "object" &&
    !!v.textOverrides &&
    typeof v.textOverrides === "object" &&
    (v.rawLatexOverride === undefined || v.rawLatexOverride === null || typeof v.rawLatexOverride === "string")
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidUpdateRequest(body)) {
    return Response.json({ error: "selection and textOverrides are required." }, { status: 400 });
  }

  const manifestPath = findManifestPath(id);
  if (!manifestPath) {
    return Response.json({ error: "Resume not found." }, { status: 404 });
  }

  try {
    const rawLatexOverride =
      typeof body.rawLatexOverride === "string" && body.rawLatexOverride.trim().length > 0
        ? body.rawLatexOverride
        : null;
    const existing = loadManifest(id);
    const experience = await loadExperience();
    const templateInput = selectionToTemplateInput(experience, body.selection, body.textOverrides);
    const tex = rawLatexOverride ?? buildResumeTex(templateInput);
    const compileResult = await compileSavedResume(id, tex);

    const now = new Date().toISOString();
    const manifest: ResumeManifest = {
      id,
      title: body.title?.trim() || existing?.title || "Untitled resume",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      selection: body.selection,
      textOverrides: body.textOverrides,
      rawLatexOverride,
      lastCompile: { pagesUsed: compileResult.pages, compiledAt: now },
    };
    overwriteManifestAtPath(manifestPath, manifest);

    return Response.json(manifest);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to save resume." },
      { status: 500 }
    );
  }
}
