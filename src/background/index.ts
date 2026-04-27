import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { Dals } from "../dal/types";
import { ConsumersConfig } from "./config";
import { createProgressConsumer } from "./progress";

export const createConsumers = (_config: ConsumersConfig, _storageClient: StorageClient, _amqpClient: AmqpClient, { mediaDal }: Dals) => {
    return [
        createProgressConsumer(mediaDal)
    ];
};