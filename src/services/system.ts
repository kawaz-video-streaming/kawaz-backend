import { StorageClient } from "@ido_kawaz/storage-client";
import { AmqpClient } from "@ido_kawaz/amqp-client";
import { startServer } from "@ido_kawaz/server-framework";
import { SERVICE_NAME, SystemConfig } from "../config";
import { initializeDB } from "./db";
import { registerRoutes } from "../api";

export const startSystem = async ({ storageConfig, amqpConfig, dbConfig, serverConfig }: SystemConfig) => {
    const storageClient = new StorageClient(storageConfig);
    const amqpClient = new AmqpClient(amqpConfig, []);
    const dals = await initializeDB(dbConfig);
    await amqpClient.start(SERVICE_NAME);
    await startServer(serverConfig, registerRoutes, storageClient, amqpClient, dals);
};