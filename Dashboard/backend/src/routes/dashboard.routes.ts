import { Router } from 'express';
import * as controller from '../controllers/dashboard.controller';

export const dashboardRoutes = Router();

dashboardRoutes.get('/overview', controller.getOverview);
dashboardRoutes.get('/live', controller.getLiveFeed);
dashboardRoutes.get('/quality', controller.getQualityMetrics);
dashboardRoutes.get('/machines/:id/lifetime', controller.getMachineLifetime);
dashboardRoutes.get('/users/:id/lifetime', controller.getUserLifetime);
dashboardRoutes.get('/impact', controller.getImpactMetrics);
dashboardRoutes.get('/stream', controller.streamDashboardEvents);

export default dashboardRoutes;
