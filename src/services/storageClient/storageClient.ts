import { CreateBucketCommand, DeleteBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client, S3ClientConfig, S3ServiceException } from "@aws-sdk/client-s3";
import { StorageError, UploadObjectOptions } from "./types";


export class StorageClient {
    private client: S3Client;
    constructor(config: S3ClientConfig) {
        this.client = new S3Client(config);
    }
    ensureBucket = async (bucketName: string) => {
        await this.client.send(new HeadBucketCommand({ Bucket: bucketName })).catch(async (error: S3ServiceException) => {
            if (error.name === 'NotFound') {
                await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
            } else {
                throw new StorageError("ensureBucket", error, { bucketName });
            }
        });
    };
    deleteBucket = async (bucketName: string) => {
        await this.client.send(new DeleteBucketCommand({ Bucket: bucketName })).catch((error: S3ServiceException) => {
            if (error.name !== 'NoSuchBucket') {
                throw new StorageError("deleteBucket", error, { bucketName });
            }
        });
    };

    uploadObject = async (bucketName: string, objectKey: string, objectData: Buffer, options?: UploadObjectOptions) => {
        if (options?.ensureBucket) {
            await this.ensureBucket(bucketName);
        }
        await this.client.send(new PutObjectCommand({ Bucket: bucketName, Key: objectKey, Body: objectData })).catch((error: S3ServiceException) => {
            throw new StorageError("uploadObject", error, { bucketName, objectKey });
        });
    }
}