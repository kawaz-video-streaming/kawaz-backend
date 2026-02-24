import bodyParser from "body-parser";
import cors from "cors";
import express, { Express } from "express";
import { StatusCodes } from "http-status-codes";
import swaggerUi from "swagger-ui-express";
import { createMediaRouter } from "../../api/media/media.routes";
import { StorageClient } from "@ido_kawaz/storage-client";
import { Dals } from "../db/types";
import { RequestErrorHandler } from "../../utils/decorators";
import { swaggerSpec } from "../swagger";
import { AmqpClient } from "@ido_kawaz/amqp-client";

export const registerMiddlewares = (app: Express) => {
    app.use(cors());
    app.use(express.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    return app;
};

export const registerRoutes = (app: Express, storageClient: StorageClient, amqpClient: AmqpClient, { mediaDal }: Dals) => {
    /**
     * @openapi
     * /health:
     *   get:
     *     summary: Health check endpoint
     *     description: Returns OK if the server is running
     *     tags:
     *       - Health
     *     responses:
     *       200:
     *         description: Server is healthy
     */
    app.get("/health", (_req, res) => {
        res.sendStatus(StatusCodes.OK);
    });

    // Swagger documentation
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    // API routes
    app.use("/media", createMediaRouter(mediaDal, storageClient, amqpClient));

    app.use(RequestErrorHandler);

    return app;
};