import { Model } from "mongoose";
import { MediaModel } from "../../models/media/media";
import { MediaDal } from "../../models/media/media.dal";

export class DatabaseConnectionError extends Error {
    constructor(message: string) {
        super(`Database connection error:\n${message}`);
    }
}

export interface DatabaseConfig {
    dbConnectionString: string;
}

export interface Models extends Record<string, Model<any>> {
    mediaModel: MediaModel;
};

export interface Dals {
    mediaDal: MediaDal;
};