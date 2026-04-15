import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient, StorageError, StorageObject, UploadObjectOptions } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { Progress } from "../progress/types";
import { UploadError } from "./errors";
import { Upload } from "./types";


const updateUploadProgress = (amqpClient: AmqpClient, mediaId: string, baseStart: number, weight: number) =>
    (index: number, total: number) =>
        amqpClient.publish<Progress>('progress', 'progress.media', { mediaId, percentage: baseStart + ((index / total) * weight), status: 'processing' });


export const createUploadFile = (storageClient: StorageClient, amqpClient: AmqpClient, payload: Upload, uploadBucket: string) =>
    async (filePath: string, uploadKey: string, uploadOptions?: UploadObjectOptions) => {
        const fileData = createReadStream(filePath);
        const storageObject: StorageObject = { key: uploadKey, data: fileData };
        const uploadProgressCallback = updateUploadProgress(amqpClient, payload.media._id, 10, 10);
        await storageClient.uploadObject(uploadBucket, storageObject, uploadOptions, uploadProgressCallback).catch(error => {
            if (error instanceof StorageError) {
                throw new UploadError(payload, error);
            }
            throw error;
        });
    }