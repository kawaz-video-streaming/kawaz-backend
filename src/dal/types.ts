import { Model } from "@ido_kawaz/mongo-client";
import { AvatarModel } from "./avatar/model";
import { MediaDal } from "./media";
import { MediaModel } from "./media/model";
import { MediaCollectionDal } from "./mediaCollection";
import { MediaCollectionModel } from "./mediaCollection/model";
import { UserDal } from "./user";
import { UserModel } from "./user/model";
import { AvatarDal } from "./avatar";

export interface Models extends Record<string, Model<any>> {
    mediaModel: MediaModel;
    mediaCollectionModel: MediaCollectionModel
    userModel: UserModel;
    avatarModel: AvatarModel;
}


export interface Dals {
    mediaDal: MediaDal;
    mediaCollectionDal: MediaCollectionDal;
    userDal: UserDal;
    avatarDal: AvatarDal;
}