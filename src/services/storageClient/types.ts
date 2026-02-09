import { S3ServiceException } from "@aws-sdk/client-s3";

export class StorageError extends Error {
    constructor(operation: string, error: S3ServiceException, details: {}) {
        const message = `Storage error: ${JSON.stringify({ operation, error: error.name, ...details })}`;
        super(message);
    }
}

export interface UploadObjectOptions {
    ensureBucket: boolean;
}