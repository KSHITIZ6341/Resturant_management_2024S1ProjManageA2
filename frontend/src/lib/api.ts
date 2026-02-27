const FALLBACK_API_BASE_URL = 'http://127.0.0.1:5000';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || FALLBACK_API_BASE_URL).replace(/\/$/, '');

const DEFAULT_TIMEOUT_MS = 15000;

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const headers = new Headers(init.headers || {});
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    signal: init.signal || createTimeoutSignal(DEFAULT_TIMEOUT_MS)
  });

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`.trim();
    let message = fallback || 'Request failed';
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === 'string') {
        message = payload.message;
      }
    } catch {
      // Ignore JSON parsing errors and keep the fallback message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function apiPut<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' });
}
