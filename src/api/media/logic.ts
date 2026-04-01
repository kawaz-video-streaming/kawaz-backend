import { AmqpClient } from "@ido_kawaz/amqp-client";
import { RequestFile } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC } from "../../background/upload/binding";
import { Upload } from "../../background/upload/types";
import { MediaDal } from "../../dal/media";
import { MediaConfig } from "./types";

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

export const createMediaLogic = (
  { vodStorageBucket }: MediaConfig,
  mediaDal: MediaDal,
  amqpClient: AmqpClient,
  storageClient: StorageClient,
) => ({
  uploadMedia: async ({ path, originalname, size }: RequestFile) => {
    const media = await mediaDal.createMedia(originalname, size);
    amqpClient.publish<Upload>(UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC, { media, path });
  },
  getVideos: async () => mediaDal.getMedias(),
  getVideoById: async (videoId: string) => mediaDal.getMediaById(videoId),
  getManifest: async (videoId: string) => storageClient.downloadObject(vodStorageBucket, `${videoId}/manifest.mpd`),
  getSegmentUrl: async (videoId: string, filename: string) => storageClient.getPresignedUrl(vodStorageBucket, `${videoId}/${filename}`, PRESIGNED_URL_EXPIRY_SECONDS),
  getVtt: (videoId: string, filename: string) => storageClient.downloadObject(vodStorageBucket, `${videoId}/${filename}`),
});
