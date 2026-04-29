import { AmqpClient } from "@ido_kawaz/amqp-client";
import { Application } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { StatusCodes } from "http-status-codes";
import swaggerUi from "swagger-ui-express";
import { BackendServerConfig } from "../config";
import { Dals } from "../dal/types";
import { Mailer } from "../services/mailer";
import { createAdminRouter } from "./admin";
import { createAuthRouter } from "./auth";
import { createAvatarRouter } from "./avatar";
import { createMediaRouter } from "./media";
import { createMediaCollectionRouter } from "./mediaCollection";
import { createAuthMiddleware, requireAdmin } from "./middleware";
import { swaggerSpec } from "./swagger";
import { createUserRouter } from "./user";


export const registerRoutes = (
    config: BackendServerConfig,
    storageClient: StorageClient,
    amqpClient: AmqpClient,
    mailer: Mailer,
    dals: Dals
) => (app: Application) => {
    const { userDal, avatarDal } = dals;
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

    // Authentication routes
    app.use('/auth', createAuthRouter(authConfig, mailer, userDal));

    // Apply authentication middleware to all API routes
    app.use(createAuthMiddleware(authConfig, userDal));

    // API routes
    app.use('/admin', requireAdmin, createAdminRouter(mailer, userDal));
    app.use('/user', createUserRouter(userDal));
    app.use("/avatar", createAvatarRouter(config.bucketsConfig, avatarDal, storageClient));
    app.use("/media", createMediaRouter(config.bucketsConfig, dals, amqpClient, storageClient));
    app.use("/mediaCollection", createMediaCollectionRouter(config.bucketsConfig, dals, storageClient));
    return app;
};