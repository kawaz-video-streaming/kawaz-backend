import { AmqpClient } from "@ido_kawaz/amqp-client";
import { Router } from "@ido_kawaz/server-framework";
import { VodClient } from "@ido_kawaz/vod-client";
import multer from "multer";
import { MediaDal } from "../../dal/media";
import { createMediaHandlers } from "./handlers";
import { requireAdmin } from "../middleware";

export const createMediaRouter = (mediaDal: MediaDal, amqpClient: AmqpClient, vodClient: VodClient) => {
  const mediaHandlers = createMediaHandlers(mediaDal, amqpClient, vodClient);
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
   *       200:
   *         description: Media upload started
   *       400:
   *         description: Bad request - file is required or invalid file type
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - admin only
   */
  router.post("/upload", requireAdmin, upload.single("file"), mediaHandlers.uploadMedia);

  /**
   * @openapi
   * /media/videos:
   *   get:
   *     summary: Get all videos metadata
   *     description: Returns metadata for all videos from the VOD service
   *     tags:
   *       - Media
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of videos
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Video'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Videos not found
   */
  router.get("/videos", mediaHandlers.getVideos);

  /**
   * @openapi
   * /media/videos/{id}:
   *   get:
   *     summary: Get a specific video metadata
   *     description: Returns metadata for a single video from the VOD service
   *     tags:
   *       - Media
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Video ID
   *     responses:
   *       200:
   *         description: Video metadata
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Video'
   *       401:
   *         description: Unauthorized
   */
  router.get("/videos/:id", mediaHandlers.getVideoById);

  /**
   * @openapi
   * /media/videos/{id}/manifest:
   *   get:
   *     summary: Get video manifest
   *     description: Returns the HLS manifest for a video
   *     tags:
   *       - Media
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Video ID
   *     responses:
   *       200:
   *         description: HLS manifest content
   *         content:
   *           application/vnd.apple.mpegurl:
   *             schema:
   *               type: string
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error - manifest not found or VOD service error
   */
  router.get("/videos/:id/manifest", mediaHandlers.getManifest);

  /**
   * @openapi
   * /media/videos/{id}/segments/{filename}:
   *   get:
   *     summary: Get segment URL
   *     description: Returns the URL for a specific video segment
   *     tags:
   *       - Media
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Video ID
   *       - in: path
   *         name: filename
   *         required: true
   *         schema:
   *           type: string
   *         description: Segment filename
   *     responses:
   *       200:
   *         description: Segment URL
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 url:
   *                   type: string
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error - segment not found or VOD service error
   */
  router.get("/videos/:id/segments/:filename", mediaHandlers.getSegmentUrl);

  /**
   * @openapi
   * /media/videos/{id}/vtt/{filename}:
   *   get:
   *     summary: Get VTT subtitle file
   *     description: Returns the VTT subtitle content for a video
   *     tags:
   *       - Media
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Video ID
   *       - in: path
   *         name: filename
   *         required: true
   *         schema:
   *           type: string
   *         description: VTT filename
   *     responses:
   *       200:
   *         description: VTT subtitle content
   *         content:
   *           text/vtt:
   *             schema:
   *               type: string
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error - VTT not found or VOD service error
   */
  router.get("/videos/:id/vtt/:filename", mediaHandlers.getVtt);

  return router;
};
