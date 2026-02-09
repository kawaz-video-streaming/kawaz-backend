import mongoose from "mongoose";
import { createDals, createModels, ensureIndexes } from "./utils";
import { Dals, DatabaseConfig } from "./types";

export const initializeDB = async (config: DatabaseConfig): Promise<Dals> => {
    const connection = await mongoose.createConnection(config.dbConnectionString).asPromise().catch((error) => {
        throw error;
    });
    console.log("Connected to database successfully");
    const models = createModels(connection);
    await ensureIndexes(models);
    return createDals(models);
}