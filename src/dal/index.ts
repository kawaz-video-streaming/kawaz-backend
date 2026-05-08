import { MongoClient } from "@ido_kawaz/mongo-client";
import { AvatarDal } from "./avatar";
import { createAvatarModel, createSpecialAvatarModel } from "./avatar/model";
import { AvatarCategoryDal } from "./avatarCategory";
import { createAvatarCategoryModel } from "./avatarCategory/model";
import { MediaDal } from "./media";
import { createMediaModel, createSpecialMediaModel } from "./media/model";
import { MediaCollectionDal } from "./mediaCollection";
import { createMediaCollectionModel, createSpecialMediaCollectionModel } from "./mediaCollection/model";
import { Dals, Models } from "./types";
import { UserDal } from "./user";
import { createUserModel } from "./user/model";
import { createMediaGenreModel } from "./mediaGenre/model";
import { MediaGenreDal } from "./mediaGenre";

export const createModels = (client: MongoClient): Models => {
    return {
        mediaModel: createMediaModel(client),
        specialMediaModel: createSpecialMediaModel(client),
        mediaCollectionModel: createMediaCollectionModel(client),
        specialMediaCollectionModel: createSpecialMediaCollectionModel(client),
        userModel: createUserModel(client),
        avatarModel: createAvatarModel(client),
        specialAvatarModel: createSpecialAvatarModel(client),
        avatarCategoryModel: createAvatarCategoryModel(client),
        mediaGenreModel: createMediaGenreModel(client)
    };
}

export const createDals = ({
    mediaModel,
    specialMediaModel,
    mediaCollectionModel,
    specialMediaCollectionModel,
    userModel,
    avatarModel,
    specialAvatarModel,
    avatarCategoryModel,
    mediaGenreModel
}: Models): Dals => {
    return {
        mediaDal: new MediaDal(mediaModel),
        specialMediaDal: new MediaDal(specialMediaModel),
        mediaCollectionDal: new MediaCollectionDal(mediaCollectionModel),
        specialMediaCollectionDal: new MediaCollectionDal(specialMediaCollectionModel),
        userDal: new UserDal(userModel),
        avatarDal: new AvatarDal(avatarModel),
        specialAvatarDal: new AvatarDal(specialAvatarModel),
        avatarCategoryDal: new AvatarCategoryDal(avatarCategoryModel),
        mediaGenreDal: new MediaGenreDal(mediaGenreModel)
    };
}