/**
 * Step 5: Verify Existing Workflow Unchanged
 * 
 * Validates that the existing workflow system continues to work
 * as before, without agent step integration.
 */

import assert from "assert";
import { initializeWorkflow, startStage, completeStage } from "../services/workflow-engine.js";

// Test 1: Basic workflow initialization
function testBasicInitialization() {
  const project = {
    id: "test-1",
    title: "Test",
    status: "active",
  };

  const workflow = initializeWorkflow(project);
  assert.ok(workflow.initializedAt, "Should initialize timestamp");
  assert.equal(workflow.currentStageId, "intelligence", "Should start at intelligence");
  assert.equal(workflow.stages.length, 4, "Should have 4 stages");
  console.log("✓ Basic initialization works");
}

// Test 2: Stage progression
function testStageProgression() {
  const project = { id: "test-2", title: "Test", status: "active" };
  let workflow = initializeWorkflow(project);

  // Move through each stage
  workflow = startStage(workflow, "intelligence");
  assert.equal(workflow.currentStageId, "intelligence");

  workflow = completeStage(workflow, "intelligence", {
    completed: true,
    findings: "test",
  });
  assert.ok(workflow.stageResults["intelligence"], "Should have stage results");

  workflow = startStage(workflow, "strategy");
  assert.equal(workflow.currentStageId, "strategy");

  console.log("✓ Stage progression works");
}

// Test 3: Workflow state structure preserved
function testStateStructure() {
  const project = { id: "test-3", title: "Test", status: "active" };
  const workflow = initializeWorkflow(project);

  // Verify shape unchanged
  assert.ok(workflow.initializedAt);
  assert.ok(workflow.stages);
  assert.ok(workflow.stageResults);
  assert.ok(workflow.currentStageId);

  console.log("✓ Workflow state structure preserved");
}

// Test 4: Audit trail independent from workflow
function testAuditIndependence() {
  const project = {
    id: "test-4",
    title: "Test",
    status: "active",
    audit: {
      activeRun: { id: "run-1", startedAt: new Date().toISOString() },
      runs: [],
      warnings: [],
    },
  };

  const workflow = initializeWorkflow(project);
  
  // Verify workflow doesn't touch audit
  assert.ok(project.audit, "Should preserve audit");
  assert.ok(project.audit.activeRun, "Should preserve activeRun");
  assert.ok(Array.isArray(project.audit.runs), "Should preserve runs array");

  console.log("✓ Audit trail independence maintained");
}

export function runWorkflowCompatibilityTests() {
  console.log("\n📋 Verifying Existing Workflow System Unchanged (Step 5)");
  console.log("══════════════════════════════════════════════════════");

  testBasicInitialization();
  testStageProgression();
  testStateStructure();
  testAuditIndependence();

  console.log("\n✅ All workflow compatibility tests passed!");
  console.log(
    "   Existing department workflow continues working unchanged"
  );
}
