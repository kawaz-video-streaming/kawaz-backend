import { AmqpClient, Consumer } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { createUploadConsumerBinding, UploadConsumerBinding } from "./binding";
import { Upload, validateUploadPayload } from "./types";
import { uploadMediaHandler } from "./handler";
import { UploadConfig } from "./config";
import { MediaDal } from "../../dal/media";


export const createUploadConsumer = (storageClient: StorageClient, amqpClient: AmqpClient, mediaDal: MediaDal, config: UploadConfig) =>
    new Consumer<Upload, UploadConsumerBinding>(
        'upload',
        createUploadConsumerBinding(),
        validateUploadPayload,
        uploadMediaHandler(storageClient, amqpClient, mediaDal, config));