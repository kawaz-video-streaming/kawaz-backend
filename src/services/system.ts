import { SystemConfig } from "../config";
import { startServer } from "./server";

export const startSystem = async (config: SystemConfig) => {
    await startServer(config.server);
    console.log("System started successfully");
}