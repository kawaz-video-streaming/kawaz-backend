import { Model } from "@ido_kawaz/mongo-client";
import { AvatarDal } from "./avatar";
import { AvatarModel } from "./avatar/model";
import { AvatarCategoryDal } from "./avatarCategory";
import { AvatarCategoryModel } from "./avatarCategory/model";
import { MediaDal } from "./media";
import { MediaModel } from "./media/model";
import { MediaCollectionDal } from "./mediaCollection";
import { MediaCollectionModel } from "./mediaCollection/model";
import { UserDal } from "./user";
import { UserModel } from "./user/model";

export interface Models extends Record<string, Model<any>> {
    mediaModel: MediaModel;
    mediaCollectionModel: MediaCollectionModel
    userModel: UserModel;
    avatarModel: AvatarModel;
    avatarCategoryModel: AvatarCategoryModel;
}


export interface Dals {
    mediaDal: MediaDal;
    mediaCollectionDal: MediaCollectionDal;
    userDal: UserDal;
    avatarDal: AvatarDal;
    avatarCategoryDal: AvatarCategoryDal;
}