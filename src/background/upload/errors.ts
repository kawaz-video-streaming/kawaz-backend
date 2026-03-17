import { AmqpRetriableError } from "@ido_kawaz/amqp-client";
import { StorageError } from "@ido_kawaz/storage-client";
import { Upload } from "./types";

export class UploadError extends AmqpRetriableError<Upload> {
    constructor(payload: Upload, error: StorageError) {
        super(payload, `Storage upload failed: ${error.message}, retrying`, error, 3);
    }
}