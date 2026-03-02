import swaggerJsdoc from "swagger-jsdoc";
import { SERVICE_NAME } from "../config";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: `${SERVICE_NAME} API`,
            version: "0.1.0",
            description: `API documentation for ${SERVICE_NAME} service`,
        },
        servers: [
            {
                url: "http://localhost:8080",
                description: "Development server",
            },
        ],
        components: {
            schemas: {
                InternalServerError: {
                    type: "object",
                    properties: {
                        error: {
                            type: "string",
                            description: "Error message",
                            example: "An unexpected error occurred while processing the request"
                        },
                    },
                },
                BadRequestError: {
                    type: "object",
                    properties: {
                        error: {
                            type: "string",
                            description: "Error message",
                            example: "file is required for uploading media"
                        },
                    },
                },
                UploadResponse: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string",
                            example: "Media uploaded successfully",
                        },
                    },
                },
            },
        },
    },
    apis: ["./src/api/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
