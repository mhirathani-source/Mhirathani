import type { NextFunction, Request, Response } from "express";

// Deny by default: new endpoints are admin-only until explicitly reviewed.
// These operational endpoints never return prices, payments, debt or reports.
export function isOperationalRoute(method: string, path: string): boolean {
  const read = method === "GET" || method === "HEAD";
  return (read && /^\/club\/(?:session|overview)\/?$/.test(path))
    || ((read || method === "POST") && /^\/members\/?$/.test(path))
    || (method === "PATCH" && /^\/members\/[1-9]\d*\/?$/.test(path))
    || (read && /^\/members\/[1-9]\d*\/profile\/?$/.test(path));
}

export function financialAccess(req: Request, res: Response, next: NextFunction): void {
  if (req.clubUser?.role === "admin" || isOperationalRoute(req.method, req.path)) {
    next();
    return;
  }
  res.status(403).json({ error: "ليس لديك صلاحية - Access Denied", code: "ADMIN_REQUIRED" });
}
