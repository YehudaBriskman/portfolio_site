import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getContributionYear } from "../services/contributions.js";
import { GithubController } from "../controllers/github.controller.js";

/*
 * One endpoint, one array.
 *
 * The service is injected as a thunk rather than imported by the controller,
 * which is what lets a test drive the controller with a fixed year and no
 * network — the same shape `createImagesRouter` uses for its service.
 */
export function createGithubRouter() {
  const router = Router();
  const controller = new GithubController(() => getContributionYear());

  router.get("/contributions", asyncHandler(controller.getContributions));

  return router;
}
