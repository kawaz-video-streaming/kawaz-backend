import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC } from "../../background/upload/binding";
import { Upload } from "../../background/upload/types";
import { MediaDal } from "../../dal/media";
import { MediaConfig, MediaUpdateRequestBody } from "./types";
import { UploadedFile } from "../../utils/types";

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

export const createMediaLogic = (
  { vodStorageBucket, uploadStorageBucket, uploadKeyPrefix }: MediaConfig,
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
    await storageClient.deleteObject(uploadStorageBucket, `${uploadKeyPrefix}/thumbnails/${mediaId}.jpg`);
  },
  updateMedia: async (mediaId: string, update: MediaUpdateRequestBody, thumbnail?: UploadedFile) => {
    await mediaDal.updateMedia(mediaId, update);
    if (thumbnail) {
      const thumbnailData = createReadStream(thumbnail.path);
      const thumbnailObject: StorageObject = { key: `${uploadKeyPrefix}/thumbnails/${mediaId}.jpg`, data: thumbnailData };
      await storageClient.uploadObject(uploadStorageBucket, thumbnailObject);
    }
  },
  getAllMedia: () => mediaDal.getAllMedia(),
  getMedia: (mediaId: string) => mediaDal.getMedia(mediaId),
  getTiles: (mediaId: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/thumbnails.jpg`),
  getThumbnail: (mediaId: string) => storageClient.getPresignedUrl(uploadStorageBucket, `${uploadKeyPrefix}/thumbnails/${mediaId}.jpg`, PRESIGNED_URL_EXPIRY_SECONDS),
  getManifest: (mediaId: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/output.mpd`),
  getSegmentUrl: (mediaId: string, filename: string) => storageClient.getPresignedUrl(vodStorageBucket, `${mediaId}/${filename}`, PRESIGNED_URL_EXPIRY_SECONDS),
  getVtt: (mediaId: string, filename: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/${filename}`),
});
