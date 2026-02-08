import { SystemConfig } from "../config";
import { startServer } from "./server";
import { createStorageClient, StorageClient } from "./storageClient";

export const startSystem = async (config: SystemConfig) => {
    const storageClient: StorageClient = createStorageClient(config.storage);
    await startServer(config.server, storageClient);
}