import { Router } from "express";
import { ImagesService } from "../services/images.service";
import { ImagesController } from "../controllers/images.controller";
import { mediaController } from "../controllers/media.controller";
import { asyncHandler } from "../middlewares/asyncHandler";

export function createImagesRouter() {
  const router = Router();

  // DI
  const service = new ImagesService(process.env.UPLOADS_DIR);
  const controller = new ImagesController(service);

  // The media library (#253). Two segments or more, so never shadowed by the one below.
  router.get("/media/:id", asyncHandler(mediaController.redirect));
  router.get("/media/:id/meta", asyncHandler(mediaController.meta));
  router.get("/m/:id/:file", asyncHandler(mediaController.file));

  router.get("/:imageId", controller.getById);

  return router;
}
