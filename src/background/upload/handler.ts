import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient, StorageError } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { MediaDal } from "../../dal/media";
import { cleanupPath } from "../../utils/files";
import { UploadConfig } from "./config";
import { UploadError } from "./errors";
import { ConvertMessage, Upload } from "./types";

export const uploadMediaHandler = (storageClient: StorageClient, { uploadBucket, uploadKeyPrefix, partSize }: UploadConfig) =>
    async (payload: Upload) => {
        const { media, path } = payload;
        const fileData = createReadStream(path);
        await storageClient.uploadObject(uploadBucket, `${uploadKeyPrefix}/${media.name}`, fileData, { ensureBucket: true, multipartUpload: media.size > partSize }).catch(error => {
            if (error instanceof StorageError) {
                throw new UploadError(payload, error);
            }
            throw error;
        });
    };

export const uploadSuccessHandler = (amqpClient: AmqpClient, mediaDal: MediaDal, { uploadBucket, uploadKeyPrefix }: UploadConfig) => async ({ media, path }: Upload) => {
    if (media.type.includes("video")) {
        const message: ConvertMessage = {
            mediaId: media._id,
            mediaName: media.name,
            mediaStorageBucket: uploadBucket,
            mediaRoutingKey: `${uploadKeyPrefix}/${media.name}`
        };
        amqpClient.publish("convert", "convert.media", message);
        await mediaDal.updateMediaStatus(media._id, "processing");
    } else if (media.type.includes("image")) {
        await mediaDal.updateMediaStatus(media._id, "completed");
    }
    await cleanupPath(path);
};