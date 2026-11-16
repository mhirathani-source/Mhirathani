import express, { type Express } from "express";
import { MembershipError } from "./lib/membership";
import { ZodError } from "zod/v4";
import pinoHttp from "pino-http";
import router from "./routes";
import iraqAttendanceRouter from "./routes/iraqAttendance";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use(express.json({ limit: "13mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
if (process.env.IRAQ_INSTANCE === "1") {
  app.use("/api/iraq/attendance", iraqAttendanceRouter);
}
app.use(((error, _req, res, _next) => {
  if (res.headersSent) return;
  if (error instanceof MembershipError) { res.status(error.status).json({ error: error.message, ...(error.canArchive ? {canArchive:true}: {}) }); return; }
  if (error instanceof ZodError) { res.status(400).json({ error: "صيغة الطلب أو المعرّفات غير صحيحة؛ تحقق من الحقول المطلوبة" }); return; }
  const code = (error as { code?: string; status?: number }).code;
  if (code === "23505") { res.status(409).json({ error: "السجل موجود بالفعل؛ لم تُحفظ عملية مكررة" }); return; }
  if (code === "23503") { res.status(409).json({ error: "السجل مرتبط ببيانات أخرى؛ استخدم الأرشفة أو الإلغاء بدل الحذف" }); return; }
  if ((error as { status?: number }).status === 413) { res.status(413).json({ error: "حجم الملف أكبر من الحد المسموح" }); return; }
  if ((error as { type?: string }).type === "entity.parse.failed") { res.status(400).json({ error: "صيغة الطلب غير صالحة" }); return; }
  logger.error({ code: code ?? "unhandled" }, "API operation failed");
  res.status(500).json({ error: "تعذر تنفيذ العملية؛ لم يتم تأكيد نجاحها. أعد المحاولة أو راجع سجل المدير." });
}) as express.ErrorRequestHandler);

export default app;
