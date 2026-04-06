import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC } from "../../background/upload/binding";
import { Upload } from "../../background/upload/types";
import { MediaDal } from "../../dal/media";
import { MediaConfig, MediaUpdateRequestBody, UploadedFile } from "./types";

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

export const createMediaLogic = (
  { vodStorageBucket, uploadStorageBucket, uploadKeyPrefix }: MediaConfig,
  mediaDal: MediaDal,
  amqpClient: AmqpClient,
  storageClient: StorageClient,
) => ({
  uploadMedia: async (body: MediaUpdateRequestBody, mediaFile: UploadedFile, thumbnail: UploadedFile) => {
    const { originalname, size, path } = mediaFile;
    const { title, description, tags, thumbnailFocalPoint } = body;
    const media = await mediaDal.createMedia(title, tags, originalname, size, thumbnailFocalPoint, description);
    amqpClient.publish<Upload>(UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC, { media, mediaPath: path, thumbnailPath: thumbnail.path });
  },
  deleteMedia: async (mediaId: string) => {
    await mediaDal.deleteMedia(mediaId);
    await storageClient.clearPrefix(vodStorageBucket, `${mediaId}`);
  },
  updateMedia: async (mediaId: string, update: MediaUpdateRequestBody) => mediaDal.updateMedia(mediaId, update),
  getAllMedia: () => mediaDal.getAllMedia(),
  getMedia: (mediaId: string) => mediaDal.getMedia(mediaId),
  getThumbnail: (mediaId: string) => storageClient.getPresignedUrl(uploadStorageBucket, `${uploadKeyPrefix}/thumbnails/${mediaId}.jpg`, PRESIGNED_URL_EXPIRY_SECONDS),
  getManifest: (mediaId: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/output.mpd`),
  getSegmentUrl: (mediaId: string, filename: string) => storageClient.getPresignedUrl(vodStorageBucket, `${mediaId}/${filename}`, PRESIGNED_URL_EXPIRY_SECONDS),
  getVtt: (mediaId: string, filename: string) => storageClient.downloadObject(vodStorageBucket, `${mediaId}/${filename}`),
});
