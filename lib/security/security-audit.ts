import type { SecurityDecisionAuditEvent } from "./types";

export type SecurityAuditSink = (event: SecurityDecisionAuditEvent) => void | Promise<void>;

const inMemoryEvents: SecurityDecisionAuditEvent[] = [];

let currentSink: SecurityAuditSink = (event) => {
  inMemoryEvents.push(event);
};

export async function recordSecurityDecision(event: SecurityDecisionAuditEvent): Promise<void> {
  await currentSink(event);
}

export function setSecurityAuditSinkForTests(sink: SecurityAuditSink): void {
  currentSink = sink;
}

export function resetSecurityAuditSinkForTests(): void {
  currentSink = (event) => {
    inMemoryEvents.push(event);
  };
}

export function getSecurityAuditEventsForTests(): SecurityDecisionAuditEvent[] {
  return [...inMemoryEvents];
}

export function clearSecurityAuditEventsForTests(): void {
  inMemoryEvents.length = 0;
}
