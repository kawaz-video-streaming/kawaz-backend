import { MongoClient } from "@ido_kawaz/mongo-client";
import { createMediaModel } from "./media/media";
import { MediaDal } from "./media/media.dal";
import { Models, Dals } from "./types";

export const createModels = (client: MongoClient): Models => {
    return {
        mediaModel: createMediaModel(client)
    };
}

export const createDals = ({ mediaModel }: Models): Dals => {
    return {
        mediaDal: new MediaDal(mediaModel)
    };
}