import { CreateBucketCommand, DeleteBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client, S3ClientConfig, S3ServiceException } from "@aws-sdk/client-s3";

class StorageError extends Error {
    constructor(operation: string, error: S3ServiceException, details: {}) {
        const message = `Storage error: ${JSON.stringify({ operation, error: error.name, ...details })}`;
        super(message);
    }
}

export interface StorageClient {
    ensureBucket: (bucketName: string) => Promise<void>;
    deleteBucket: (bucketName: string) => Promise<void>;
    uploadObject: (bucketName: string, objectKey: string, objectData: Buffer, options?: { ensureBucket?: boolean }) => Promise<void>;
}

export const createStorageClient = (config: S3ClientConfig): StorageClient => {
    const client = new S3Client(config);
    const ensureBucket = async (bucketName: string) => {
        await client.send(new HeadBucketCommand({ Bucket: bucketName })).catch(async (error: S3ServiceException) => {
            if (error.name === 'NotFound') {
                await client.send(new CreateBucketCommand({ Bucket: bucketName }));
            } else {
                throw new StorageError("ensureBucket", error, { bucketName });
            }
        });
    }
    return ({
        ensureBucket,
        deleteBucket: async (bucketName: string) => {
            await client.send(new DeleteBucketCommand({ Bucket: bucketName })).catch((error: S3ServiceException) => {
                if (error.name !== 'NoSuchBucket') {
                    throw new StorageError("deleteBucket", error, { bucketName });
                }
            });
        },
        uploadObject: async (bucketName: string, objectKey: string, objectData: Buffer, options?: { ensureBucket?: boolean }) => {
            if (options?.ensureBucket) {
                await ensureBucket(bucketName);
            }
            await client.send(new PutObjectCommand({ Bucket: bucketName, Key: objectKey, Body: objectData })).catch((error: S3ServiceException) => {
                throw new StorageError("uploadObject", error, { bucketName, objectKey });
            });
        }
    });
}