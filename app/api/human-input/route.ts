import { NextResponse } from "next/server";
import { z } from "zod";
import { HumanInputRequestCreateSchema, HumanInputRequestUpdateSchema } from "@/schemas/human-input";
import { createHumanInputRequest, listHumanInputRequests, updateHumanInputRequest } from "@/services/human-input-service";

const ListQuerySchema = z.object({
  clientId: z.string().optional(),
  engagementId: z.string().optional(),
  workflowRunId: z.string().optional(),
  agentTaskId: z.string().optional(),
  status: z.enum(["open", "answered", "confirmed", "rejected", "skipped", "cancelled"]).optional(),
  openOnly: z.boolean().optional(),
  blockingOnly: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = ListQuerySchema.parse({
      clientId: searchParams.get("clientId") || undefined,
      engagementId: searchParams.get("engagementId") || undefined,
      workflowRunId: searchParams.get("workflowRunId") || undefined,
      agentTaskId: searchParams.get("agentTaskId") || undefined,
      status: (searchParams.get("status") as any) || undefined,
      openOnly: searchParams.get("openOnly") === "true" ? true : undefined,
      blockingOnly: searchParams.get("blockingOnly") === "true" ? true : undefined,
    });

    const data = await listHumanInputRequests({
      clientId: query.clientId,
      engagementId: query.engagementId,
      workflowRunId: query.workflowRunId,
      agentTaskId: query.agentTaskId,
      status: query.status,
      openOnly: query.openOnly,
      blockingOnly: query.blockingOnly,
    });

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = HumanInputRequestCreateSchema.parse(payload);
    const requestRecord = await createHumanInputRequest(parsed);
    return NextResponse.json({ data: requestRecord }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "issues" in error && Array.isArray((error as { issues?: unknown[] }).issues)) {
      return NextResponse.json({ error: "Human input request validation failed." }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json();
    const { id, ...updates } = payload || {};
    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "id is required." }, { status: 422 });
    }
    const parsed = HumanInputRequestUpdateSchema.parse(updates);
    const requestRecord = await updateHumanInputRequest(id, parsed);
    return NextResponse.json({ data: requestRecord });
  } catch (error) {
    if (typeof error === "object" && error && "issues" in error && Array.isArray((error as { issues?: unknown[] }).issues)) {
      return NextResponse.json({ error: "Human input request validation failed." }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
