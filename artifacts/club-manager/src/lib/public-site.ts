// Verified with Replit's deployment metadata. Update after changing the published domain.
export const PUBLIC_APP_URL = "https://Prime1academy.replit.app/";
export const PUBLIC_DOWNLOAD_URL = new URL("download", PUBLIC_APP_URL).href;

export function securePortalUrl() {
  const url = new URL(PUBLIC_APP_URL);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("The club portal must use a credential-free HTTPS URL.");
  }
  return url.href;
}
