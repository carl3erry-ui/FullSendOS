import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedActor } from "./types";

const DevTestActorPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(["internal_admin", "internal_operator", "client_user"]),
  clientId: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
});

type DevTestActorPayload = z.infer<typeof DevTestActorPayloadSchema>;

type AuthFailureReason =
  | "missing_identity"
  | "malformed_identity"
  | "invalid_signature"
  | "adapter_disabled"
  | "provider_not_configured";

const TOKEN_PREFIX = "fst1";
const AUTH_SCHEME = "Bearer ";
const MIN_DEV_TEST_SECRET_LENGTH = 32;
const MAX_AUTH_HEADER_LENGTH = 8 * 1024;
const MAX_TOKEN_LENGTH = 4 * 1024;
const MAX_TOKEN_SEGMENT_LENGTH = 2 * 1024;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function computeSignature(payloadEncoded: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadEncoded).digest("base64url");
}

function parseAuthorizationToken(header: string | null): string | null {
  if (!header) return null;
  if (!header.startsWith(AUTH_SCHEME)) return null;
  return header.slice(AUTH_SCHEME.length).trim() || null;
}

function isDevTestAuthAdapterEnabled(env: NodeJS.ProcessEnv): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.NODE_ENV === "test") return true;
  return env.FULLSENDOS_AUTH_DEV_TEST_ENABLED === "1";
}

function getDevTestSecret(env: NodeJS.ProcessEnv): string | null {
  const configuredSecret = env.FULLSENDOS_AUTH_DEV_TEST_SECRET;
  if (!configuredSecret) return null;

  const trimmedSecret = configuredSecret.trim();
  if (trimmedSecret.length < MIN_DEV_TEST_SECRET_LENGTH) {
    return null;
  }

  return trimmedSecret;
}

function toActor(payload: DevTestActorPayload): AuthenticatedActor {
  return {
    id: payload.sub,
    role: payload.role,
    clientId: payload.clientId,
    displayName: payload.displayName,
    authenticated: true,
  };
}

export function issueDevTestActorToken(payload: DevTestActorPayload, secret?: string): string {
  const validated = DevTestActorPayloadSchema.parse(payload);
  const payloadEncoded = base64UrlEncode(JSON.stringify(validated));
  const activeSecret = secret ?? getDevTestSecret(process.env);
  if (!activeSecret) {
    throw new Error(
      "FULLSENDOS_AUTH_DEV_TEST_SECRET must be set to at least 32 characters to issue dev/test tokens.",
    );
  }
  const signature = computeSignature(payloadEncoded, activeSecret);
  return `${TOKEN_PREFIX}.${payloadEncoded}.${signature}`;
}

function authenticateFromDevTestToken(
  request: Request,
  env: NodeJS.ProcessEnv,
):
  | { ok: true; actor: AuthenticatedActor }
  | { ok: false; reason: AuthFailureReason } {
  const activeSecret = getDevTestSecret(env);
  if (!activeSecret) {
    return { ok: false, reason: "adapter_disabled" };
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.length > MAX_AUTH_HEADER_LENGTH) {
    return { ok: false, reason: "malformed_identity" };
  }

  const token = parseAuthorizationToken(authHeader);
  if (!token) return { ok: false, reason: "missing_identity" };
  if (token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: "malformed_identity" };
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    return { ok: false, reason: "malformed_identity" };
  }

  const [, payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) {
    return { ok: false, reason: "malformed_identity" };
  }
  if (payloadEncoded.length > MAX_TOKEN_SEGMENT_LENGTH || signature.length > MAX_TOKEN_SEGMENT_LENGTH) {
    return { ok: false, reason: "malformed_identity" };
  }

  const expectedSignature = computeSignature(payloadEncoded, activeSecret);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { ok: false, reason: "invalid_signature" };
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payloadEncoded));
    const parsed = DevTestActorPayloadSchema.parse(decoded);
    return { ok: true, actor: toActor(parsed) };
  } catch {
    return { ok: false, reason: "malformed_identity" };
  }
}

export function getAuthenticatedActor(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
):
  | { ok: true; actor: AuthenticatedActor }
  | { ok: false; reason: AuthFailureReason } {
  if (isDevTestAuthAdapterEnabled(env)) {
    return authenticateFromDevTestToken(request, env);
  }

  if (env.NODE_ENV === "production") {
    return { ok: false, reason: "provider_not_configured" };
  }

  return { ok: false, reason: "adapter_disabled" };
}
