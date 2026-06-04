import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorMiddleware } from "./middleware/error.middleware";
import { notFoundMiddleware } from "./middleware/notFound.middleware";
import { adminRoutes } from "./modules/admin/admin.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { campaignRoutes } from "./modules/campaigns/campaign.routes";
import { contributionRoutes } from "./modules/contributions/contribution.routes";
import { leaderboardRoutes } from "./modules/leaderboard/leaderboard.routes";
import { machineRoutes } from "./modules/machines/machine.routes";
import { milestoneRoutes } from "./modules/milestones/milestone.routes";
import { operatorRoutes } from "./modules/operator/operator.routes";
import { partnerRoutes } from "./modules/partners/partner.routes";
import { pointRoutes } from "./modules/points/point.routes";
import { rewardRoutes } from "./modules/rewards/reward.routes";
import { userRoutes } from "./modules/users/user.routes";
import { voucherRoutes } from "./modules/vouchers/voucher.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "GreenPoint API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/machines", machineRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/points", pointRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/wallet", voucherRoutes);
app.use("/api/operator", operatorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/campaigns", campaignRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
