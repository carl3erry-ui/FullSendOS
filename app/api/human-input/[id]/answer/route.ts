import { NextResponse } from "next/server";
import { z } from "zod";
import { answerHumanInputRequest, getHumanInputRequest } from "@/services/human-input-service";
import { requireAuthenticatedActor, recordAllow, recordDeny } from "@/lib/security/route-guards";
import { requireClientAccess, requireInternalAdmin } from "@/lib/security/authorization";
import { isSecurityRouteError, toSecurityErrorResponse } from "@/lib/security/security-response";

const BodySchema = z.object({
  response: z.string().min(1),
  resolvedBy: z.string().min(1).default("system"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor: Awaited<ReturnType<typeof requireAuthenticatedActor>> | null = null;
  const action = {
    action: "human_input_answer",
    resourceType: "human_input_request",
    resourceId: "unknown",
  };

  try {
    const resolvedParams = await params;
    action.resourceId = resolvedParams.id;
    const { id } = resolvedParams;

    actor = await requireAuthenticatedActor(request, action);
    const target = await getHumanInputRequest(id);

    if (target.clientId) {
      requireClientAccess(actor, target.clientId);
    } else {
      requireInternalAdmin(actor);
    }

    await recordAllow(actor, action, "authorized_for_human_input_answer");

    const body = BodySchema.parse(await request.json());
    const data = await answerHumanInputRequest(id, body.response, body.resolvedBy);
    return NextResponse.json({ data });
  } catch (error) {
    if (isSecurityRouteError(error)) {
      if (error.status !== 401) {
        await recordDeny(actor, action, error.reasonCode);
      }
      return toSecurityErrorResponse(error);
    }

    if (typeof error === "object" && error && "issues" in error && Array.isArray((error as { issues?: unknown[] }).issues)) {
      return NextResponse.json({ error: "Human input answer validation failed." }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
