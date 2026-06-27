import { peekDistributedRateLimit, checkDistributedRateLimit, deleteDistributedRateLimitKey } from "@/lib/rate-limit-redis";

const FAILURE_LIMIT = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export async function assertLoginNotLocked(identifier: string) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return;

  const state = await peekDistributedRateLimit(`auth-failures:${normalized}`, FAILURE_LIMIT);
  if (!state.allowed) {
    throw new LoginLockedOutError();
  }
}

export async function recordLoginFailure(identifier: string) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return;

  await checkDistributedRateLimit(`auth-failures:${normalized}`, FAILURE_LIMIT, FAILURE_WINDOW_MS);
}

export async function clearLoginFailures(identifier: string) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return;
  await deleteDistributedRateLimitKey(`auth-failures:${normalized}`);
}

export class LoginLockedOutError extends Error {
  constructor() {
    super("Too many failed sign-in attempts.");
    this.name = "LoginLockedOutError";
  }
}
