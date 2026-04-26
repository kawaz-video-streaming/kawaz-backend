import { AmqpClient } from "@ido_kawaz/amqp-client";
import { NotFoundError, Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { StatusCodes } from "http-status-codes";
import { isEmpty, isNil } from "ramda";
import { MediaDal } from "../../dal/media";
import { requestHandlerDecorator } from "../../utils/decorator";
import { BucketsConfig } from "../../utils/types";
import { validateRequestWithId } from "../../utils/zod";
import { createMediaLogic } from "./logic";
import {
  validateMediaUpdateRequest,
  validateMediaUploadRequest,
} from "./types";

export const createMediaHandlers = (
  bucketsConfig: BucketsConfig,
  mediaDal: MediaDal,
  amqpClient: AmqpClient,
  storageClient: StorageClient,
) => {
  const logic = createMediaLogic(
    bucketsConfig,
    mediaDal,
    amqpClient,
    storageClient,
  );
  return {
    getAllMedia: requestHandlerDecorator(
      "get all media",
      async (_req: Request, res: Response) => {
        const medias = await logic.getAllMedia();
        if (isEmpty(medias)) {
          throw new NotFoundError("No media found");
        }
        res.status(StatusCodes.OK).json(medias);
      },
    ),
    getAllNoneCompletedMedia: requestHandlerDecorator(
      "get all none completed media",
      async (_req: Request, res: Response) => {
        const medias = await logic.getAllNoneCompletedMedia();
        res.status(StatusCodes.OK).json(medias);
      },
    ),
    uploadMedia: requestHandlerDecorator(
      "upload media",
      async (rawReq: Request, res: Response) => {
        const { body, file, thumbnail } = validateMediaUploadRequest(rawReq);
        const mediaId = await logic.uploadMedia(body, file, thumbnail);
        res
          .status(StatusCodes.OK)
          .json({ message: "Media Started Uploading", mediaId });
      },
    ),
    deleteMedia: requestHandlerDecorator(
      "delete media",
      async (req: Request, res: Response) => {
        const {
          params: { id: mediaId },
        } = validateRequestWithId(req);
        await logic.deleteMedia(mediaId);
        res.status(StatusCodes.OK).json({ message: "Media deleted" });
      },
    ),
    updateMedia: requestHandlerDecorator(
      "update media",
      async (req: Request, res: Response) => {
        const {
          params: { id: mediaId },
          body,
          thumbnail,
        } = validateMediaUpdateRequest(req);
        await logic.updateMedia(mediaId, body, thumbnail);
        res.status(StatusCodes.OK).json({ message: "Media updated" });
      },
    ),
    getMedia: requestHandlerDecorator(
      "get media",
      async (req: Request, res: Response) => {
        const {
          params: { id: mediaId },
        } = validateRequestWithId(req);
        const media = await logic.getMedia(mediaId);
        if (isNil(media)) {
          throw new NotFoundError("Media not found");
        }
        res.status(StatusCodes.OK).json(media);
      },
    ),
    getMediaUploadProgress: requestHandlerDecorator(
      "get media upload progress",
      async (req: Request, res: Response) => {
        const {
          params: { id: mediaId },
        } = validateRequestWithId(req);
        const progressStatus = await logic.getMediaUploadProgress(mediaId);
        res.status(StatusCodes.OK).json(progressStatus);
      },
    ),
    getThumbnail: requestHandlerDecorator(
      "get media thumbnail",
      async (req: Request, res: Response) => {
        const {
          params: { id: mediaId },
        } = validateRequestWithId(req);
        const thumbnail = await logic.getThumbnail(mediaId);
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => thumbnail.destroy());
        thumbnail.pipe(res);
      },
    ),
    getTiles: requestHandlerDecorator(
      "get media tiles",
      async (req: Request, res: Response) => {
        const videoId = req.params[0];
        const tiles = await logic.getTiles(videoId);
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => tiles.destroy());
        tiles.pipe(res);
      },
    ),
    getManifest: requestHandlerDecorator(
      "get video manifest",
      async (req: Request, res: Response) => {
        const videoId = req.params[0];
        const manifestStream = await logic.getManifest(videoId);
        res.setHeader("Content-Type", "application/dash+xml");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => manifestStream.destroy());
        manifestStream.pipe(res);
      },
    ),
    getSegment: requestHandlerDecorator(
      "get video segment",
      async (req: Request, res: Response) => {
        const videoId = req.params[0];
        const filename = req.params[1];
        const segmentStream = await logic.getSegment(videoId, filename);
        res.setHeader("Content-Type", "video/iso.segment");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => segmentStream.destroy());
        segmentStream.pipe(res);
      },
    ),
    getVtt: requestHandlerDecorator(
      "get video vtt",
      async (req: Request, res: Response) => {
        const videoId = req.params[0];
        const filename = req.params[1];
        const vttStream = await logic.getVtt(videoId, filename);
        res.setHeader("Content-Type", "text/vtt");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => vttStream.destroy());
        vttStream.pipe(res);
      },
    ),
  };
};
