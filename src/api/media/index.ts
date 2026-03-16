import { AmqpClient } from "@ido_kawaz/amqp-client";
import { Router } from "@ido_kawaz/server-framework";
import multer from "multer";
import { MediaDal } from "../../dal/media";
import { createMediaHandlers } from "./handlers";

export const createMediaRouter = (mediaDal: MediaDal, amqpClient: AmqpClient) => {
  const mediaHandlers = createMediaHandlers(mediaDal, amqpClient);
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
   *               $ref: '#/components/schemas/BadRequestError'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InternalServerError'
   */
  router.post("/upload", upload.single("file"), mediaHandlers.uploadMedia);
  return router;
};
