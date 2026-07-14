import { createXAIProvider } from "../ai/xai-provider";
import { evaluateLiveVerificationGuard, redactSecrets } from "../services/live-verification-utils";

async function main() {
  const guard = evaluateLiveVerificationGuard();
  if (!guard.ok) {
    console.error("NOT RUN - live verification guard failed.");
    for (const reason of guard.reasons) {
      console.error(`- ${reason}`);
    }
    process.exit(1);
  }

  const providerResult = createXAIProvider();
  if (!providerResult.ok) {
    console.error(`Provider init failed: ${redactSecrets(providerResult.error.message)}`);
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  const response = await providerResult.provider.generateText({
    userPrompt:
      "Return one short sentence confirming live provider connectivity and include the word CONNECTED.",
    model: guard.config.defaultModel,
    metadata: { verification: "grok-provider-smoke" },
  });
  const completedAt = new Date().toISOString();

  const safePreview = redactSecrets(response.text).slice(0, 160);

  console.log(
    JSON.stringify(
      {
        verification: "grok-provider",
        status: "ok",
        provider: response.provider,
        model: response.model,
        requestId: response.requestId || null,
        usage: response.usage || null,
        startedAt,
        completedAt,
        textPreview: safePreview,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Verification failed: ${redactSecrets(message)}`);
  process.exit(1);
});