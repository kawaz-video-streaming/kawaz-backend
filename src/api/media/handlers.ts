import { AmqpClient } from "@ido_kawaz/amqp-client";
import { NotFoundError, Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { StatusCodes } from "http-status-codes";
import { isEmpty, isNil } from "ramda";
import { Dals } from "../../dal/types";
import { requestHandlerDecorator } from "../../utils/decorator";
import { BucketsConfig } from "../../utils/types";
import { validateRequestWithId } from "../../utils/zod";
import { createMediaLogic } from "./logic";
import {
  validateCompleteUploadRequest,
  validateGetMovieTmdbDetailsRequest,
  validateInitiateUploadRequest,
  validateMediaUpdateRequest,
} from "./types";
import { TmdbClient } from "../../services/tmdbClient";

export const createMediaHandlers = (
  bucketsConfig: BucketsConfig,
  dals: Dals,
  amqpClient: AmqpClient,
  storageClient: StorageClient,
  tmdbClient: TmdbClient
) => {
  const logic = createMediaLogic(
    bucketsConfig,
    dals,
    amqpClient,
    storageClient,
    tmdbClient
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
    initiateUpload: requestHandlerDecorator(
      "initiate media upload",
      async (rawReq: Request, res: Response) => {
        const body = validateInitiateUploadRequest(rawReq);
        const result = await logic.initiateUpload(body);
        res.status(StatusCodes.OK).json(result);
      },
    ),
    completeUpload: requestHandlerDecorator(
      "complete media upload",
      async (rawReq: Request, res: Response) => {
        const { body: { mediaId } } = validateCompleteUploadRequest(rawReq);
        await logic.completeUpload(mediaId);
        res.status(StatusCodes.OK).json({ message: "Media processing started" });
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
    getMovieMediaTmdbDetails: requestHandlerDecorator(
      "get media movie info details",
      async (req: Request, res: Response) => {
        const { title, year } = validateGetMovieTmdbDetailsRequest(req);
        const details = await logic.getMovieMediaTmdbDetails(title, year);
        res.status(StatusCodes.OK).json(details);
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
