import assert from "node:assert/strict";
import test from "node:test";

// Domain types
import {
  AgentDefinitionSchema,
  AgentTaskSchema,
  AgentExecutionSchema,
  ApprovalGateSchema,
  AgentEvidenceSchema,
} from "../agents/types";

// Output schemas
import {
  OrchestratorOutputSchema,
  ResearchOutputSchema,
  QualityControlOutputSchema,
} from "../agents/output-schemas";

// Registry
import { AgentRegistry } from "../agents/registry";
import { AIProviderRegistry } from "../ai/provider-registry";

// Agent definitions
import { orchestratorDefinition } from "../agents/definitions/orchestrator";
import { researcherDefinition } from "../agents/definitions/researcher";
import { qualityControlDefinition } from "../agents/definitions/quality-control";

// Providers
import { createMockProvider } from "../ai/mock-provider";
import { createXAIProvider } from "../ai/xai-provider";

// registerAllAgents helper
import { registerAllAgents } from "../agents/index";

// ---------------------------------------------------------------------------
// 1. Agent definition validation
// ---------------------------------------------------------------------------

test("AgentDefinitionSchema accepts a valid agent definition", () => {
  const result = AgentDefinitionSchema.safeParse({
    id: "test-agent",
    name: "Test Agent",
    description: "A test agent",
    role: "tester",
    version: "1.0.0",
    capabilities: ["read"],
    allowedTools: ["read_project"],
    defaultProvider: "mock",
    defaultModel: "mock-1.0",
    systemPrompt: "You are a test agent.",
    requiresApproval: false,
    maximumIterations: 3,
    timeoutMs: 30000,
    enabled: true,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("AgentDefinitionSchema rejects missing required fields", () => {
  const result = AgentDefinitionSchema.safeParse({ id: "x" });
  assert.equal(result.success, false);
});

test("AgentDefinitionSchema rejects unknown defaultProvider value", () => {
  const result = AgentDefinitionSchema.safeParse({
    id: "bad-provider-agent",
    name: "Bad Provider",
    description: "",
    role: "tester",
    version: "1.0.0",
    capabilities: [],
    allowedTools: [],
    defaultProvider: "openai", // not in enum
    defaultModel: "gpt-4",
    systemPrompt: "...",
    requiresApproval: false,
    maximumIterations: 1,
    timeoutMs: 5000,
    enabled: true,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// 2. AgentTask schema validation
// ---------------------------------------------------------------------------

test("AgentTaskSchema accepts a minimal valid task", () => {
  const result = AgentTaskSchema.safeParse({
    id: "task-001",
    agentId: "orchestrator",
    title: "Plan engagement",
    objective: "Produce an execution plan",
    status: "queued",
    provider: "mock",
    model: "mock-1.0",
    approvalStatus: "not_required",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("AgentTaskSchema accepts nullable parent entity references", () => {
  const result = AgentTaskSchema.safeParse({
    id: "task-002",
    projectId: null,
    engagementId: null,
    workflowRunId: null,
    departmentId: null,
    agentId: "researcher",
    title: "Standalone research",
    objective: "Research market trends",
    status: "queued",
    provider: "mock",
    model: "mock-1.0",
    approvalStatus: "not_required",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("AgentTaskSchema rejects invalid status value", () => {
  const result = AgentTaskSchema.safeParse({
    id: "task-003",
    agentId: "orchestrator",
    title: "Bad task",
    objective: "Test",
    status: "in-flight", // not in enum
    provider: "mock",
    model: "mock-1.0",
    approvalStatus: "not_required",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// 3. AgentExecution schema validation
// ---------------------------------------------------------------------------

test("AgentExecutionSchema accepts a valid execution record", () => {
  const result = AgentExecutionSchema.safeParse({
    id: "exec-001",
    agentTaskId: "task-001",
    agentId: "orchestrator",
    provider: "mock",
    model: "mock-1.0",
    status: "completed",
    attempt: 1,
    startedAt: "2026-07-12T00:00:00.000Z",
    completedAt: "2026-07-12T00:01:00.000Z",
  });
  assert.equal(result.success, true);
});

test("AgentExecutionSchema rejects attempt less than 1", () => {
  const result = AgentExecutionSchema.safeParse({
    id: "exec-002",
    agentTaskId: "task-001",
    agentId: "orchestrator",
    provider: "mock",
    model: "mock-1.0",
    status: "pending",
    attempt: 0, // invalid
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// 4. ApprovalGate schema validation
// ---------------------------------------------------------------------------

test("ApprovalGateSchema accepts a valid approval gate", () => {
  const result = ApprovalGateSchema.safeParse({
    id: "gate-001",
    agentTaskId: "task-001",
    actionType: "publish_content",
    reason: "Content requires human review before publication.",
    requestedBy: "orchestrator",
    requestedAt: "2026-07-12T00:00:00.000Z",
    status: "pending",
  });
  assert.equal(result.success, true);
});

test("ApprovalGateSchema rejects invalid approval status", () => {
  const result = ApprovalGateSchema.safeParse({
    id: "gate-002",
    agentTaskId: "task-001",
    actionType: "spend_money",
    reason: "Budget allocation required.",
    requestedBy: "orchestrator",
    requestedAt: "2026-07-12T00:00:00.000Z",
    status: "maybe", // not in enum
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// 5. AgentEvidence schema — sourceUrl optional for internal
// ---------------------------------------------------------------------------

test("AgentEvidenceSchema accepts internal evidence without sourceUrl", () => {
  const result = AgentEvidenceSchema.safeParse({
    type: "internal",
    title: "Engagement brief",
    content: "Client provided objectives and constraints.",
    source: "engagement-brief",
    confidence: 0.9,
    retrievedAt: "2026-07-12T00:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("AgentEvidenceSchema rejects confidence outside 0-1 range", () => {
  const result = AgentEvidenceSchema.safeParse({
    type: "web",
    title: "Article",
    content: "Body",
    source: "example.com",
    confidence: 1.5, // invalid
    retrievedAt: "2026-07-12T00:00:00.000Z",
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// 6. AgentRegistry — registration and retrieval
// ---------------------------------------------------------------------------

test("AgentRegistry registers an agent and returns it by id", () => {
  const registry = new AgentRegistry();
  registry.register(orchestratorDefinition);
  const found = registry.getById("orchestrator");
  assert.ok(found);
  assert.equal(found.id, "orchestrator");
});

test("AgentRegistry listEnabled returns only enabled agents", () => {
  const registry = new AgentRegistry();
  registry.register(orchestratorDefinition);
  registry.register(researcherDefinition);
  registry.register(qualityControlDefinition);
  const enabled = registry.listEnabled();
  assert.equal(enabled.length, 3);
  assert.ok(enabled.every((a) => a.enabled));
});

// ---------------------------------------------------------------------------
// 7. Duplicate agent ID rejection
// ---------------------------------------------------------------------------

test("AgentRegistry throws when registering duplicate id", () => {
  const registry = new AgentRegistry();
  registry.register(orchestratorDefinition);
  assert.throws(
    () => registry.register(orchestratorDefinition),
    /already registered/i,
  );
});

// ---------------------------------------------------------------------------
// 8. Public-safe metadata excludes systemPrompt
// ---------------------------------------------------------------------------

test("getPublicMetadata omits systemPrompt", () => {
  const registry = new AgentRegistry();
  registry.register(orchestratorDefinition);
  const meta = registry.getPublicMetadata("orchestrator");
  assert.ok(meta);
  assert.equal("systemPrompt" in meta, false);
  assert.equal(meta.id, "orchestrator");
  assert.equal(meta.name, "Orchestrator");
});

test("listPublicMetadata omits systemPrompt for all agents", () => {
  const registry = new AgentRegistry();
  registerAllAgents(registry);
  const all = registry.listPublicMetadata();
  assert.equal(all.length, 3);
  for (const meta of all) {
    assert.equal("systemPrompt" in meta, false, `${meta.id} should not expose systemPrompt`);
  }
});

// ---------------------------------------------------------------------------
// 9. AIProviderRegistry — resolution
// ---------------------------------------------------------------------------

test("AIProviderRegistry resolves a registered provider", () => {
  const providerRegistry = new AIProviderRegistry();
  const mock = createMockProvider();
  providerRegistry.register("mock", mock);
  const resolved = providerRegistry.resolve("mock");
  assert.ok(resolved);
  assert.ok(typeof resolved.generateText === "function");
});

// ---------------------------------------------------------------------------
// 10. AIProviderRegistry — unknown provider error
// ---------------------------------------------------------------------------

test("AIProviderRegistry throws descriptive error for unknown provider", () => {
  const providerRegistry = new AIProviderRegistry();
  providerRegistry.register("mock", createMockProvider());
  assert.throws(
    () => providerRegistry.resolve("openai"),
    /unknown ai provider.*openai/i,
  );
});

// ---------------------------------------------------------------------------
// 11. Missing xAI key returns typed error — not a throw
// ---------------------------------------------------------------------------

test("createXAIProvider returns error result when XAI_API_KEY is absent", () => {
  const result = createXAIProvider({ apiKey: undefined });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.kind, "authentication");
    assert.match(result.error.message, /XAI_API_KEY/i);
  }
});

test("createXAIProvider returns ok result when apiKey is provided", () => {
  const result = createXAIProvider({ apiKey: "test-key-not-real" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(typeof result.provider.generateText === "function");
  }
});

// ---------------------------------------------------------------------------
// 12. xAI provider does not expose the API key
// ---------------------------------------------------------------------------

test("xAI provider result does not include the API key string", () => {
  const apiKey = "xai-supersecret-key-12345";
  const result = createXAIProvider({ apiKey });
  const serialized = JSON.stringify(result);
  assert.equal(
    serialized.includes(apiKey),
    false,
    "API key must not appear in the provider result",
  );
});

// ---------------------------------------------------------------------------
// 13–15. Mock provider returns valid structured outputs
// ---------------------------------------------------------------------------

test("mock provider returns valid OrchestratorOutput", async () => {
  const provider = createMockProvider();
  const output = await provider.generateStructuredResult(
    {
      systemPrompt: "You are the FullSendOS Orchestrator Agent.",
      userPrompt: "Plan this engagement",
      metadata: { agentId: "orchestrator" },
    },
    OrchestratorOutputSchema,
  );
  assert.ok(output.summary.length > 0);
  assert.ok(Array.isArray(output.tasks));
  assert.ok(output.tasks.length > 0);
  assert.ok(output.tasks[0].recommendedAgentId.length > 0);
  assert.ok(typeof output.recommendedNextAction === "string");
});

test("mock provider returns valid ResearchOutput", async () => {
  const provider = createMockProvider();
  const output = await provider.generateStructuredResult(
    {
      systemPrompt: "You are the FullSendOS Research Agent.",
      userPrompt: "Research this market",
      metadata: { agentId: "researcher" },
    },
    ResearchOutputSchema,
  );
  assert.ok(output.executiveSummary.length > 0);
  assert.ok(Array.isArray(output.findings));
  assert.ok(output.confidence >= 0 && output.confidence <= 1);
  // Must disclose unavailability of live research tools
  const disclosesNoTools = output.assumptions.some((a) =>
    a.toLowerCase().includes("no live research tools"),
  );
  assert.ok(disclosesNoTools, "Research output must disclose missing research tools");
});

test("mock provider returns valid QualityControlOutput", async () => {
  const provider = createMockProvider();
  const output = await provider.generateStructuredResult(
    {
      systemPrompt: "You are the FullSendOS Quality Control Agent.",
      userPrompt: "Review this work product",
      metadata: { agentId: "quality-control" },
    },
    QualityControlOutputSchema,
  );
  assert.ok(["approved", "approved_with_notes", "revision_required", "rejected"].includes(output.verdict));
  assert.ok(output.score >= 0 && output.score <= 100);
  assert.ok(output.approvalRecommendation.length > 0);
});

// ---------------------------------------------------------------------------
// 16. OrchestratorAgent.execute uses mock provider correctly
// ---------------------------------------------------------------------------

test("OrchestratorAgent.execute returns valid output via mock provider", async () => {
  const { OrchestratorAgent } = await import("../agents/definitions/orchestrator");
  const agent = new OrchestratorAgent();
  const task = AgentTaskSchema.parse({
    id: "task-exec-001",
    agentId: "orchestrator",
    title: "Plan test engagement",
    objective: "Develop a consulting plan for a craft brewery expansion",
    status: "queued",
    provider: "mock",
    model: "mock-1.0",
    approvalStatus: "not_required",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const provider = createMockProvider();
  const output = await agent.execute(task, provider);
  assert.ok(output.summary.length > 0);
  assert.ok(Array.isArray(output.tasks));
});

// ---------------------------------------------------------------------------
// 17. Output schemas validate canonical payloads
// ---------------------------------------------------------------------------

test("OrchestratorOutputSchema validates a canonical payload", () => {
  const result = OrchestratorOutputSchema.safeParse({
    summary: "Engagement plan for brewery expansion",
    assumptions: ["Client has existing distribution network"],
    tasks: [
      {
        id: "t-01",
        title: "Market Research",
        objective: "Identify target markets",
        recommendedAgentId: "researcher",
        department: "research",
        priority: "high",
        dependencies: [],
        requiresApproval: false,
        expectedOutput: "Market sizing report",
      },
    ],
    dependencies: [],
    risks: ["Budget constraints"],
    approvalGates: [],
    successCriteria: ["All tasks completed on schedule"],
    recommendedNextAction: "Start market research",
  });
  assert.equal(result.success, true);
});

test("ResearchOutputSchema validates a canonical payload", () => {
  const result = ResearchOutputSchema.safeParse({
    executiveSummary: "Market shows strong growth indicators.",
    researchQuestions: ["What is the TAM?"],
    findings: [
      {
        topic: "Market size",
        summary: "TAM estimated at $1.2B",
        confidence: 0.75,
        sources: ["industry-report-2025"],
      },
    ],
    evidence: [
      {
        type: "web",
        title: "Industry Report 2025",
        content: "Annual craft beverage market analysis",
        source: "industry-report-2025",
        confidence: 0.8,
        retrievedAt: "2026-07-12T00:00:00.000Z",
      },
    ],
    assumptions: ["Report data is current as of publication"],
    gaps: ["Regional breakdown unavailable"],
    risks: ["Market saturation in urban segments"],
    recommendations: ["Target suburban markets for initial expansion"],
    confidence: 0.75,
  });
  assert.equal(result.success, true);
});

test("QualityControlOutputSchema validates a canonical payload", () => {
  const result = QualityControlOutputSchema.safeParse({
    verdict: "approved",
    score: 91,
    summary: "Work product meets all quality criteria.",
    passedChecks: [
      { id: "c1", label: "Structure complete", passed: true },
      { id: "c2", label: "Claims supported", passed: true },
    ],
    failedChecks: [],
    unsupportedClaims: [],
    missingInformation: [],
    requiredRevisions: [],
    approvalRecommendation: "Approved for client delivery.",
  });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// 18. Output schemas reject malformed payloads
// ---------------------------------------------------------------------------

test("OrchestratorOutputSchema rejects payload missing summary", () => {
  const result = OrchestratorOutputSchema.safeParse({
    // summary is missing
    assumptions: [],
    tasks: [],
    dependencies: [],
    risks: [],
    approvalGates: [],
    successCriteria: [],
    recommendedNextAction: "Start",
  });
  assert.equal(result.success, false);
});

test("QualityControlOutputSchema rejects invalid verdict value", () => {
  const result = QualityControlOutputSchema.safeParse({
    verdict: "maybe", // not in enum
    score: 50,
    summary: "Partial review",
    passedChecks: [],
    failedChecks: [],
    unsupportedClaims: [],
    missingInformation: [],
    requiredRevisions: [],
    approvalRecommendation: "Unclear",
  });
  assert.equal(result.success, false);
});

test("ResearchOutputSchema rejects confidence outside 0-1", () => {
  const result = ResearchOutputSchema.safeParse({
    executiveSummary: "Summary",
    researchQuestions: [],
    findings: [],
    evidence: [],
    assumptions: [],
    gaps: [],
    risks: [],
    recommendations: [],
    confidence: 2.5, // invalid
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// 19. validateTask catches wrong agentId
// ---------------------------------------------------------------------------

test("OrchestratorAgent.validateTask rejects task with wrong agentId", async () => {
  const { OrchestratorAgent } = await import("../agents/definitions/orchestrator");
  const agent = new OrchestratorAgent();
  const result = agent.validateTask({
    id: "t",
    agentId: "researcher", // wrong
    title: "Plan",
    objective: "Plan engagement",
    status: "queued",
    provider: "mock",
    model: "mock-1.0",
    approvalStatus: "not_required",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

// ---------------------------------------------------------------------------
// 20. Permission vocabulary completeness
// ---------------------------------------------------------------------------

test("HIGH_RISK_PERMISSIONS contains all five restricted actions", async () => {
  const { HIGH_RISK_PERMISSIONS, AgentPermissions } = await import("../agents/permissions");
  assert.ok(HIGH_RISK_PERMISSIONS.has(AgentPermissions.SEND_EMAIL));
  assert.ok(HIGH_RISK_PERMISSIONS.has(AgentPermissions.PUBLISH_CONTENT));
  assert.ok(HIGH_RISK_PERMISSIONS.has(AgentPermissions.SPEND_MONEY));
  assert.ok(HIGH_RISK_PERMISSIONS.has(AgentPermissions.MODIFY_PRODUCTION));
  assert.ok(HIGH_RISK_PERMISSIONS.has(AgentPermissions.DELETE_RECORD));
});

test("FIRST_SLICE_ALLOWED_PERMISSIONS does not include any high-risk permissions", async () => {
  const { HIGH_RISK_PERMISSIONS, FIRST_SLICE_ALLOWED_PERMISSIONS } = await import("../agents/permissions");
  for (const permission of FIRST_SLICE_ALLOWED_PERMISSIONS) {
    assert.equal(
      HIGH_RISK_PERMISSIONS.has(permission),
      false,
      `${permission} should not be in first-slice allowed set`,
    );
  }
});
