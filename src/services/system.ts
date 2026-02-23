import { SystemConfig } from "../config";
import { initializeDB } from "./db/db";
import { startServer } from "./server/server";
import { StorageClient } from "@ido_kawaz/storage-client";
import { AmqpClient } from "@ido_kawaz/amqp-client";

const startAmqp = async (amqpClient: AmqpClient) => {
    const startTime = Date.now();
    await amqpClient.start();
    const endTime = Date.now();
    console.log(`connected to amqp successfully in ${endTime - startTime} ms`);
}

export const startSystem = async ({ storage, amqp, db, server }: SystemConfig) => {
    const storageClient = new StorageClient(storage);
    const amqpClient = new AmqpClient(amqp, []);
    const dals = await initializeDB(db);
    await startAmqp(amqpClient);
    await startServer(server, storageClient, amqpClient, dals);
}