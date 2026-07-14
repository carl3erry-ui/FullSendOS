import { NextResponse } from "next/server";
import { z } from "zod";
import { skipHumanInputRequest } from "@/services/human-input-service";

const BodySchema = z.object({
  response: z.string().min(1),
  resolvedBy: z.string().min(1).default("system"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = BodySchema.parse(await request.json());
    const data = await skipHumanInputRequest(id, body.response, body.resolvedBy);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
