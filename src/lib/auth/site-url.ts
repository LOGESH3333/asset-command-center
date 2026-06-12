/**
 * Canonical app origin for auth redirects, invite links, QR codes, and callbacks.
 * Must match URLs allowlisted in Supabase Dashboard → Authentication → URL Configuration.
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** True when the origin is local-only (not valid for production emails / QR codes). */
export function isLocalOrigin(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
  }
}

/**
 * Resolve the public app URL for server and client builds.
 * Priority: NEXT_PUBLIC_APP_URL → VERCEL_URL → non-local NEXT_PUBLIC_SITE_URL → browser origin → localhost.
 */
export function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return stripTrailingSlash(appUrl);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, '')}`;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl && !isLocalOrigin(siteUrl)) {
    return stripTrailingSlash(siteUrl);
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (!isLocalOrigin(origin)) {
      return origin;
    }
  }

  return 'http://localhost:3000';
}

/** @deprecated Prefer getAppUrl — kept for existing imports. */
export function getSiteUrlFromEnv(): string {
  return getAppUrl();
}

/** Client-side site URL — env first, then non-local window.origin. */
export function getSiteUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return stripTrailingSlash(appUrl);
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (!isLocalOrigin(origin)) {
      return origin;
    }
  }

  return getAppUrl();
}

/**
 * Production-configured origin when available.
 * Returns undefined when only a local dev fallback would be used.
 */
export function getConfiguredAppOrigin(): string | undefined {
  const url = getAppUrl();
  return isLocalOrigin(url) ? undefined : url;
}

const PASSWORD_RESET_PATH = '/auth/reset-password';

/**
 * Password reset emails redirect through /auth/callback so the PKCE `code` (or recovery OTP)
 * is exchanged for a session before the reset password form calls updateUser().
 */
export function getPasswordResetRedirectUrl(): string {
  const site = getAppUrl();
  const next = encodeURIComponent(PASSWORD_RESET_PATH);
  return `${site}/auth/callback?redirect=${next}`;
}

export function getPasswordResetPagePath(): string {
  return PASSWORD_RESET_PATH;
}

/** URLs operators should allowlist in Supabase Auth URL Configuration. */
export function getRequiredAuthRedirectUrls(): string[] {
  const site = getAppUrl();
  return [
    `${site}/auth/callback`,
    `${site}${PASSWORD_RESET_PATH}`,
    `${site}/reset-password`,
    `${site}/login`,
    `${site}/forgot-password`,
    `${site}/activate-account`,
  ];
}
