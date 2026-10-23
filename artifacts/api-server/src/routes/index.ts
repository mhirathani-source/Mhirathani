import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubRouter from "./club";
import financeRouter from "./finance";
import whatsappRouter from "./whatsapp";
import adminRouter from "./admin";
import operationsRouter from "./operations";
import correctionsRouter from "./corrections";
import { requireClubUser } from "../middlewares/clubAuth";
import { financialAccess } from "../middlewares/financialAccess";
import { enforceBusinessSettings } from "../middlewares/businessSettings";

const router: IRouter = Router();

router.use(healthRouter);
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Cookie");
  res.vary("Authorization");
  // The session endpoint itself checks Clerk and can return role:null for
  // authenticated accounts that have not been approved for club access.
  if (req.path.replace(/\/$/, "") === "/club/session" && ["GET", "HEAD"].includes(req.method)) next();
  else requireClubUser(req, res, next);
});
router.use(financialAccess);
router.use(enforceBusinessSettings);
router.use(adminRouter);
router.use(operationsRouter);
router.use(correctionsRouter);
router.use(clubRouter);
router.use(financeRouter);
router.use(whatsappRouter);

export default router;
