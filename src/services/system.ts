import { StorageClient } from "@ido_kawaz/storage-client";
import { AmqpClient } from "@ido_kawaz/amqp-client";
import { SERVICE_NAME, SystemConfig } from "../config";
import { initializeDB } from "./db";
import { registerRoutes } from "../api";
import { createConsumers } from "../background";
import { createServer } from "@ido_kawaz/server-framework";

export const startSystem = async ({ storageConfig, amqpConfig, consumersConfig, dbConfig, serverConfig }: SystemConfig) => {
    const storageClient = new StorageClient(storageConfig);
    const amqpPublishClient = new AmqpClient(amqpConfig, []);
    const dals = await initializeDB(dbConfig);
    const amqpClient = new AmqpClient(amqpConfig, createConsumers(consumersConfig, storageClient, amqpPublishClient, dals));
    await amqpPublishClient.start(SERVICE_NAME);
    await amqpClient.start(SERVICE_NAME);
    const server = createServer(serverConfig, registerRoutes);
    await server.start(amqpPublishClient, dals);
};