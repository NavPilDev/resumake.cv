import { moveManifest } from "@/lib/resumeFiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

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
    moveManifest(id, body.folderPath);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to move resume." },
      { status: 500 }
    );
  }
}
