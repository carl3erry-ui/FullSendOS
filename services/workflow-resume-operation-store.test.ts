import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  ResumeOperationFenceError,
  advanceResumeOperation,
  assertResumeOperationOwner,
  claimResumeOperation,
  loadResumeOperation,
  releaseResumeOperationBeforeExecution,
} from "./workflow-resume-operation-store";
import { buildPauseState } from "./workflow-resume";
import { loadPauseState, markPauseResumedWithClaim, savePauseState } from "./workflow-pause-store";

const execFileAsync = promisify(execFile);
const operationDir = path.join(os.tmpdir(), `fullsendos-resume-operation-${process.pid}-${Date.now()}`);
process.env.WORKFLOW_RESUME_OPERATION_DIR_OVERRIDE = operationDir;

function claimInput(pauseId: string) {
  return {
    pauseId,
    projectId: `project-${pauseId}`,
    engagementId: `project-${pauseId}`,
    workflowRunId: `run-${pauseId}`,
    taskId: `task-${pauseId}`,
    actorId: "admin-operation-test",
  };
}

test.after(async () => {
  await fs.rm(operationDir, { recursive: true, force: true });
});

test("durable resume claim has one winner and retains operation evidence", async () => {
  const pauseId = `exclusive-${Date.now()}`;
  const [first, second] = await Promise.all([
    claimResumeOperation(claimInput(pauseId)),
    claimResumeOperation(claimInput(pauseId)),
  ]);

  assert.equal([first.ok, second.ok].filter(Boolean).length, 1);
  const operation = await loadResumeOperation(pauseId);
  assert.ok(operation);
  assert.equal(operation?.phase, "claimed");
  assert.equal(operation?.operationId, operation?.claimId);
});

test("claim-ID fencing rejects stale owner phase updates and release", async () => {
  const pauseId = `fencing-${Date.now()}`;
  const result = await claimResumeOperation(claimInput(pauseId));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  await assert.rejects(
    advanceResumeOperation({
      pauseId,
      claimId: "00000000-0000-4000-8000-000000000000",
      expectedPhase: "claimed",
      nextPhase: "execution_committed",
    }),
    (error: unknown) => error instanceof ResumeOperationFenceError && error.code === "claim_mismatch",
  );
  await assert.rejects(
    releaseResumeOperationBeforeExecution({
      pauseId,
      claimId: "00000000-0000-4000-8000-000000000000",
    }),
    (error: unknown) => error instanceof ResumeOperationFenceError && error.code === "claim_mismatch",
  );
  assert.equal((await loadResumeOperation(pauseId))?.claimId, result.operation.claimId);
});

test("operation cannot return to retryable state after execution commitment", async () => {
  const pauseId = `no-rollback-${Date.now()}`;
  const result = await claimResumeOperation(claimInput(pauseId));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  await advanceResumeOperation({
    pauseId,
    claimId: result.operation.claimId,
    expectedPhase: "claimed",
    nextPhase: "execution_committed",
  });
  await assert.rejects(
    releaseResumeOperationBeforeExecution({ pauseId, claimId: result.operation.claimId }),
    (error: unknown) => error instanceof ResumeOperationFenceError && error.code === "phase_mismatch",
  );
  assert.equal((await loadResumeOperation(pauseId))?.phase, "execution_committed");
});

test("pre-execution claim release removes only owned claimed operation", async () => {
  const pauseId = `safe-release-${Date.now()}`;
  const result = await claimResumeOperation(claimInput(pauseId));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  await releaseResumeOperationBeforeExecution({ pauseId, claimId: result.operation.claimId });
  assert.equal(await loadResumeOperation(pauseId), null);
  assert.equal((await claimResumeOperation(claimInput(pauseId))).ok, true);
});

test("separate Node processes contend on one filesystem claim with one winner", async () => {
  const pauseId = `cross-process-${Date.now()}`;
  const script = `
    import { claimResumeOperation } from './services/workflow-resume-operation-store.ts';
    const result = await claimResumeOperation(${JSON.stringify(claimInput(pauseId))});
    process.stdout.write(result.ok ? 'claimed' : 'conflict');
  `;
  const env = { ...process.env, WORKFLOW_RESUME_OPERATION_DIR_OVERRIDE: operationDir };

  const [first, second] = await Promise.all([
    execFileAsync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { cwd: process.cwd(), env }),
    execFileAsync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { cwd: process.cwd(), env }),
  ]);

  assert.deepEqual([first.stdout, second.stdout].sort(), ["claimed", "conflict"]);
  assert.equal((await loadResumeOperation(pauseId))?.phase, "claimed");
});

test("stale claim ID cannot finalize the public pause", async () => {
  const pauseId = `pause-finalize-fence-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId,
    workflowRunId: "run-finalize-fence",
    projectId: "project-finalize-fence",
    engagementId: "project-finalize-fence",
    stepId: "step-finalize-fence",
    agentTaskId: "task-finalize-fence",
  }));
  const result = await claimResumeOperation(claimInput(pauseId));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  await advanceResumeOperation({
    pauseId,
    claimId: result.operation.claimId,
    expectedPhase: "claimed",
    nextPhase: "execution_committed",
  });
  await advanceResumeOperation({
    pauseId,
    claimId: result.operation.claimId,
    expectedPhase: "execution_committed",
    nextPhase: "task_completed",
  });

  await assert.rejects(markPauseResumedWithClaim({
    id: pauseId,
    claimId: "00000000-0000-4000-8000-000000000000",
    resumedBy: "stale-owner",
  }));
  assert.equal((await loadPauseState(pauseId)).status, "waiting_for_approval");
  await fs.rm(path.resolve("data/workflow-pauses", `${pauseId}.json`), { force: true });
});

test("partial operation evidence remains an exclusive conflict", async () => {
  const pauseId = `partial-operation-${Date.now()}`;
  await fs.mkdir(operationDir, { recursive: true });
  await fs.writeFile(path.join(operationDir, `${pauseId}.json`), "{partial", "utf8");
  const result = await claimResumeOperation(claimInput(pauseId));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "already_claimed");
  assert.equal(result.operation, null);
});
