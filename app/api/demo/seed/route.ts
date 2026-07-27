import { NextResponse } from "next/server";
import { seedDemoWorkspace } from "@/services/demo-workspace";
import { requireAuthenticatedActor, recordAllow, recordDeny } from "@/lib/security/route-guards";
import { requireInternalAdmin } from "@/lib/security/authorization";
import { isSecurityRouteError, toSecurityErrorResponse } from "@/lib/security/security-response";

export async function POST(request: Request): Promise<NextResponse> {
  const action = {
    action: "demo_workspace_seed",
    resourceType: "demo_workspace",
    resourceId: "seed",
  };

  let actor: Awaited<ReturnType<typeof requireAuthenticatedActor>> | null = null;

  try {
    actor = await requireAuthenticatedActor(request, action);
    requireInternalAdmin(actor);
    await recordAllow(actor, action, "internal_admin_granted");

    const result = await seedDemoWorkspace();
    return NextResponse.json({
      success: true,
      clientId: result.clientId,
      engagementId: result.engagementId,
      alreadyExists: result.alreadyExists,
    });
  } catch (error) {
    if (isSecurityRouteError(error)) {
      if (error.status !== 401) {
        await recordDeny(actor, action, error.reasonCode);
      }
      return toSecurityErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : "Failed to seed demo workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
