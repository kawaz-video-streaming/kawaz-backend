import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { MediaDal } from "../../dal/media";
import { cleanupPath } from "../../utils/files";
import { UploadConfig } from "./config";
import { ConvertMessage, Upload } from "./types";
import { createUploadFile } from "./utils";

export const uploadMediaHandler = (
    storageClient: StorageClient,
    { bucketsConfig: { kawazPlus: { kawazStorageBucket, uploadPrefix, thumbnailPrefix } }, partSize }: UploadConfig) =>
    async (payload: Upload) => {
        const { media, mediaPath, thumbnailPath } = payload;
        const uploadFile = createUploadFile(storageClient, payload, kawazStorageBucket);
        await uploadFile(mediaPath, `${uploadPrefix}/${media.fileName}`, { ensureBucket: true, multipartUpload: media.size > partSize });
        const thumbnailUploadKey = `${thumbnailPrefix}/${media._id}.jpg`;
        await uploadFile(thumbnailPath, thumbnailUploadKey);
    };

export const uploadSuccessHandler = (
    amqpClient: AmqpClient,
    mediaDal: MediaDal,
    { bucketsConfig: { kawazPlus: { kawazStorageBucket, uploadPrefix } } }: UploadConfig
) => async ({ media, mediaPath, thumbnailPath }: Upload) => {
    const message: ConvertMessage = {
        mediaId: media._id,
        mediaFileName: media.fileName,
        mediaStorageBucket: kawazStorageBucket,
        mediaRoutingKey: `${uploadPrefix}/${media.fileName}`
    };
    amqpClient.publish("convert", "convert.media", message);
    await mediaDal.updateMedia(media._id, { status: "processing", percentage: 20 });
    await cleanupPath(mediaPath);
    await cleanupPath(thumbnailPath);
};