import { Router } from "express";
import { StorageClient } from "@ido_kawaz/storage-client";
import { createMediaHandlers } from "./media.handlers";
import { MediaDal } from "../../models/media/media.dal";
import multer from "multer";

export const createMediaRouter = (mediaDal: MediaDal, storageClient: StorageClient) => {
  const mediaHandlers = createMediaHandlers(mediaDal, storageClient);
  const router = Router();
  const upload = multer({ storage: multer.diskStorage({ destination: './tmp' }) });

  /**
   * @openapi
   * /media/upload:
   *   post:
   *     summary: Upload a media file
   *     description: Upload a media file to storage and save metadata to database
   *     tags:
   *       - Media
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: The file to upload
   *     responses:
   *       201:
   *         description: Media uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UploadResponse'
   *       400:
   *         description: Bad request - file is required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post("/upload", upload.single("file"), mediaHandlers.uploadMedia);
  return router;
};
