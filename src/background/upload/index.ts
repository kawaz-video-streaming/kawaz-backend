import { AmqpClient, Consumer } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { MediaDal } from "../../dal/media";
import { cleanupPath } from "../../utils/files";
import { createUploadConsumerBinding, UploadConsumerBinding } from "./binding";
import { UploadConfig } from "./config";
import { uploadSuccessHandler, uploadMediaHandler } from "./handler";
import { Upload, validateUploadPayload } from "./types";


export const createUploadConsumer = (storageClient: StorageClient, amqpClient: AmqpClient, mediaDal: MediaDal, config: UploadConfig) =>
    new Consumer<Upload, UploadConsumerBinding>('upload', createUploadConsumerBinding())
        .on('validateMessage', validateUploadPayload)
        .on('handleMessage', uploadMediaHandler(storageClient, mediaDal, config))
        .on('handleSuccess', uploadSuccessHandler(amqpClient, mediaDal, config))
        .on('handleFatalError', async (_, payload) => {
            if (validateUploadPayload(payload)) {
                const mediaId = payload.media._id;
                await mediaDal.updateMedia(mediaId, { status: "failed" });
                await cleanupPath(payload.mediaPath);
            }
        });
