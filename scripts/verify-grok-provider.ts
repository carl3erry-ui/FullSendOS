import { createXAIProvider } from "../ai/xai-provider";
import { evaluateLiveVerificationGuard, redactSecrets } from "../services/live-verification-utils";
import { GrokProviderError } from "../ai/types";

const VERIFICATION_MARKER = "GROK_PROVIDER_OK";
const ENDPOINT = "/responses";
const REQUEST_SHAPE = "responses-minimal";

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
    userPrompt: `Reply with exactly: ${VERIFICATION_MARKER}`,
    model: guard.config.defaultModel,
    maxOutputTokens: 32,
  });
  const completedAt = new Date().toISOString();

  const safePreview = redactSecrets(response.text).slice(0, 160);
  const markerMatched = safePreview.includes(VERIFICATION_MARKER);

  if (!markerMatched) {
    console.error("Live Grok verification failed.");
    console.error("Status: 200");
    console.error(`Endpoint: ${ENDPOINT}`);
    console.error(`Model: ${response.model}`);
    console.error(`Request shape: ${REQUEST_SHAPE}`);
    console.error("Likely cause: response did not include expected verification marker.");
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        verification: "grok-provider",
        status: "ok",
        marker: VERIFICATION_MARKER,
        markerMatched,
        endpoint: ENDPOINT,
        requestShape: REQUEST_SHAPE,
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
  const safeMessage = redactSecrets(message);
  const status = error instanceof GrokProviderError ? error.statusCode || "unknown" : "unknown";
  const model = process.env.XAI_DEFAULT_MODEL || process.env.XAI_MODEL || "grok-4.5";

  console.error("Live Grok verification failed.");
  console.error(`Status: ${status}`);
  console.error(`Endpoint: ${ENDPOINT}`);
  console.error(`Model: ${model}`);
  console.error(`Request shape: ${REQUEST_SHAPE}`);
  console.error(`Likely cause: ${safeMessage}`);
  process.exit(1);
});