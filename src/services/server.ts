import http from "http";
import bodyParser from "body-parser";
import cors from "cors";
import express, { Express } from "express";
import { StatusCodes } from "http-status-codes";
import { StorageClient } from "./storageClient";
import { createMediaRouter } from "../routes/media/media.routes";

export interface ServerConfig {
  port: number;
}

const registerMiddlewares = (app: Express) => {
  app.use(cors());
  app.use(express.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  return app;
};

const registerRoutes = (app: Express, storageClient: StorageClient) => {
  app.use("/media", createMediaRouter(storageClient));
  app.get("/health", (_req, res) => {
    res.sendStatus(StatusCodes.OK);
  });
  return app;
};

export const startServer = async (
  config: ServerConfig,
  storageClient: StorageClient,
) => {
  const app = express();
  const appWithMiddlewares = registerMiddlewares(app);
  const appWithRoutes = registerRoutes(appWithMiddlewares, storageClient);
  const server = http.createServer(appWithRoutes);
  const { port } = config;
  return new Promise<void>((resolve, reject) => {
    server
      .listen(port, () => {
        console.log(`Server is running on port ${port}`);
        resolve();
      })
      .on("error", (error) => {
        console.error("Error starting the server:", error);
        reject(error);
      });
  });
};
