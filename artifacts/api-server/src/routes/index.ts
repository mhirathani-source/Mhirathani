import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubRouter from "./club";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubRouter);

export default router;
