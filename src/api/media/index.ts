import { AmqpClient } from "@ido_kawaz/amqp-client";
import { Router } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import multer from "multer";
import { MediaDal } from "../../dal/media";
import { BucketsConfig } from "../../utils/types";
import { requireAdmin } from "../middleware";
import { createMediaHandlers } from "./handlers";

export const createMediaRouter = (bucketsConfig: BucketsConfig, mediaDal: MediaDal, amqpClient: AmqpClient, storageClient: StorageClient) => {
  const mediaHandlers = createMediaHandlers(bucketsConfig, mediaDal, amqpClient, storageClient);
  const router = Router();
  // multer is kept for thumbnail-only updates (PUT /:id)
  const upload = multer({ storage: multer.diskStorage({ destination: './tmp' }) });

  /**
   * @openapi
   * /media:
   *   get:
   *     summary: Get all media
   *     description: Returns all ready media from the database 
   *     tags:
   *       - Media
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of media metadata
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Media'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Media not found
   */
  router.get("/", mediaHandlers.getAllMedia);

  /**
   * @openapi
   * /media/uploading:
   *   get:
   *     summary: Get all non-completed media
   *     description: Returns all media that are not yet completed (pending, processing, or failed)
   *     tags:
   *       - Media
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of non-completed media
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Media'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: No non-completed media found
   */
  router.get("/uploading", mediaHandlers.getAllNoneCompletedMedia);

  /**
   * @openapi
   * /media/upload/initiate:
   *   post:
   *     summary: Initiate a media upload
   *     description: Creates a media record and returns presigned PUT URLs for direct browser-to-storage upload.
   *     tags:
   *       - Media
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [title, fileName, fileSize, mimeType]
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               thumbnailFocalPoint:
   *                 type: object
   *                 properties:
   *                   x:
   *                     type: number
   *                   y:
   *                     type: number
   *               fileName:
   *                 type: string
   *               fileSize:
   *                 type: number
   *               mimeType:
   *                 type: string
   *               collectionId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Presigned upload URLs
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - admin only
   */
  router.post("/upload/initiate", requireAdmin, mediaHandlers.initiateUpload);

  /**
   * @openapi
   * /media/upload/complete:
   *   post:
   *     summary: Complete a media upload
   *     description: Signals that the browser has finished uploading to storage and triggers media processing.
   *     tags:
   *       - Media
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [mediaId]
   *             properties:
   *               mediaId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Media processing started
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - admin only
   *       404:
   *         description: Media not found or already processing
   */
  router.post("/upload/complete", requireAdmin, mediaHandlers.completeUpload);

  /**
   * @openapi
   * /media/{id}:
   *   put:
   *     summary: Update media metadata
   *     description: Update the title, description, or tags of a media
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
   *         description: Media ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               thumbnailFocalPoint:
   *                 type: object
   *                 properties:
   *                   x:
   *                     type: number
   *                   y:
   *                     type: number
   *     responses:
   *       200:
   *         description: Media updated successfully
   *       400:
   *         description: Bad request - invalid media ID or invalid request body
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - admin only
   *       404:
   *         description: Media not found
   */
  router.put("/:id", requireAdmin, upload.fields([{ name: "thumbnail", maxCount: 1 }]), mediaHandlers.updateMedia);

  /**
   * @openapi
   * /media/{id}:
   *   delete:
   *     summary: Delete a media
   *     description: Deletes a media from the database and storage
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
   *         description: Media ID
   *     responses:
   *       200:
   *         description: Media deleted successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - admin only
   *       404:
   *         description: Media not found
   *       500:
   *         description: Internal server error
   */
  router.delete("/:id", requireAdmin, mediaHandlers.deleteMedia);

  /**
  * @openapi
  * /media/{id}:
  *   get:
  *     summary: Get a specific media metadata
  *     description: Returns metadata for a single ready media from the database
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
  *         description: Media ID
  *     responses:
  *       200:
  *         description: Media metadata
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Media'
  *       401:
  *         description: Unauthorized
  *       404:
  *         description: Media not found
  */
  router.get("/:id", mediaHandlers.getMedia);

  /**
   * @openapi
   * /media/{id}/progress:
   *   get:
   *     summary: Get media upload progress
   *     description: Returns the upload progress for a specific media
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
   *         description: Media ID
   *     responses:
   *       200:
   *         description: Media upload progress
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 percentage:
   *                   type: number
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Media not found
   */
  router.get("/:id/progress", mediaHandlers.getMediaUploadProgress);

  /**
   * @openapi
   * /media/{id}/thumbnail:
   *   get:
   *     summary: Get media thumbnail
   *     description: Streams the media thumbnail directly as JPEG
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
   *         description: Media ID
   *     responses:
   *       200:
   *         description: Thumbnail image binary data (image/jpeg)
   *         content:
   *           image/jpeg:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Media not found
   *       500:
   *         description: Internal server error - thumbnail not found or storage service error
   */
  router.get("/:id/thumbnail", mediaHandlers.getThumbnail);


  /**
   * @openapi
   * /media/stream/{id}/output.mpd:
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
  router.get(/^\/stream\/([^/]+)\/output\.mpd$/, mediaHandlers.getManifest);

  /**
   * @openapi
   * /media/stream/{id}/{filename}.m4s:
   *   get:
   *     summary: Get video segment
   *     description: Streams a specific video segment (.m4s files only) as binary data
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
   *       200:
   *         description: Video segment binary data (video/iso.segment)
   *         content:
   *           video/iso.segment:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error - segment not found or VOD service error
   */
  router.get(/^\/stream\/([^/]+)\/([^/]+\.m4s)$/, mediaHandlers.getSegment);

  /**
   * @openapi
   * /media/stream/{id}/thumbnails.jpg:
   *   get:
   *     summary: Get video tiles
   *     description: Streams the video sprite-sheet tile thumbnails directly as JPEG
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
   *           pattern: '^.+\.jpg$'
   *         description: Tile filename (must end in .jpg)
   *     responses:
   *       200:
   *         description: Tile image binary data (image/jpeg)
   *         content:
   *           image/jpeg:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error - tiles not found or VOD service error
   */
  router.get(/^\/stream\/([^/]+)\/thumbnails\.jpg$/, mediaHandlers.getTiles);

  /**
   * @openapi
   * /media/stream/{id}/{filename}.vtt:
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
  router.get(/^\/stream\/([^/]+)\/([^/]+\.vtt)$/, mediaHandlers.getVtt);

  return router;
};
