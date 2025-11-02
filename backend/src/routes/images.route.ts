import { Router } from "express";
import { ImagesService } from "../services/images.service";
import { ImagesController } from "../controllers/images.controller";

export function createImagesRouter() {
  const router = Router();

  // DI
  const service = new ImagesService(process.env.UPLOADS_DIR);
  const controller = new ImagesController(service);

  router.get("/images/:imageId", controller.getById);

  return router;
}
