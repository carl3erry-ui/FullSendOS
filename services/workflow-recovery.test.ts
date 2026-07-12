import assert from "node:assert/strict";
import test from "node:test";
import {
  createPollController,
  hasRunningProjects,
  resolveRunTimeoutMessage,
  shouldStopPolling,
} from "../app/components/workflow-recovery";

test("hasRunningProjects identifies active runs and terminal stop condition", () => {
  const running = [{ id: "1", status: "running" }];
  const terminal = [{ id: "1", status: "needs-review" }];

  assert.equal(hasRunningProjects(running), true);
  assert.equal(shouldStopPolling(running), false);
  assert.equal(hasRunningProjects(terminal), false);
  assert.equal(shouldStopPolling(terminal), true);
});

test("resolveRunTimeoutMessage supports timeout recovery behavior", () => {
  assert.equal(
    resolveRunTimeoutMessage({ id: "1", status: "running", lastRunError: null }),
    null,
  );

  assert.equal(
    resolveRunTimeoutMessage({ id: "1", status: "failed", lastRunError: "Workflow validation failed." }),
    "Workflow validation failed.",
  );

  assert.equal(
    resolveRunTimeoutMessage(null),
    "Workflow request timed out and project state could not be recovered.",
  );
});

test("poll controller avoids overlap and stops updates after unmount cleanup", async () => {
  let calls = 0;
  let release: (() => void) | null = null;

  const refresh = async () => {
    calls += 1;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  };

  const controller = createPollController(refresh);

  const first = controller.tick();
  const second = controller.tick();
  assert.equal(await second, false);

  release?.();
  assert.equal(await first, true);
  assert.equal(calls, 1);

  controller.stop();
  assert.equal(controller.isStopped(), true);
  assert.equal(await controller.tick(), false);
  assert.equal(calls, 1);
});
