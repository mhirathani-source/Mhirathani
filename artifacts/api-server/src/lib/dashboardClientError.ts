import { z } from "zod/v4";

export const dashboardClientErrorSchema = z.object({
  name: z.string().trim().min(1).max(100),
  message: z.string().max(500),
  stack: z.string().max(8_000),
  componentStack: z.string().max(8_000),
  pathname: z.literal("/dashboard"),
}).strict();

/**
 * Keep source paths and line/column information while removing common
 * credentials and personal identifiers from browser-generated diagnostics.
 */
export function sanitizeDashboardDiagnostic(value: string, maxLength: number): string {
  return value
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]{20,}|sk_[A-Za-z0-9_-]{10,}|pk_[A-Za-z0-9_-]{10,})\b/g, "[redacted-token]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:\+?962[- ]?)?0?7\d(?:[\s-]?\d){7}\b/g, "[redacted-phone]")
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      const location = url.match(/:\d+:\d+$/)?.[0] ?? "";
      const withoutLocation = location ? url.slice(0, -location.length) : url;
      const queryAt = withoutLocation.search(/[?#]/);
      const safeUrl = queryAt < 0
        ? withoutLocation
        : `${withoutLocation.slice(0, queryAt)}?[redacted]`;
      return `${safeUrl}${location}`;
    })
    .slice(0, maxLength);
}
