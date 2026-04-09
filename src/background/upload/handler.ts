import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { MediaDal } from "../../dal/media";
import { cleanupPath } from "../../utils/files";
import { UploadConfig } from "./config";
import { ConvertMessage, Upload } from "./types";
import { createUploadFile } from "./utils";

export const uploadMediaHandler = (storageClient: StorageClient, { uploadStorageBucket, uploadKeyPrefix, partSize }: UploadConfig) =>
    async (payload: Upload) => {
        const { media, mediaPath, thumbnailPath } = payload;
        const uploadFile = createUploadFile(storageClient, payload, uploadStorageBucket);
        await uploadFile(mediaPath, `${uploadKeyPrefix}/${media.fileName}`, { ensureBucket: true, multipartUpload: media.size > partSize });
        const thumbnailUploadKey = `${uploadKeyPrefix}/thumbnails/${media._id}.jpg`;
        await uploadFile(thumbnailPath, thumbnailUploadKey);
    };

export const uploadSuccessHandler = (amqpClient: AmqpClient, mediaDal: MediaDal, { uploadStorageBucket, uploadKeyPrefix }: UploadConfig) => async ({ media, mediaPath, thumbnailPath }: Upload) => {
    const message: ConvertMessage = {
        mediaId: media._id,
        mediaFileName: media.fileName,
        mediaStorageBucket: uploadStorageBucket,
        mediaRoutingKey: `${uploadKeyPrefix}/${media.fileName}`
    };
    amqpClient.publish("convert", "convert.media", message);
    await mediaDal.updateMedia(media._id, { status: "processing" });
    await cleanupPath(mediaPath);
    await cleanupPath(thumbnailPath);
};