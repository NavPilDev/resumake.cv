import fs from "fs";
import path from "path";
import { loadManifest, resolveSavedBuildDir } from "@/lib/resumeFiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const manifest = loadManifest(id);
  if (!manifest) {
    return Response.json({ error: "Resume not found." }, { status: 404 });
  }

  const pdfPath = path.join(resolveSavedBuildDir(), "out", `${id}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    return Response.json({ error: "This resume has not been compiled yet." }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const buffer = fs.readFileSync(pdfPath);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${manifest.title.replace(/"/g, "")}.pdf"`,
    },
  });
}
