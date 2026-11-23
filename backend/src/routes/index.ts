import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { gameRoutes } from './game.routes.js';
import { mountRoutes, RouteDef } from './registry.js';
import { rewardRoutes } from './reward.routes.js';
import { shopRoutes } from './shop.routes.js';
import { friendRoutes, leaderboardRoutes, matchmakingRoutes, notificationRoutes, roomRoutes, statsRoutes } from './social.routes.js';
import { systemRoutes } from './system.routes.js';
import { userRoutes } from './user.routes.js';

/** Every REST endpoint (also the input for OpenAPI + docs/API.md). */
export const allRoutes: RouteDef[] = [
  ...systemRoutes,
  ...authRoutes,
  ...userRoutes,
  ...gameRoutes,
  ...roomRoutes,
  ...matchmakingRoutes,
  ...friendRoutes,
  ...leaderboardRoutes,
  ...statsRoutes,
  ...notificationRoutes,
  ...rewardRoutes,
  ...shopRoutes,
];

export function buildApiRouter(): Router {
  const router = Router();
  mountRoutes(router, allRoutes);
  return router;
}
