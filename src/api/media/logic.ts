import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC } from "../../background/upload/binding";
import { Upload } from "../../background/upload/types";
import { MediaDal } from "../../dal/media";
import { cleanupPath } from "../../utils/files";
import { BucketsConfig, PRESIGNED_URL_EXPIRY_SECONDS, UploadedFile } from "../../utils/types";
import { MediaUpdateRequestBody } from "./types";

export const createMediaLogic = (
  { vod: { vodStorageBucket }, kawazPlus: { kawazStorageBucket: kawazBucket, thumbnailPrefix } }: BucketsConfig,
  mediaDal: MediaDal,
  amqpClient: AmqpClient,
  storageClient: StorageClient,
) => ({
  uploadMedia: async (body: MediaUpdateRequestBody, mediaFile: UploadedFile, thumbnail: UploadedFile) => {
    const media = await mediaDal.createMedia({ ...body, ...mediaFile });
    amqpClient.publish<Upload>(UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC, { media, mediaPath: mediaFile.path, thumbnailPath: thumbnail.path });
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
  getMedia: (mediaId: string) => mediaDal.getMedia(mediaId),
  getTiles: (mediaId: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/thumbnails.jpg`),
  getThumbnail: (mediaId: string) => storageClient.getPresignedUrl(kawazBucket, `${thumbnailPrefix}/${mediaId}.jpg`, PRESIGNED_URL_EXPIRY_SECONDS),
  getManifest: (mediaId: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/output.mpd`),
  getSegmentUrl: (mediaId: string, filename: string) => storageClient.getPresignedUrl(vodStorageBucket, `${mediaId}/${filename}`, PRESIGNED_URL_EXPIRY_SECONDS),
  getVtt: (mediaId: string, filename: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/${filename}`),
});
