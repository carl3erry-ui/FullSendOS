/**
 * GET /api/agents
 *
 * Return public-safe metadata for all enabled agents.
 * Excludes system prompts and internal implementation details.
 */

import { NextResponse } from "next/server";
import { getPublicWorkforceCatalog, globalAgentRegistry } from "@/agents";

export async function GET() {
  try {
    const metadata = globalAgentRegistry.listPublicMetadata();
    const workforce = getPublicWorkforceCatalog(globalAgentRegistry);
    return NextResponse.json({
      success: true,
      data: metadata,
      workforce,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
