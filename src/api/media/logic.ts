import { AmqpClient } from "@ido_kawaz/amqp-client";
import { NotFoundError } from "@ido_kawaz/server-framework";
import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { isNil } from "ramda";
import { Dals } from "../../dal/types";
import { cleanupPath } from "../../utils/files";
import { BucketsConfig, UploadedFile } from "../../utils/types";
import { ConvertMessage, InitiateUploadRequestBody, InitiateUploadResponse, MediaUpdateRequestBody } from "./types";
import { validateMediaContainingCollectionAndGenre } from "./utils";
import { TmdbClient } from "../../services/tmdbClient";

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

export const createMediaLogic = (
  {
    vod: { vodStorageBucket },
    kawazPlus: { kawazStorageBucket: kawazBucket, uploadPrefix, thumbnailPrefix }
  }: BucketsConfig,
  { mediaDal, mediaCollectionDal, mediaGenreDal }: Dals,
  amqpClient: AmqpClient,
  storageClient: StorageClient,
  tmdbClient: TmdbClient
) => ({
  initiateUpload: async (body: InitiateUploadRequestBody): Promise<InitiateUploadResponse> => {
    const { fileName, fileSize, mimeType: _mimeType, ...mediaBody } = body;
    const { kind, genres, collectionId: containingCollectionId } = mediaBody;
    await validateMediaContainingCollectionAndGenre(mediaCollectionDal, mediaGenreDal, genres, kind, containingCollectionId);
    await storageClient.ensureBucket(kawazBucket);
    const media = await mediaDal.createMedia({ ...mediaBody, fileName, size: fileSize });
    const videoKey = `${uploadPrefix}/${fileName}`;
    const thumbnailKey = `${thumbnailPrefix}/${media._id}.jpg`;
    const [videoUploadUrl, thumbnailUploadUrl] = await Promise.all([
      storageClient.getPutPresignedUrl(kawazBucket, videoKey, PRESIGNED_URL_EXPIRY_SECONDS),
      storageClient.getPutPresignedUrl(kawazBucket, thumbnailKey, PRESIGNED_URL_EXPIRY_SECONDS),
    ]);
    return { mediaId: media._id, videoUploadUrl, thumbnailUploadUrl };
  },
  completeUpload: async (mediaId: string): Promise<void> => {
    const media = await mediaDal.getPendingMedia(mediaId);
    if (isNil(media)) {
      throw new NotFoundError("Media not found or already processing");
    }
    const message: ConvertMessage = {
      mediaId: media._id,
      mediaFileName: media.fileName,
      mediaStorageBucket: kawazBucket,
      mediaRoutingKey: `${uploadPrefix}/${media.fileName}`,
    };
    amqpClient.publish("convert", "convert.media", message);
    await mediaDal.updateMedia(media._id, { status: "processing", percentage: 20 });
  },
  deleteMedia: async (mediaId: string) => {
    await mediaDal.deleteMedia(mediaId);
    await storageClient.clearPrefix(vodStorageBucket, mediaId);
    await storageClient.deleteObject(kawazBucket, `${thumbnailPrefix}/${mediaId}.jpg`);
  },
  updateMedia: async (mediaId: string, update: MediaUpdateRequestBody, thumbnail?: UploadedFile) => {
    const { genres, kind, collectionId } = update;
    await validateMediaContainingCollectionAndGenre(mediaCollectionDal, mediaGenreDal, genres, kind, collectionId);
    await mediaDal.updateMedia(mediaId, update);
    if (thumbnail) {
      const thumbnailData = createReadStream(thumbnail.path);
      const thumbnailObject: StorageObject = { key: `${thumbnailPrefix}/${mediaId}.jpg`, data: thumbnailData };
      await storageClient.uploadObject(kawazBucket, thumbnailObject);
      await cleanupPath(thumbnail.path);
    }
  },
  getMovieMediaTmdbDetails: async (title: string, year: number) => {
    return tmdbClient.getMovieDetails(title, year);
  },
  getCollectionMediaTmdbDetails: async (id: number) => {
    return tmdbClient.getCollectionDetails(id);
  },
  getShowMediaTmdbDetails: async (title: string, year: number) => {
    return tmdbClient.getShowDetails(title, year);
  },
  getEpisodeMediaTmdbDetails: async (showTitle: string, showYear: number, seasonNumber: number, episodeNumber: number) => {
    return tmdbClient.getEpisodeDetails(showTitle, showYear, seasonNumber, episodeNumber);
  },
  getAllMedia: () => mediaDal.getAllMedia(),
  getAllNoneCompletedMedia: () => mediaDal.getAllNoneCompletedMedia(),
  getMedia: (mediaId: string) => mediaDal.getMedia(mediaId),
  getMediaUploadProgress: async (mediaId: string) => mediaDal.getMediaUploadProgress(mediaId),
  getTiles: (mediaId: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/thumbnails.jpg`),
  getThumbnail: (mediaId: string) => storageClient.downloadObject(kawazBucket, `${thumbnailPrefix}/${mediaId}.jpg`),
  getManifest: (mediaId: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/output.mpd`),
  getSegment: (mediaId: string, filename: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/${filename}`),
  getVtt: (mediaId: string, filename: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/${filename}`),
});
