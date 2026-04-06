import { AmqpClient } from '@ido_kawaz/amqp-client';
import { NotFoundError, Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from '@ido_kawaz/storage-client';
import { StatusCodes } from "http-status-codes";
import { isEmpty, isNil } from 'ramda';
import { MediaDal } from '../../dal/media';
import { requestHandlerDecorator } from "../../utils/decorator";
import { createMediaLogic } from './logic';
import { MediaConfig, validateMediaRequestWithId, validateMediaUpdateRequest, validateMediaUploadRequest } from './types';

export const createMediaHandlers = (mediaConfig: MediaConfig, mediaDal: MediaDal, amqpClient: AmqpClient, storageClient: StorageClient) => {
    const logic = createMediaLogic(mediaConfig, mediaDal, amqpClient, storageClient);
    return {
        getAllMedia:
            requestHandlerDecorator(
                'get all media',
                async (_req: Request, res: Response) => {
                    const medias = await logic.getAllMedia();
                    if (isEmpty(medias)) {
                        throw new NotFoundError('No media found');
                    }
                    res.status(StatusCodes.OK).json(medias);
                }),
        uploadMedia:
            requestHandlerDecorator(
                'upload media',
                async (rawReq: Request, res: Response) => {
                    const { body, file, thumbnail } = validateMediaUploadRequest(rawReq);
                    await logic.uploadMedia(body, file, thumbnail);
                    res.status(StatusCodes.OK).json({ message: 'Media Started Uploading' });
                }),
        deleteMedia:
            requestHandlerDecorator(
                'delete media',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaId } } = validateMediaRequestWithId(req);
                    await logic.deleteMedia(mediaId);
                    res.status(StatusCodes.OK).json({ message: 'Media deleted' });
                }),
        updateMedia:
            requestHandlerDecorator(
                'update media',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaId }, body } = validateMediaUpdateRequest(req);
                    await logic.updateMedia(mediaId, body);
                    res.status(StatusCodes.OK).json({ message: 'Media updated' });
                }),
        getMedia:
            requestHandlerDecorator(
                'get media',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaId } } = validateMediaRequestWithId(req);
                    const media = await logic.getMedia(mediaId);
                    if (isNil(media)) {
                        throw new NotFoundError('Media not found');
                    }
                    res.status(StatusCodes.OK).json(media);
                }),
        getThumbnail:
            requestHandlerDecorator(
                'get media thumbnail',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaId } } = validateMediaRequestWithId(req);
                    const thumbnailPresignedUrl = await logic.getThumbnail(mediaId);
                    res.setHeader("Content-Type", "image/jpeg");
                    res.redirect(thumbnailPresignedUrl);
                }),
        getTiles:
            requestHandlerDecorator(
                'get media tiles',
                async (req: Request, res: Response) => {
                    const videoId = req.params[0];
                    const tilesStream = await logic.getTiles(videoId);
                    res.setHeader("Content-Type", "image/jpeg");
                    tilesStream.pipe(res);
                }),
        getManifest:
            requestHandlerDecorator(
                'get video manifest',
                async (req: Request, res: Response) => {
                    const videoId = req.params[0];
                    const manifestStream = await logic.getManifest(videoId);
                    res.setHeader("Content-Type", "application/dash+xml");
                    manifestStream.pipe(res);
                }),
        getSegment:
            requestHandlerDecorator(
                'get video segment',
                async (req: Request, res: Response) => {
                    const videoId = req.params[0];
                    const filename = req.params[1];
                    const segmentPresignedUrl = await logic.getSegmentUrl(videoId, filename);
                    res.setHeader("Content-Type", "video/iso.segment");
                    res.redirect(segmentPresignedUrl);
                }),
        getVtt:
            requestHandlerDecorator(
                'get video vtt',
                async (req: Request, res: Response) => {
                    const videoId = req.params[0];
                    const filename = req.params[1];
                    const vttStream = await logic.getVtt(videoId, filename);
                    res.setHeader("Content-Type", "text/vtt");
                    vttStream.pipe(res);
                }),
    }
};