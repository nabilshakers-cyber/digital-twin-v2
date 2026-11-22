import { resolveApiBase } from './api';

let cachedKeyPromise: Promise<string> | null = null;

/**
 * Resolves the Google Maps Platform API key cleanly from build-time Vite env
 * or the backend runtime config endpoint without ever hardcoding credentials.
 */
export async function resolveGoogleMapsApiKey(): Promise<string> {
  const buildTimeKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (buildTimeKey) {
    return buildTimeKey;
  }

  if (!cachedKeyPromise) {
    const endpoint = `${resolveApiBase()}/api/maps-config`;
    cachedKeyPromise = fetch(endpoint)
      .then(async (res) => {
        if (!res.ok) return '';
        const data = (await res.json()) as { apiKey?: string };
        return typeof data?.apiKey === 'string' ? data.apiKey.trim() : '';
      })
      .catch(() => '');
  }

  return cachedKeyPromise;
}

export function isMapsQuotaError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as {
    status?: number | string;
    code?: number | string;
    message?: string;
    error?: { status?: string; code?: number; message?: string };
  };
  const msg = String(anyErr.message || anyErr.error?.message || err);
  return (
    anyErr.status === 429 ||
    anyErr.code === 429 ||
    anyErr.status === 'RESOURCE_EXHAUSTED' ||
    anyErr.status === 'OVER_QUERY_LIMIT' ||
    anyErr.error?.status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('429')
  );
}

export function dispatchMapsQuotaExceeded(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}
