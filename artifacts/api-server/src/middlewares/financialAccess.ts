import type { NextFunction, Request, Response } from "express";
import { hasPermission, routePermissions } from "../lib/permissions";

// Unknown endpoints stay denied until explicitly mapped. Roles alone grant nothing.
export function financialAccess(req: Request, res: Response, next: NextFunction): void {
  const required = routePermissions(req.method, req.path);
  if (req.path.replace(/\/$/, "") === "/club/session" && ["GET", "HEAD"].includes(req.method)) { next(); return; }
  const exporting = ["csv","pdf","xlsx"].includes(String(req.query?.format));
  const exportPermission = required && Array.isArray(required) ? required[0]?.replace(/\.[^.]+$/, ".export") : undefined;
  if (req.clubUser?.status === "active" && (req.clubUser.isOwner || (Array.isArray(required) && required.every(name => hasPermission(req, name)) && (!exporting || (!!exportPermission && hasPermission(req, exportPermission)))))) {
    next();
    return;
  }
  res.status(403).json({ error: "ليس لديك صلاحية - Access Denied", code: "PERMISSION_REQUIRED" });
}
