import { Model } from "@ido_kawaz/mongo-client";
import { MediaDal } from "./media";
import { MediaCollectionDal } from "./mediaCollection";
import { UserDal } from "./user";
import { MediaModel } from "./media/model";
import { MediaCollectionModel } from "./mediaCollection/model";
import { UserModel } from "./user/model";

export interface Models extends Record<string, Model<any>> {
    mediaModel: MediaModel;
    mediaCollectionModel: MediaCollectionModel
    userModel: UserModel;
}


export interface Dals {
    mediaDal: MediaDal;
    mediaCollectionDal: MediaCollectionDal;
    userDal: UserDal;
}