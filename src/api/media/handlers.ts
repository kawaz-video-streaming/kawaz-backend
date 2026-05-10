import { AmqpClient } from "@ido_kawaz/amqp-client";
import { NotFoundError, Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { StatusCodes } from "http-status-codes";
import { isEmpty, isNil } from "ramda";
import { Readable } from "stream";
import { MediaGenreDal } from "../../dal/mediaGenre";
import { TmdbClient } from "../../services/tmdbClient";
import { requestHandlerDecorator } from "../../utils/decorator";
import { BucketsConfig } from "../../utils/types";
import { validateRequestWithId } from "../../utils/zod";
import { createMediaLogic } from "./logic";
import { MediaAuthenticatedRequest } from "../types";
import {
  validateCompleteUploadRequest,
  validateGetCollectionTmdbDetailsRequest,
  validateGetEpisodeTmdbDetailsRequest,
  validateGetMovieTmdbDetailsRequest,
  validateGetShowTmdbDetailsRequest,
  validateGetTmdbPosterRequest,
  validateInitiateUploadRequest,
  validateMediaUpdateRequest,
} from "./types";

export const createMediaHandlers = (
  bucketsConfig: BucketsConfig,
  mediaGenreDal: MediaGenreDal,
  amqpClient: AmqpClient,
  storageClient: StorageClient,
  tmdbClient: TmdbClient
) => {
  const logicFactory = createMediaLogic(
    bucketsConfig,
    mediaGenreDal,
    amqpClient,
    storageClient,
    tmdbClient
  );
  return {
    getAllMedia: requestHandlerDecorator(
      "get all media",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const medias = await logicFactory(mediaDal, mediaCollectionDal).getAllMedia();
        if (isEmpty(medias)) {
          throw new NotFoundError("No media found");
        }
        res.status(StatusCodes.OK).json(medias);
      },
    ),
    getAllNoneCompletedMedia: requestHandlerDecorator(
      "get all none completed media",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const medias = await logicFactory(mediaDal, mediaCollectionDal).getAllNoneCompletedMedia();
        res.status(StatusCodes.OK).json(medias);
      },
    ),
    initiateUpload: requestHandlerDecorator(
      "initiate media upload",
      async (rawReq: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (rawReq as MediaAuthenticatedRequest);
        const body = validateInitiateUploadRequest(rawReq);
        const result = await logicFactory(mediaDal, mediaCollectionDal).initiateUpload(body);
        res.status(StatusCodes.OK).json(result);
      },
    ),
    completeUpload: requestHandlerDecorator(
      "complete media upload",
      async (rawReq: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (rawReq as MediaAuthenticatedRequest);
        const { body: { mediaId } } = validateCompleteUploadRequest(rawReq);
        await logicFactory(mediaDal, mediaCollectionDal).completeUpload(mediaId);
        res.status(StatusCodes.OK).json({ message: "Media processing started" });
      },
    ),
    deleteMedia: requestHandlerDecorator(
      "delete media",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const {
          params: { id: mediaId },
        } = validateRequestWithId(req);
        await logicFactory(mediaDal, mediaCollectionDal).deleteMedia(mediaId);
        res.status(StatusCodes.OK).json({ message: "Media deleted" });
      },
    ),
    updateMedia: requestHandlerDecorator(
      "update media",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const {
          params: { id: mediaId },
          body,
          thumbnail,
        } = validateMediaUpdateRequest(req);
        await logicFactory(mediaDal, mediaCollectionDal).updateMedia(mediaId, body, thumbnail);
        res.status(StatusCodes.OK).json({ message: "Media updated" });
      },
    ),
    getMedia: requestHandlerDecorator(
      "get media",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const {
          params: { id: mediaId },
        } = validateRequestWithId(req);
        const media = await logicFactory(mediaDal, mediaCollectionDal).getMedia(mediaId);
        if (isNil(media)) {
          throw new NotFoundError("Media not found");
        }
        res.status(StatusCodes.OK).json(media);
      },
    ),
    getMovieMediaTmdbDetails: requestHandlerDecorator(
      "get media movie info details",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const { title, year } = validateGetMovieTmdbDetailsRequest(req);
        const details = await logicFactory(mediaDal, mediaCollectionDal).getMovieMediaTmdbDetails(title, year);
        res.status(StatusCodes.OK).json(details);
      },
    ),
    getCollectionMediaTmdbDetails: requestHandlerDecorator(
      "get media collection info details",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const id = validateGetCollectionTmdbDetailsRequest(req);
        const details = await logicFactory(mediaDal, mediaCollectionDal).getCollectionMediaTmdbDetails(id);
        res.status(StatusCodes.OK).json(details);
      },
    ),
    getShowMediaTmdbDetails: requestHandlerDecorator(
      "get media show info details",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const { title, year } = validateGetShowTmdbDetailsRequest(req);
        const details = await logicFactory(mediaDal, mediaCollectionDal).getShowMediaTmdbDetails(title, year);
        res.status(StatusCodes.OK).json(details);
      },
    ),
    getEpisodeMediaTmdbDetails: requestHandlerDecorator(
      "get media episode info details",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const { showTitle, showYear, seasonNumber, episodeNumber } = validateGetEpisodeTmdbDetailsRequest(req);
        const details = await logicFactory(mediaDal, mediaCollectionDal).getEpisodeMediaTmdbDetails(showTitle, showYear, seasonNumber, episodeNumber);
        res.status(StatusCodes.OK).json(details);
      },
    ),
    getTmdbPoster: requestHandlerDecorator(
      "get tmdb poster image",
      async (req: Request, res: Response) => {
        const url = validateGetTmdbPosterRequest(req);
        const imageResponse = await fetch(url);
        if (!imageResponse.ok || !imageResponse.body) {
          throw new NotFoundError("TMDB poster not found");
        }
        res.setHeader("Content-Type", imageResponse.headers.get("content-type") ?? "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=172800");
        Readable.fromWeb(imageResponse.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
      },
    ),
    getMediaUploadProgress: requestHandlerDecorator(
      "get media upload progress",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const {
          params: { id: mediaId },
        } = validateRequestWithId(req);
        const progressStatus = await logicFactory(mediaDal, mediaCollectionDal).getMediaUploadProgress(mediaId);
        res.status(StatusCodes.OK).json(progressStatus);
      },
    ),
    getThumbnail: requestHandlerDecorator(
      "get media thumbnail",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const {
          params: { id: mediaId },
        } = validateRequestWithId(req);
        const thumbnail = await logicFactory(mediaDal, mediaCollectionDal).getThumbnail(mediaId);
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => thumbnail.destroy());
        thumbnail.pipe(res);
      },
    ),
    getTiles: requestHandlerDecorator(
      "get media tiles",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const videoId = req.params[0];
        const tiles = await logicFactory(mediaDal, mediaCollectionDal).getTiles(videoId);
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => tiles.destroy());
        tiles.pipe(res);
      },
    ),
    getManifest: requestHandlerDecorator(
      "get video manifest",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const videoId = req.params[0];
        const manifestStream = await logicFactory(mediaDal, mediaCollectionDal).getManifest(videoId);
        res.setHeader("Content-Type", "application/dash+xml");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => manifestStream.destroy());
        manifestStream.pipe(res);
      },
    ),
    getSegment: requestHandlerDecorator(
      "get video segment",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const videoId = req.params[0];
        const filename = req.params[1];
        const segmentStream = await logicFactory(mediaDal, mediaCollectionDal).getSegment(videoId, filename);
        res.setHeader("Content-Type", "video/iso.segment");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => segmentStream.destroy());
        segmentStream.pipe(res);
      },
    ),
    getVtt: requestHandlerDecorator(
      "get video vtt",
      async (req: Request, res: Response) => {
        const { mediaDal, mediaCollectionDal } = (req as MediaAuthenticatedRequest);
        const videoId = req.params[0];
        const filename = req.params[1];
        const vttStream = await logicFactory(mediaDal, mediaCollectionDal).getVtt(videoId, filename);
        res.setHeader("Content-Type", "text/vtt");
        res.setHeader('Cache-Control', 'public, max-age=172800');
        res.on('close', () => vttStream.destroy());
        vttStream.pipe(res);
      },
    ),
  };
};
