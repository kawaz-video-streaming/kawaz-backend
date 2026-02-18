import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Kawaz Backend API",
            version: "0.1.0",
            description: "API documentation for Kawaz Backend service",
        },
        servers: [
            {
                url: "http://localhost:8080",
                description: "Development server",
            },
        ],
        components: {
            schemas: {
                Error: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string",
                            description: "Error message",
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
    apis: ["./src/routes/**/*.ts", "./src/services/server/utils.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
