import { MongoClient } from "@ido_kawaz/mongo-client";
import { MediaDal } from "./media";
import { createMediaModel } from "./media/model";
import { Dals, Models } from "./types";

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