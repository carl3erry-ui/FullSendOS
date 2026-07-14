import { NextResponse } from "next/server";
import { z } from "zod";
import { answerHumanInputRequest } from "@/services/human-input-service";

const BodySchema = z.object({
  response: z.string().min(1),
  resolvedBy: z.string().min(1).default("system"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = BodySchema.parse(await request.json());
    const data = await answerHumanInputRequest(id, body.response, body.resolvedBy);
    return NextResponse.json({ data });
  } catch (error) {
    if (typeof error === "object" && error && "issues" in error && Array.isArray((error as { issues?: unknown[] }).issues)) {
      return NextResponse.json({ error: "Human input answer validation failed." }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
