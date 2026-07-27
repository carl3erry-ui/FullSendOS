import { NextResponse } from "next/server";
import { z } from "zod";
import { skipHumanInputRequest, getHumanInputRequest } from "@/services/human-input-service";
import { requireAuthenticatedActor, recordAllow, recordDeny } from "@/lib/security/route-guards";
import { requireHumanInputMutationAccess } from "@/lib/security/human-input-authorization";
import { concealedNotFound, isSecurityRouteError, toSecurityErrorResponse } from "@/lib/security/security-response";

const BodySchema = z.object({
  response: z.string().min(1),
  resolvedBy: z.string().min(1).default("system"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor: Awaited<ReturnType<typeof requireAuthenticatedActor>> | null = null;
  const action = {
    action: "human_input_skip",
    resourceType: "human_input_request",
    resourceId: "unknown",
  };

  try {
    const { id } = await params;
    action.resourceId = id;
    actor = await requireAuthenticatedActor(request, action);

    let target;
    try {
      target = await getHumanInputRequest(id);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        concealedNotFound("human_input_request_not_found");
      }
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
        concealedNotFound("human_input_request_not_found");
      }
      throw error;
    }

    requireHumanInputMutationAccess(actor, target);

    const body = BodySchema.parse(await request.json());

    const data = await skipHumanInputRequest(id, body.response, body.resolvedBy);
    await recordAllow(actor, action, "human_input_skipped");
    return NextResponse.json({ data });
  } catch (error) {
    if (isSecurityRouteError(error)) {
      if (error.status !== 401) {
        await recordDeny(actor, action, error.reasonCode);
      }
      return toSecurityErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
