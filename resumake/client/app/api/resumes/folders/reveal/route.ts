import fs from "fs";
import { resolveSavedPath } from "@/lib/resumeFiles";
import { revealInFileBrowser } from "@/lib/revealInFolder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { folderPath?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.folderPath !== "string") {
    return Response.json({ error: "folderPath is required." }, { status: 400 });
  }

  try {
    const dir = resolveSavedPath(body.folderPath);
    if (!fs.existsSync(dir)) {
      return Response.json({ error: "Folder not found." }, { status: 404 });
    }
    revealInFileBrowser(dir, false);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to open folder." },
      { status: 500 }
    );
  }
}
