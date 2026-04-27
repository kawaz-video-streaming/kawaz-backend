import { AmqpClient } from "@ido_kawaz/amqp-client";
import { NotFoundError } from "@ido_kawaz/server-framework";
import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { ConvertMessage } from "../../background/upload/types";
import { MediaDal } from "../../dal/media";
import { cleanupPath } from "../../utils/files";
import { BucketsConfig, UploadedFile } from "../../utils/types";
import { InitiateUploadRequestBody, InitiateUploadResponse, MediaUpdateRequestBody } from "./types";
import { isNil } from "ramda";

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

export const createMediaLogic = (
  {
    vod: { vodStorageBucket },
    kawazPlus: { kawazStorageBucket: kawazBucket, uploadPrefix, thumbnailPrefix }
  }: BucketsConfig,
  mediaDal: MediaDal,
  amqpClient: AmqpClient,
  storageClient: StorageClient,
) => ({
  initiateUpload: async (body: InitiateUploadRequestBody): Promise<InitiateUploadResponse> => {
    const { fileName, fileSize, mimeType: _mimeType, ...mediaBody } = body;
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
    await mediaDal.updateMedia(mediaId, update);
    if (thumbnail) {
      const thumbnailData = createReadStream(thumbnail.path);
      const thumbnailObject: StorageObject = { key: `${thumbnailPrefix}/${mediaId}.jpg`, data: thumbnailData };
      await storageClient.uploadObject(kawazBucket, thumbnailObject);
      await cleanupPath(thumbnail.path);
    }
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
