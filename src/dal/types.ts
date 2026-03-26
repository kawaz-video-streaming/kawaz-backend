import { Model } from "@ido_kawaz/mongo-client";
import { MediaDal } from "./media";
import { UserDal } from "./user";
import { UserModel } from "./user/model";
import { MediaModel } from "./media/model";

export interface Models extends Record<string, Model<any>> {
    mediaModel: MediaModel;
    userModel: UserModel;
}


export interface Dals {
    mediaDal: MediaDal;
    userDal: UserDal;
}