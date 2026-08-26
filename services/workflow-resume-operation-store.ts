import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const ResumeOperationPhaseSchema = z.enum([
  "claimed",
  "execution_committed",
  "task_completed",
  "pause_finalized",
  "continuation_committed",
  "completed",
  "failed",
  "recovery_required",
]);

export type ResumeOperationPhase = z.infer<typeof ResumeOperationPhaseSchema>;

export const WorkflowResumeOperationSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  operationId: z.string().uuid(),
  claimId: z.string().uuid(),
  pauseId: z.string().min(1),
  projectId: z.string().min(1),
  engagementId: z.string().min(1),
  workflowRunId: z.string().min(1),
  taskId: z.string().min(1),
  actorId: z.string().min(1),
  actorRole: z.literal("internal_admin"),
  phase: ResumeOperationPhaseSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  executionId: z.string().optional(),
  failureCode: z.string().min(1).optional(),
});

export type WorkflowResumeOperation = z.infer<typeof WorkflowResumeOperationSchema>;

export type ResumeOperationClaimResult =
  | { ok: true; operation: WorkflowResumeOperation }
  | { ok: false; code: "already_claimed"; operation: WorkflowResumeOperation | null };

export class ResumeOperationFenceError extends Error {
  readonly code: "claim_mismatch" | "phase_mismatch" | "operation_not_found";

  constructor(code: ResumeOperationFenceError["code"]) {
    super(code);
    this.code = code;
  }
}

function operationDirectory(): string {
  // ADR-004: Alpha permits this filesystem fence only with one serving instance
  // and persistent durable state. This is not multi-instance coordination.
  return process.env.WORKFLOW_RESUME_OPERATION_DIR_OVERRIDE
    ? path.resolve(process.env.WORKFLOW_RESUME_OPERATION_DIR_OVERRIDE)
    : path.resolve(process.cwd(), "data", "workflow-resume-operations");
}

function sanitizeId(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error("Invalid workflow resume operation resource ID.");
  }
  return id;
}

function operationPath(pauseId: string): string {
  return new URL(`${sanitizeId(pauseId)}.json`, `file://${operationDirectory()}/`).pathname;
}

const openFile = fs.open.bind(fs);

async function syncDirectory(directory: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    handle = await fs.open(directory, "r");
    await handle.sync();
  } catch {
    // Some filesystems do not support directory fsync. File fsync still applies.
  } finally {
    await handle?.close();
  }
}

async function writeExclusive(file: string, operation: WorkflowResumeOperation): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const handle = await fs.open(file, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(operation, null, 2), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(path.dirname(file));
}

async function atomicReplace(file: string, operation: WorkflowResumeOperation): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp-${process.pid}-${randomUUID()}`;
  const handle = await fs.open(tempFile, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(operation, null, 2), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tempFile, file);
  await syncDirectory(path.dirname(file));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

export async function loadResumeOperation(pauseId: string): Promise<WorkflowResumeOperation | null> {
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    handle = await openFile(operationPath(pauseId), "r");
    const raw = await handle.readFile("utf8");
    return WorkflowResumeOperationSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw error;
  } finally {
    await handle?.close();
  }
}

export async function claimResumeOperation(input: {
  pauseId: string;
  projectId: string;
  engagementId: string;
  workflowRunId: string;
  taskId: string;
  actorId: string;
}): Promise<ResumeOperationClaimResult> {
  const now = new Date().toISOString();
  const claimId = randomUUID();
  const operation = WorkflowResumeOperationSchema.parse({
    schemaVersion: "1.0.0",
    operationId: claimId,
    claimId,
    pauseId: input.pauseId,
    projectId: input.projectId,
    engagementId: input.engagementId,
    workflowRunId: input.workflowRunId,
    taskId: input.taskId,
    actorId: input.actorId,
    actorRole: "internal_admin",
    phase: "claimed",
    createdAt: now,
    updatedAt: now,
  });

  try {
    await writeExclusive(operationPath(input.pauseId), operation);
    return { ok: true, operation };
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      let existing: WorkflowResumeOperation | null = null;
      try {
        existing = await loadResumeOperation(input.pauseId);
      } catch {
        // Corrupt or partial operation evidence still fences replay and requires recovery.
      }
      return { ok: false, code: "already_claimed", operation: existing };
    }
    throw error;
  }
}

export async function advanceResumeOperation(input: {
  pauseId: string;
  claimId: string;
  expectedPhase: ResumeOperationPhase | ResumeOperationPhase[];
  nextPhase: ResumeOperationPhase;
  executionId?: string;
  failureCode?: string;
}): Promise<WorkflowResumeOperation> {
  const current = await loadResumeOperation(input.pauseId);
  if (!current) throw new ResumeOperationFenceError("operation_not_found");
  if (current.claimId !== input.claimId) throw new ResumeOperationFenceError("claim_mismatch");

  const expected = Array.isArray(input.expectedPhase) ? input.expectedPhase : [input.expectedPhase];
  if (!expected.includes(current.phase)) throw new ResumeOperationFenceError("phase_mismatch");

  const updated = WorkflowResumeOperationSchema.parse({
    ...current,
    phase: input.nextPhase,
    updatedAt: new Date().toISOString(),
    ...(input.executionId && { executionId: input.executionId }),
    ...(input.failureCode && { failureCode: input.failureCode }),
  });
  await atomicReplace(operationPath(input.pauseId), updated);
  return updated;
}

export async function assertResumeOperationOwner(input: {
  pauseId: string;
  claimId: string;
  expectedPhase?: ResumeOperationPhase | ResumeOperationPhase[];
}): Promise<WorkflowResumeOperation> {
  const current = await loadResumeOperation(input.pauseId);
  if (!current) throw new ResumeOperationFenceError("operation_not_found");
  if (current.claimId !== input.claimId) throw new ResumeOperationFenceError("claim_mismatch");
  if (input.expectedPhase) {
    const expected = Array.isArray(input.expectedPhase) ? input.expectedPhase : [input.expectedPhase];
    if (!expected.includes(current.phase)) throw new ResumeOperationFenceError("phase_mismatch");
  }
  return current;
}

export async function releaseResumeOperationBeforeExecution(input: {
  pauseId: string;
  claimId: string;
}): Promise<void> {
  const current = await assertResumeOperationOwner({
    pauseId: input.pauseId,
    claimId: input.claimId,
    expectedPhase: "claimed",
  });
  if (current.executionId) throw new ResumeOperationFenceError("phase_mismatch");
  await fs.rm(operationPath(input.pauseId));
  await syncDirectory(operationDirectory());
}

export async function markResumeOperationRecoveryRequired(input: {
  pauseId: string;
  claimId: string;
  expectedPhase: ResumeOperationPhase | ResumeOperationPhase[];
  failureCode: string;
}): Promise<WorkflowResumeOperation> {
  return advanceResumeOperation({
    pauseId: input.pauseId,
    claimId: input.claimId,
    expectedPhase: input.expectedPhase,
    nextPhase: "recovery_required",
    failureCode: input.failureCode,
  });
}
