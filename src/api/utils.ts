import bodyParser from "body-parser";
import cors from "cors";
import express, { Express } from "express";

export const registerMiddlewares = (app: Express) => {
    app.use(cors());
    app.use(express.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    return app;
};