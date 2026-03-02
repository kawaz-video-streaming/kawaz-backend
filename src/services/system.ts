import { SystemConfig } from "../config";
import { initializeDB } from "./db";
import { startServer } from "./server";
import { StorageClient } from "@ido_kawaz/storage-client";
import { AmqpClient } from "@ido_kawaz/amqp-client";

export const startSystem = async ({ storageConfig, amqpConfig, dbConfig, serverConfig }: SystemConfig) => {
    const storageClient = new StorageClient(storageConfig);
    const amqpClient = new AmqpClient(amqpConfig, []);
    const dals = await initializeDB(dbConfig);
    await amqpClient.start();
    await startServer(serverConfig, storageClient, amqpClient, dals);
};