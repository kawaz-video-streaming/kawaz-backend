import { MongoClient } from "@ido_kawaz/mongo-client";
import { MediaDal } from "./media";
import { MediaCollectionDal } from "./mediaCollection";
import { UserDal } from "./user";
import { createMediaModel } from "./media/model";
import { createMediaCollectionModel } from "./mediaCollection/model";
import { createUserModel } from "./user/model";
import { Dals, Models } from "./types";

export const createModels = (client: MongoClient): Models => {
    return {
        mediaModel: createMediaModel(client),
        mediaCollectionModel: createMediaCollectionModel(client),
        userModel: createUserModel(client)
    };
}

export const createDals = ({ mediaModel, mediaCollectionModel, userModel }: Models): Dals => {
    return {
        mediaDal: new MediaDal(mediaModel),
        mediaCollectionDal: new MediaCollectionDal(mediaCollectionModel),
        userDal: new UserDal(userModel)
    };
}