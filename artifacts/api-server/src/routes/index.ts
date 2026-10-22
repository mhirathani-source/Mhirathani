import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubRouter from "./club";
import financeRouter from "./finance";
import whatsappRouter from "./whatsapp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubRouter);
router.use(financeRouter);
router.use(whatsappRouter);

export default router;
