import { NextResponse } from "next/server";
import { seedDemoWorkspace } from "@/services/demo-workspace";

export async function POST(): Promise<NextResponse> {
  try {
    const result = await seedDemoWorkspace();
    return NextResponse.json({
      success: true,
      clientId: result.clientId,
      engagementId: result.engagementId,
      alreadyExists: result.alreadyExists,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to seed demo workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
