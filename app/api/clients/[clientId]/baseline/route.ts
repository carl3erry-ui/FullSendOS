import { NextResponse } from "next/server";
import { loadClient } from "@/src/storage/clientStore.js";
import {
  ensureClientBaseline,
  loadClientBaseline,
  upsertClientBaseline,
} from "@/services/client-baseline-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    const client = await loadClient(clientId);
    const baseline = await ensureClientBaseline(clientId, client.name);
    return NextResponse.json(baseline);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    await loadClient(clientId);
    const payload = await request.json();
    const baseline = await upsertClientBaseline(clientId, payload);
    return NextResponse.json(baseline);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (typeof error === "object" && error && "issues" in error && Array.isArray(error.issues)) {
      const fieldErrors = error.issues.slice(0, 24).map((issue: { path?: unknown; message?: unknown }) => ({
        path: Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : "root",
        message: typeof issue.message === "string" ? issue.message : "Invalid value",
      }));
      return NextResponse.json({ error: "Client baseline validation failed.", fieldErrors }, { status: 422 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const existing = await loadClientBaseline(clientId);
  if (!existing) {
    return PUT(request, { params: Promise.resolve({ clientId }) });
  }

  try {
    const payload = await request.json();
    const merged = {
      ...existing,
      ...payload,
      companyOverview: {
        ...existing.companyOverview,
        ...(payload?.companyOverview || {}),
      },
      businessModel: {
        ...existing.businessModel,
        ...(payload?.businessModel || {}),
      },
      customers: {
        ...existing.customers,
        ...(payload?.customers || {}),
      },
      goals: {
        ...existing.goals,
        ...(payload?.goals || {}),
      },
      competitors: {
        ...existing.competitors,
        ...(payload?.competitors || {}),
      },
      brandVoice: {
        ...existing.brandVoice,
        ...(payload?.brandVoice || {}),
      },
      operations: {
        ...existing.operations,
        ...(payload?.operations || {}),
      },
    };

    const baseline = await upsertClientBaseline(clientId, merged);
    return NextResponse.json(baseline);
  } catch (error) {
    if (typeof error === "object" && error && "issues" in error && Array.isArray(error.issues)) {
      const fieldErrors = error.issues.slice(0, 24).map((issue: { path?: unknown; message?: unknown }) => ({
        path: Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : "root",
        message: typeof issue.message === "string" ? issue.message : "Invalid value",
      }));
      return NextResponse.json({ error: "Client baseline validation failed.", fieldErrors }, { status: 422 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
