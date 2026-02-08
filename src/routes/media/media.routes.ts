import { Router } from "express";
import { StorageClient } from "../../services/storageClient";
import { createMediaHandlers } from "./media.handlers";
// import { MediaDal } from "../../models/media/media.dal";
import multer from "multer";

export const createMediaRouter = (/*mediaDal: MediaDal,*/ storageClient: StorageClient) => {
  const mediaHandlers = createMediaHandlers(/*mediaDal,*/ storageClient);
  const router = Router();
  const upload = multer();
  router.post("/upload", upload.single("file"), mediaHandlers.uploadMedia);
  return router;
};
