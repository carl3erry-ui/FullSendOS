import { NextResponse } from "next/server";
import { createEmptyProject } from "../../../src/schemas/projectSchema.js";
import { listProjects, saveProject } from "../../../src/storage/projectStore.js";
import { loadClient } from "../../../src/storage/clientStore.js";
import { provisionSmartIntakeForProject } from "@/services/human-input-service";

type FieldValidationError = {
  path: string;
  message: string;
};

function toValidationError(message: string, fieldErrors: FieldValidationError[]) {
  return NextResponse.json({ error: message, fieldErrors }, { status: 422 });
}

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (payload?.clientId) {
      try {
        await loadClient(payload.clientId);
      } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
          return toValidationError("Engagement validation failed.", [{ path: "clientId", message: "Client not found." }]);
        }

        return toValidationError("Engagement validation failed.", [{ path: "clientId", message: "Invalid clientId." }]);
      }
    }

    const project = createEmptyProject(payload);
    await saveProject(project);

    const smartIntake = await provisionSmartIntakeForProject({
      clientId: project.clientId,
      engagementId: project.id,
      companyName: project.client.companyName,
      website: project.client.website,
      objective: project.brief.objective,
      requestedBy: payload?.requestedBy || payload?.clientId || "system",
    });

    if (smartIntake.requests.length > 0) {
      project.audit.warnings.push(
        ...smartIntake.requests.map((request) => request.prompt),
      );
      await saveProject(project);
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "issues" in error && Array.isArray(error.issues)) {
      const fieldErrors = error.issues.slice(0, 12).map((issue: { path?: unknown; message?: unknown }) => ({
        path: Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : "root",
        message: typeof issue.message === "string" ? issue.message : "Invalid value",
      }));
      return toValidationError("Engagement validation failed.", fieldErrors);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
