import { StorageClient } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { ConvertMessage, Upload } from "./types";
import { UploadConfig } from "./config";
import { AmqpClient } from "@ido_kawaz/amqp-client";
import { MediaDal } from "../../dal/media";

export const uploadMediaHandler = (storageClient: StorageClient, amqpClient: AmqpClient, mediaDal: MediaDal, { uploadBucket, uploadKeyPrefix, partSize }: UploadConfig) =>
    async ({ media, path }: Upload) => {
        const fileData = createReadStream(path);
        const uploadKey = `${uploadKeyPrefix}/${media.name}`;
        await storageClient.uploadObject(uploadBucket, uploadKey, fileData, { ensureBucket: true, multipartUpload: media.size > partSize });
        if (media.type.includes("video")) {
            const message: ConvertMessage = {
                mediaId: media._id,
                mediaName: media.name,
                mediaStorageBucket: uploadBucket,
                mediaRoutingKey: uploadKey,
            };
            amqpClient.publish("convert", "convert.media", message);
            await mediaDal.updateMediaStatus(media._id, "processing");
        } else if (media.type.includes("image")) {
            await mediaDal.updateMediaStatus(media._id, "completed");
        }
    };