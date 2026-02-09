import mongoose from "mongoose";
import { createMediaModel } from "../../models/media/media";
import { MediaDal } from "../../models/media/media.dal";
import { Dals, Models } from "./types";

export const createModels = (connection: mongoose.Connection): Models => {
    return {
        mediaModel: createMediaModel(connection)
    };
}

export const ensureIndexes = async (models: Models) => {
    await Promise.all(Object.values(models).map(model => model.ensureIndexes()));
}

export const createDals = ({ mediaModel }: Models): Dals => {
    return {
        mediaDal: new MediaDal(mediaModel)
    };
}