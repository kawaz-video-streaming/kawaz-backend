import { AmqpClient } from "@ido_kawaz/amqp-client";
import { createServer } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { registerRoutes } from "../api";
import { createConsumers } from "../background";
import { SERVICE_NAME, SystemConfig } from "../config";
import { initializeDB } from "./db";
import { Mailer } from "./mailer";

export const startSystem = async ({
    storageConfig,
    amqpConfig,
    consumersConfig,
    dbConfig,
    serverConfig,
    mailerConfig
}: SystemConfig
) => {
    const mailer = new Mailer(mailerConfig);
    const storageClient = new StorageClient(storageConfig);
    const amqpClient = new AmqpClient(amqpConfig);
    const dals = await initializeDB(dbConfig);
    const consumers = createConsumers(consumersConfig, storageClient, amqpClient, dals);
    amqpClient.registerConsumers(consumers);
    await amqpClient.start(SERVICE_NAME);
    const server = createServer(serverConfig, registerRoutes);
    await server.start(serverConfig, storageClient, amqpClient, mailer, dals);
};