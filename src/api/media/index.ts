import { AmqpClient } from "@ido_kawaz/amqp-client";
import { Router } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import multer from "multer";
import { MediaDal } from "../../dal/media";
import { requireAdmin } from "../middleware";
import { createMediaHandlers } from "./handlers";
import { MediaConfig } from "./types";

export const createMediaRouter = (mediaConfig: MediaConfig, mediaDal: MediaDal, amqpClient: AmqpClient, storageClient: StorageClient) => {
  const mediaHandlers = createMediaHandlers(mediaConfig, mediaDal, amqpClient, storageClient);
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
   *       404:
   *         description: Video not found
   */
  router.get("/videos/:id", mediaHandlers.getVideoById);

  /**
   * @openapi
   * /media/videos/{id}/output.mpd:
   *   get:
   *     summary: Get video manifest
   *     description: Returns the MPEG-DASH manifest for a video as a stream
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
   *         description: MPEG-DASH manifest content
   *         content:
   *           application/dash+xml:
   *             schema:
   *               type: string
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error - manifest not found or VOD service error
   */
  router.get(/^\/videos\/([^/]+)\/output\.mpd$/, mediaHandlers.getManifest);

  /**
   * @openapi
   * /media/videos/{id}/{filename}.m4s:
   *   get:
   *     summary: Get video segment
   *     description: Redirects to the URL for a specific video segment (.m4s files only)
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
   *           pattern: '^.+\.m4s$'
   *         description: Segment filename (must end in .m4s)
   *     responses:
   *       302:
   *         description: Redirects to the segment URL
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error - segment not found or VOD service error
   */
  router.get(/^\/videos\/([^/]+)\/([^/]+\.m4s)$/, mediaHandlers.getSegment);

  /**
   * @openapi
   * /media/videos/{id}/{filename}.vtt:
   *   get:
   *     summary: Get VTT subtitle file
   *     description: Returns the VTT subtitle content for a video (.vtt files only)
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
   *           pattern: '^.+\.vtt$'
   *         description: VTT filename (must end in .vtt)
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
  router.get(/^\/videos\/([^/]+)\/([^/]+\.vtt)$/, mediaHandlers.getVtt);

  return router;
};
