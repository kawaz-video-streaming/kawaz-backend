import { AmqpClient } from "@ido_kawaz/amqp-client";
import { Application } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { StatusCodes } from "http-status-codes";
import swaggerUi from "swagger-ui-express";
import { Dals } from "../dal/types";
import { createMediaRouter } from "./media";
import { swaggerSpec } from "./swagger";


export const registerRoutes = (storageClient: StorageClient, amqpClient: AmqpClient, { mediaDal }: Dals) =>
    (app: Application) => {
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

        return app;
    };