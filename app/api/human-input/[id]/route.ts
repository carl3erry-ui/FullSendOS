import { NextResponse } from "next/server";
import { getHumanInputRequest, updateHumanInputRequest } from "@/services/human-input-service";
import { HumanInputRequestUpdateSchema } from "@/schemas/human-input";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getHumanInputRequest(id);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const parsed = HumanInputRequestUpdateSchema.parse(payload);
    const data = await updateHumanInputRequest(id, parsed);
    return NextResponse.json({ data });
  } catch (error) {
    if (typeof error === "object" && error && "issues" in error && Array.isArray((error as { issues?: unknown[] }).issues)) {
      return NextResponse.json({ error: "Human input request validation failed." }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
