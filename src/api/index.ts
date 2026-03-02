import { StatusCodes } from "http-status-codes";
import swaggerUi from "swagger-ui-express";
import { StorageClient } from "@ido_kawaz/storage-client";
import { AmqpClient } from "@ido_kawaz/amqp-client";
import { Express } from "express";
import { Dals } from "../dal/types";
import { swaggerSpec } from "./swagger";
import { createMediaRouter } from "./media";
import { RequestErrorHandler } from "./decorators";


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