/**
 * Auto-branding utility for Showpane.
 * Fetches logos, avatars, and brand colors from free APIs.
 * All functions return sensible defaults on failure.
 */

/**
 * Fetch a company logo URL from a domain.
 * Uses Clearbit Logo API (free, no key required).
 * Falls back to a UI Avatars URL with the company initial.
 */
export function getLogoUrl(domain: string, fallbackName?: string): string {
  if (domain) {
    // Clearbit Logo API - free, no authentication needed
    return `https://logo.clearbit.com/${domain}`;
  }
  // Fallback: initial-based avatar via ui-avatars.com
  const initial = (fallbackName || "?")[0].toUpperCase();
  return `https://ui-avatars.com/api/?name=${initial}&background=111827&color=fff&size=128&bold=true`;
}

/**
 * Fetch a Gravatar URL for an email address.
 * Falls back to UI Avatars if no Gravatar exists.
 */
export function getAvatarUrl(email: string, fallbackName?: string): string {
  if (email) {
    // Use Gravatar with fallback to UI Avatars
    const hash = email.trim().toLowerCase();
    // Note: Real implementation would MD5 hash the email.
    // For now, use UI Avatars as the Gravatar default (d=)
    const fallback = encodeURIComponent(
      `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName || email.split("@")[0])}&background=dbeafe&color=2563eb&size=128`
    );
    return `https://www.gravatar.com/avatar/?d=${fallback}`;
  }
  const name = fallbackName || "User";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=dbeafe&color=2563eb&size=128`;
}

/**
 * Generate a placeholder logo as a data URI SVG.
 * Used when no domain is available.
 */
export function getInitialLogo(name: string, bgColor = "#111827", textColor = "#ffffff"): string {
  const initial = (name || "?")[0].toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="${bgColor}"/><text x="64" y="64" dy=".35em" text-anchor="middle" fill="${textColor}" font-family="system-ui,sans-serif" font-size="64" font-weight="600">${initial}</text></svg>`
  )}`;
}
