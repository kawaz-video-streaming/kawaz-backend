import express from "express";
import http from "http";
import { StorageClient } from "../storageClient/storageClient";
import { ServerConfig } from "./types";
import { registerMiddlewares, registerRoutes } from "./utils";
import { Dals } from "../db/types";

export const startServer = async (
  config: ServerConfig,
  storageClient: StorageClient,
  dals: Dals
) => {
  const app = express();
  const appWithMiddlewares = registerMiddlewares(app);
  const appWithRoutes = registerRoutes(appWithMiddlewares, storageClient, dals);
  const server = http.createServer(appWithRoutes);
  const { port } = config;
  return new Promise<void>((resolve, reject) => {
    server.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      resolve();
    }).on("error", (error) => {
      console.error("Error starting the server:", error);
      reject(error);
    });
  });
};
