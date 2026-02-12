import bodyParser from "body-parser";
import cors from "cors";
import express, { Express } from "express";
import { StatusCodes } from "http-status-codes";
import { createMediaRouter } from "../../routes/media/media.routes";
import { StorageClient } from "../storageClient/storageClient";
import { Dals } from "../db/types";
import { RequestErrorHandler } from "../../utils/decorators";

export const registerMiddlewares = (app: Express) => {
    app.use(cors());
    app.use(express.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    return app;
};

export const registerRoutes = (app: Express, storageClient: StorageClient, { mediaDal }: Dals) => {
    app.use("/media", createMediaRouter(mediaDal, storageClient));
    app.get("/health", (_req, res) => {
        res.sendStatus(StatusCodes.OK);
    });
    app.use(RequestErrorHandler);

    return app;
};