// Use the verified production host as a development fallback. In production,
// use the host serving this page so the QR and links follow a changed domain.
export const PUBLIC_APP_URL = "https://Prime1academy.replit.app/";

export function securePortalUrl() {
  const origin = typeof window !== "undefined" && window.location.protocol === "https:"
    ? window.location.origin
    : PUBLIC_APP_URL;
  const url = new URL("/", origin);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("The club portal must use a credential-free HTTPS URL.");
  }
  return url.href;
}

export function publicDownloadUrl() {
  return new URL("download", securePortalUrl()).href;
}
