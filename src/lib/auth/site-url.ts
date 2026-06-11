/**
 * Canonical app origin for Supabase auth redirects.
 * Must match URLs allowlisted in Supabase Dashboard → Authentication → URL Configuration.
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** Server-safe site URL resolution. */
export function getSiteUrlFromEnv(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL.trim());
  }
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL.trim());
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }
  return 'http://localhost:3000';
}

/** Client-side site URL — env first, then window.origin. */
export function getSiteUrl(): string {
  if (typeof window !== 'undefined') {
    const fromEnv =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (fromEnv) return stripTrailingSlash(fromEnv);
    return window.location.origin;
  }
  return getSiteUrlFromEnv();
}

/**
 * Password reset emails must redirect through /auth/callback so the PKCE `code`
 * is exchanged for a session before /reset-password calls updateUser().
 */
export function getPasswordResetRedirectUrl(): string {
  const site = getSiteUrl();
  const next = encodeURIComponent('/reset-password');
  return `${site}/auth/callback?redirect=${next}`;
}

/** URLs operators should allowlist in Supabase Auth URL Configuration. */
export function getRequiredAuthRedirectUrls(): string[] {
  const site = getSiteUrlFromEnv();
  return [
    `${site}/auth/callback`,
    `${site}/reset-password`,
    `${site}/login`,
  ];
}
