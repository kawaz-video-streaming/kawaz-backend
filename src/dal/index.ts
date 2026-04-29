import { MongoClient } from "@ido_kawaz/mongo-client";
import { AvatarDal } from "./avatar";
import { createAvatarModel } from "./avatar/model";
import { AvatarCategoryDal } from "./avatarCategory";
import { createAvatarCategoryModel } from "./avatarCategory/model";
import { MediaDal } from "./media";
import { createMediaModel } from "./media/model";
import { MediaCollectionDal } from "./mediaCollection";
import { createMediaCollectionModel } from "./mediaCollection/model";
import { Dals, Models } from "./types";
import { UserDal } from "./user";
import { createUserModel } from "./user/model";

export const createModels = (client: MongoClient): Models => {
    return {
        mediaModel: createMediaModel(client),
        mediaCollectionModel: createMediaCollectionModel(client),
        userModel: createUserModel(client),
        avatarModel: createAvatarModel(client),
        avatarCategoryModel: createAvatarCategoryModel(client)
    };
}

export const createDals = ({ mediaModel, mediaCollectionModel, userModel, avatarModel, avatarCategoryModel }: Models): Dals => {
    return {
        mediaDal: new MediaDal(mediaModel),
        mediaCollectionDal: new MediaCollectionDal(mediaCollectionModel),
        userDal: new UserDal(userModel),
        avatarDal: new AvatarDal(avatarModel),
        avatarCategoryDal: new AvatarCategoryDal(avatarCategoryModel)
    };
}