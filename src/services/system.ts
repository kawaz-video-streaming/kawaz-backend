import { StorageClient } from "@ido_kawaz/storage-client";
import { AmqpClient } from "@ido_kawaz/amqp-client";
import { VodClient } from "@ido_kawaz/vod-client";
import { SERVICE_NAME, SystemConfig } from "../config";
import { initializeDB } from "./db";
import { registerRoutes } from "../api";
import { createConsumers } from "../background";
import { createServer } from "@ido_kawaz/server-framework";

export const startSystem = async ({ storageConfig, amqpConfig, consumersConfig, dbConfig, serverConfig, vodConfig }: SystemConfig) => {
    const storageClient = new StorageClient(storageConfig);
    const amqpClient = new AmqpClient(amqpConfig);
    const vodClient = new VodClient(vodConfig);
    const dals = await initializeDB(dbConfig);
    const consumers = createConsumers(consumersConfig, storageClient, amqpClient, dals);
    amqpClient.registerConsumers(consumers);
    await amqpClient.start(SERVICE_NAME);
    const server = createServer(serverConfig, (config, amqpClient, dals) => registerRoutes(config, amqpClient, dals, vodClient));
    await server.start(serverConfig, amqpClient, dals);
};