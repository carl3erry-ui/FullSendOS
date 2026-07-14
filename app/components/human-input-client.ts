import { getApiErrorMessage } from "./api-error";
import type { HumanInputRequest } from "@/schemas/human-input";

export type HumanInputRequestListResponse = { data: HumanInputRequest[] };

async function parseResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export async function fetchHumanInputRequests(
  filters?: { clientId?: string; engagementId?: string; agentTaskId?: string; openOnly?: boolean; blockingOnly?: boolean },
  fetchImpl: typeof fetch = fetch,
): Promise<HumanInputRequest[]> {
  const url = new URL("/api/human-input", typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  if (filters?.clientId) url.searchParams.set("clientId", filters.clientId);
  if (filters?.engagementId) url.searchParams.set("engagementId", filters.engagementId);
  if (filters?.agentTaskId) url.searchParams.set("agentTaskId", filters.agentTaskId);
  if (filters?.openOnly) url.searchParams.set("openOnly", "true");
  if (filters?.blockingOnly) url.searchParams.set("blockingOnly", "true");

  const response = await fetchImpl(url.toString());
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Unable to load human input requests."));
  }

  return Array.isArray((data as HumanInputRequestListResponse).data)
    ? (data as HumanInputRequestListResponse).data
    : [];
}

export async function answerHumanInputRequest(
  id: string,
  responseText: string,
  resolvedBy: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`/api/human-input/${id}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: responseText, resolvedBy }),
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Unable to submit human input answer."));
  }
}

export async function confirmHumanInputRequest(
  id: string,
  responseText: string,
  resolvedBy: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`/api/human-input/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: responseText, resolvedBy }),
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Unable to confirm human input request."));
  }
}

export async function rejectHumanInputRequest(
  id: string,
  responseText: string,
  resolvedBy: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`/api/human-input/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: responseText, resolvedBy }),
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Unable to reject human input request."));
  }
}

export async function skipHumanInputRequest(
  id: string,
  responseText: string,
  resolvedBy: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`/api/human-input/${id}/skip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: responseText, resolvedBy }),
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Unable to skip human input request."));
  }
}
