function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data?.output)) {
    const parts = [];
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const block of item.content) {
        if (block?.type === "output_text" && typeof block.text === "string") {
          parts.push(block.text);
        }
      }
    }
    if (parts.length) return parts.join("\n").trim();
  }

  throw new Error("No output_text found in xAI response.");
}

export async function callXai({ prompt, model = process.env.XAI_MODEL || "grok-4.5" }) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not configured.");

  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      store: false,
      temperature: 0.2
    })
  });

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`xAI returned non-JSON HTTP ${response.status}: ${raw.slice(0, 500)}`);
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.error || data?.message || raw;
    throw new Error(`xAI HTTP ${response.status}: ${typeof message === "string" ? message : JSON.stringify(message)}`);
  }

  return { text: extractOutputText(data), model: data.model || model, raw: data };
}
