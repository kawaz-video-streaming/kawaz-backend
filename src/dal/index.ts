import { MongoClient } from "@ido_kawaz/mongo-client";
import { MediaDal } from "./media";
import { UserDal } from "./user";
import { createMediaModel } from "./media/model";
import { createUserModel } from "./user/model";
import { Dals, Models } from "./types";

export const createModels = (client: MongoClient): Models => {
    return {
        mediaModel: createMediaModel(client),
        userModel: createUserModel(client)
    };
}

export const createDals = ({ mediaModel, userModel }: Models): Dals => {
    return {
        mediaDal: new MediaDal(mediaModel),
        userDal: new UserDal(userModel)
    };
}