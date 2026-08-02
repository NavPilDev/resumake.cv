import { findManifestPath } from "@/lib/resumeFiles";
import { revealInFileBrowser } from "@/lib/revealInFolder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const manifestPath = findManifestPath(id);
  if (!manifestPath) {
    return Response.json({ error: "Resume not found." }, { status: 404 });
  }
  revealInFileBrowser(manifestPath, true);
  return Response.json({ ok: true });
}
