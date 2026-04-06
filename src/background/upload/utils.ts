import { StorageClient, StorageError, StorageObject, UploadObjectOptions } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { UploadError } from "./errors";
import { Upload } from "./types";

export const createUploadFile = (storageClient: StorageClient, payload: Upload, uploadBucket: string) => async (filePath: string, uploadKey: string, uploadOptions?: UploadObjectOptions) => {
    const fileData = createReadStream(filePath);
    const storageObject: StorageObject = { key: uploadKey, data: fileData };
    await storageClient.uploadObject(uploadBucket, storageObject, uploadOptions).catch(error => {
        if (error instanceof StorageError) {
            throw new UploadError(payload, error);
        }
        throw error;
    });
}