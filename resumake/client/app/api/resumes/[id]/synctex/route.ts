import fs from "fs";
import path from "path";
import { loadManifest, resolveSavedBuildDir } from "@/lib/resumeFiles";
import { resolveAnchorForLine, runSynctexEdit } from "@/lib/synctex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Inverse-SyncTeX lookup for the "My Resumes" double-click-to-edit feature:
 * given a point the custom pdf.js preview was double-clicked at (1-based
 * page, x/y in PDF big points from the page's top-left corner), resolves
 * which section/entry/bullet produced that spot so the frontend can jump
 * the Form or LaTeX view there. Returns `{ anchor: null }` (not an error)
 * when SyncTeX can't resolve the point or no anchor comment precedes it —
 * e.g. a click on whitespace, or a hand-edited rawLatexOverride with no
 * anchors at all. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const manifest = loadManifest(id);
  if (!manifest) {
    return Response.json({ error: "Resume not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page"));
  const x = Number(url.searchParams.get("x"));
  const y = Number(url.searchParams.get("y"));
  if (!Number.isFinite(page) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return Response.json({ error: "page, x, and y query params are required numbers." }, { status: 400 });
  }

  const buildDir = resolveSavedBuildDir();
  const pdfPath = path.join(buildDir, "out", `${id}.pdf`);
  const texPath = path.join(buildDir, `${id}.tex`);
  if (!fs.existsSync(pdfPath) || !fs.existsSync(texPath)) {
    return Response.json({ error: "This resume has not been compiled yet." }, { status: 404 });
  }

  const result = await runSynctexEdit(pdfPath, page, x, y);
  if (!result) {
    return Response.json({ anchor: null, line: null });
  }

  const texContent = fs.readFileSync(texPath, "utf8");
  const anchor = resolveAnchorForLine(texContent, result.line);
  return Response.json({ anchor, line: result.line });
}
