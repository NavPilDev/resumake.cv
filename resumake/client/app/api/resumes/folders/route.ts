import { createFolder } from "@/lib/resumeFiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { parentPath?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "name is required." }, { status: 400 });
  }

  try {
    createFolder(body.parentPath ?? "", body.name);
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "EEXIST") {
      return Response.json(
        { error: "A folder or file with that name already exists." },
        { status: 409 }
      );
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create folder." },
      { status: 500 }
    );
  }
}
