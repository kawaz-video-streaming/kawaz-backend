import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { Dals } from "../dal/types";
import { ConsumersConfig } from "./config";
import { createUploadConsumer } from "./upload";

export const createConsumers = (config: ConsumersConfig, storageClient: StorageClient, amqpClient: AmqpClient, { mediaDal }: Dals) => {
    return [
        createUploadConsumer(storageClient, amqpClient, mediaDal, config.upload)
    ];
}