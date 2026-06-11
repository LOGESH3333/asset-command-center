import { createBrowserClient } from '@supabase/ssr';

const AUTH_FETCH_RETRY_DELAYS_MS = [300, 800, 1500];

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const message = error.message.toLowerCase();
  return (
    message === 'failed to fetch' ||
    message.includes('network') ||
    message.includes('load failed')
  );
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/v1/');
}

async function fetchWithAuthDiagnostics(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = resolveRequestUrl(input);
  const method = init?.method ?? 'GET';
  const maxAttempts = isAuthEndpoint(url) ? AUTH_FETCH_RETRY_DELAYS_MS.length + 1 : 1;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now();
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < maxAttempts && isAuthEndpoint(url) && isTransientFetchError(error);

      if (canRetry) {
        await new Promise((resolve) =>
          setTimeout(resolve, AUTH_FETCH_RETRY_DELAYS_MS[attempt - 1])
        );
        continue;
      }

      const payload = {
        url,
        method,
        attempt,
        maxAttempts,
        elapsedMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'UnknownError',
      };

      if (isTransientFetchError(error)) {
        console.warn('[supabase:browser-fetch] transient network failure', payload);
      } else {
        console.error('[supabase:browser-fetch] request failed', {
          ...payload,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      throw error;
    }
  }

  throw lastError;
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: fetchWithAuthDiagnostics,
    },
    isSingleton: true,
  });
}

/** Singleton browser client for client components */
export const supabase = createClient();
