import { buildResumeTex } from "@/lib/latexTemplate";
import { compileSavedResume, selectionToTemplateInput } from "@/lib/buildSavedResume";
import { loadExperience } from "@/lib/loadExperience";
import {
  listResumeTree,
  writeManifest,
  type ResumeCreateRequest,
  type ResumeManifest,
} from "@/lib/resumeFiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const tree = listResumeTree();
    return Response.json({ tree });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to list saved resumes." },
      { status: 500 }
    );
  }
}

function isValidCreateRequest(value: unknown): value is ResumeCreateRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ResumeCreateRequest>;
  return (
    typeof v.title === "string" &&
    v.title.trim().length > 0 &&
    typeof v.folderPath === "string" &&
    !!v.selection &&
    typeof v.selection === "object" &&
    !!v.textOverrides &&
    typeof v.textOverrides === "object" &&
    (v.rawLatexOverride === undefined || v.rawLatexOverride === null || typeof v.rawLatexOverride === "string")
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidCreateRequest(body)) {
    return Response.json(
      { error: "title, folderPath, selection, and textOverrides are required." },
      { status: 400 }
    );
  }

  try {
    const rawLatexOverride =
      typeof body.rawLatexOverride === "string" && body.rawLatexOverride.trim().length > 0
        ? body.rawLatexOverride
        : null;
    const experience = await loadExperience();
    const templateInput = selectionToTemplateInput(experience, body.selection, body.textOverrides, body.spacing);
    const tex = rawLatexOverride ?? buildResumeTex(templateInput);
    const id = crypto.randomUUID();
    const compileResult = await compileSavedResume(id, tex);

    const now = new Date().toISOString();
    const manifest: ResumeManifest = {
      id,
      title: body.title.trim(),
      createdAt: now,
      updatedAt: now,
      selection: body.selection,
      textOverrides: body.textOverrides,
      rawLatexOverride,
      spacing: body.spacing,
      lastCompile: { pagesUsed: compileResult.pages, compiledAt: now },
    };
    writeManifest(body.folderPath, manifest);

    return Response.json(manifest, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create resume." },
      { status: 500 }
    );
  }
}
