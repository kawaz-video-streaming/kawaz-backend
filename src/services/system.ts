import { SystemConfig } from "../config";
import { initializeDB } from "./db/db";
import { startServer } from "./server/server";
import { StorageClient } from "@ido_kawaz/storage-client";

export const startSystem = async (config: SystemConfig) => {
    const storageClient = new StorageClient(config.storage);
    const dals = await initializeDB(config.db);
    await startServer(config.server, storageClient, dals);
}