import { NextResponse } from "next/server";
import { DeepgramClient } from "@deepgram/sdk";

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY is not configured" },
      { status: 500 },
    );
  }

  try {
    const client = new DeepgramClient({ apiKey });

    const projectId = await getProjectId(client);
    const keyResponse = await client.manage.v1.projects.keys.create(
      projectId,
      {
        comment: "temporary browser key",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 10,
      },
    );

    return NextResponse.json({ key: keyResponse.key });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to create temporary Deepgram key:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getProjectId(client: DeepgramClient) {
  const projectsResponse = await client.manage.v1.projects.list();
  const project = projectsResponse.projects?.[0];
  if (!project?.project_id) throw new Error("No Deepgram projects found");
  return project.project_id;
}
