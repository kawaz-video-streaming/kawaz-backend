import { Model } from "@ido_kawaz/mongo-client";
import { MediaDal } from "./media";
import { MediaModel } from "./media/model";

export interface Models extends Record<string, Model<any>> {
    mediaModel: MediaModel;
}


export interface Dals {
    mediaDal: MediaDal;
}