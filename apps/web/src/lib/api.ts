/**
 * Central API fetch wrapper.
 * Handles auth headers (stub vs logto) and impersonation.
 */

// Module-level state for auth token (set by auth-provider)
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

// Module-level state for impersonation (set by impersonation-provider)
let _impersonateUserId: string | null = null;

export function setImpersonateUserId(userId: string | null) {
  _impersonateUserId = userId;
}

export function getImpersonateUserId() {
  return _impersonateUserId;
}

// Error simulation (dev-only, one-shot)
let _simulateError = false;
export function setSimulateError(on: boolean) { _simulateError = on; }
export function getSimulateError() { return _simulateError; }

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {};

  // For mutating methods without an explicit body, send '{}' so Fastify's
  // content-type parser doesn't reject the request as "Unsupported Media Type".
  const method = options?.method?.toUpperCase();
  const needsBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const body = options?.body ?? (needsBody ? '{}' : undefined);

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  // Auth header (logto mode — stub mode doesn't need one)
  if (_getToken) {
    const token = await _getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Impersonation header
  if (_impersonateUserId) {
    headers['X-Impersonate-User-Id'] = _impersonateUserId;
  }

  // Error simulation (dev-only, one-shot: auto-clears after one mutating request)
  if (_simulateError && needsBody) {
    headers['X-Simulate-Error'] = 'true';
    _simulateError = false;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    body,
    headers: { ...headers, ...options?.headers },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}
