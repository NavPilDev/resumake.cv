import fs from "fs";
import path from "path";
import { loadManifest, resolveSavedBuildDir } from "@/lib/resumeFiles";

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

  const texPath = path.join(resolveSavedBuildDir(), `${id}.tex`);
  if (!fs.existsSync(texPath)) {
    return Response.json({ error: "This resume has not been compiled yet." }, { status: 404 });
  }

  const buffer = fs.readFileSync(texPath);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "text/x-tex; charset=utf-8",
      "Content-Disposition": `attachment; filename="${manifest.title.replace(/"/g, "")}.tex"`,
    },
  });
}
