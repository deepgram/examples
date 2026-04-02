import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

// Returns a short-lived Deepgram API key so the browser can open a
// WebSocket to Deepgram directly.  This avoids exposing the main key
// in client-side code.  The temporary key expires after 10 seconds —
// long enough to establish a connection but useless if leaked later.
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY is not configured" },
      { status: 500 },
    );
  }

  try {
    const client = createClient(apiKey);

    // ← createKey() mints a temporary key scoped to the project
    const { result } = await client.keys.createKey(
      // Use the key's own project — pass a dummy project id; the SDK
      // will derive it from the API key automatically when using v1.
      // For the temporary key approach we use manage.getProjects first.
      await getProjectId(client),
      {
        comment: "temporary browser key",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 10,
      },
    );

    return NextResponse.json({ key: result.key });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to create temporary Deepgram key:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getProjectId(client: ReturnType<typeof createClient>) {
  const { result } = await client.manage.getProjects();
  const project = result.projects[0];
  if (!project) throw new Error("No Deepgram projects found");
  return project.project_id;
}
