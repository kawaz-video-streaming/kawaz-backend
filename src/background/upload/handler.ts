import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { isNotNil } from "ramda";
import { MediaDal } from "../../dal/media";
import { cleanupPath } from "../../utils/files";
import { UploadConfig } from "./config";
import { ConvertMessage, Upload } from "./types";
import { createUploadFile } from "./utils";

export const uploadMediaHandler = (storageClient: StorageClient, mediaDal: MediaDal, { uploadStorageBucket, uploadKeyPrefix, partSize }: UploadConfig) =>
    async (payload: Upload) => {
        const { media, mediaPath, thumbnailPath } = payload;
        const uploadFile = createUploadFile(storageClient, payload, uploadStorageBucket);
        await uploadFile(mediaPath, `${uploadKeyPrefix}/${media.fileName}`, { ensureBucket: true, multipartUpload: media.size > partSize });
        if (isNotNil(thumbnailPath)) {
            const thumbnailUploadKey = `${uploadKeyPrefix}/thumbnails/${media._id}.jpg`;
            await uploadFile(thumbnailPath, thumbnailUploadKey);
            await mediaDal.updateMedia(media._id, { thumbnailUrl: thumbnailUploadKey });
        }
    };

export const uploadSuccessHandler = (amqpClient: AmqpClient, mediaDal: MediaDal, { uploadStorageBucket, uploadKeyPrefix }: UploadConfig) => async ({ media, mediaPath }: Upload) => {
    const message: ConvertMessage = {
        mediaId: media._id,
        mediaFileName: media.fileName,
        mediaStorageBucket: uploadStorageBucket,
        mediaRoutingKey: `${uploadKeyPrefix}/${media.fileName}`
    };
    amqpClient.publish("convert", "convert.media", message);
    await mediaDal.updateMedia(media._id, { status: "processing" });
    await cleanupPath(mediaPath);
};