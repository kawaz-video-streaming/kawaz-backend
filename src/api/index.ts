import { AmqpClient } from "@ido_kawaz/amqp-client";
import { Application } from "@ido_kawaz/server-framework";
import { VodClient } from "@ido_kawaz/vod-client";
import { StatusCodes } from "http-status-codes";
import swaggerUi from "swagger-ui-express";
import { BackendServerConfig } from "../config";
import { Dals } from "../dal/types";
import { createAuthRouter } from "./auth";
import { createMediaRouter } from "./media";
import { createAuthMiddleware } from "./middleware";
import { swaggerSpec } from "./swagger";


export const registerRoutes = (config: BackendServerConfig, amqpClient: AmqpClient, dals: Dals, vodClient: VodClient) =>
    (app: Application) => {
        const { mediaDal, userDal } = dals;
        const { authConfig } = config;

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

        const authMiddleware = createAuthMiddleware(authConfig, userDal);

        // Authentication routes
        app.use('/auth', createAuthRouter(authConfig, authMiddleware, userDal));

        // Apply authentication middleware to all API routes
        app.use(authMiddleware);

        // API routes
        app.use("/media", createMediaRouter(mediaDal, amqpClient, vodClient));

        return app;
    };