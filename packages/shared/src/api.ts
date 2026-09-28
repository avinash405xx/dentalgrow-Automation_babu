/**
 * Browser-safe API client for the DentaGrow API.
 *
 * Only read endpoints and the inert user-provisioning endpoint are exposed
 * here. The service-role key and the internal shared secret are server-side
 * only and are never referenced from the browser.
 */

export type ApiHealth = {
  ok: boolean;
  version: string;
  service: string;
};

export type ApiRelease = {
  latestVersion: string;
  minimumSupportedVersion: string;
  releaseChannel: string;
  releaseNotes: string[];
};

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; details?: unknown };

/**
 * Resolves the API base URL from Vite env with a localhost fallback so the
 * panels work against `npm run dev:api` out of the box.
 */
export function getApiBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env;
  const configured = (env?.VITE_API_BASE_URL || '').trim();
  // Vite ships placeholder text in .env.example; ignore it when untouched.
  if (configured && !configured.includes('example.com') && !configured.includes('YOUR_')) {
    return configured.replace(/\/+$/, '');
  }
  return 'http://127.0.0.1:4400';
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(getApiBaseUrl() + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    const raw = await response.text();
    const parsed = raw ? safeJson(raw) : null;

    if (!response.ok) {
      const message =
        (parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error?: unknown }).error)
          : null) || `Request failed with status ${response.status}`;

      return {
        ok: false,
        status: response.status,
        error: message,
        details:
          parsed && typeof parsed === 'object' && 'details' in parsed
            ? (parsed as { details?: unknown }).details
            : undefined,
      };
    }

    return { ok: true, status: response.status, data: parsed as T };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error:
        error instanceof Error
          ? `Cannot reach the DentaGrow API at ${getApiBaseUrl()} (${error.message})`
          : 'Unknown network error',
    };
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function fetchHealth(): Promise<ApiResult<ApiHealth>> {
  return request<ApiHealth>('/health');
}

export function fetchCurrentRelease(): Promise<ApiResult<ApiRelease>> {
  return request<ApiRelease>('/v1/releases/current');
}

export type ProvisionUserInput = {
  email: string;
  fullName: string;
  role: string;
  organizationId: string;
};

/**
 * The API intentionally answers 501 until caller-authorization middleware is
 * enabled, so this surfaces the server's real decision instead of pretending
 * provisioning succeeded.
 */
export function provisionUser(
  input: ProvisionUserInput,
): Promise<ApiResult<unknown>> {
  return request<unknown>('/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
