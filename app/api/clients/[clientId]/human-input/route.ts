import { NextResponse } from "next/server";
import { listHumanInputRequests } from "@/services/human-input-service";

export async function GET(_request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await params;
    const data = await listHumanInputRequests({ clientId });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
