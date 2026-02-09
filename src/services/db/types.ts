import { MediaModel } from "../../models/media/media";
import { MediaDal } from "../../models/media/media.dal";

export interface DatabaseConfig {
    dbConnectionString: string;
}

export interface Models {
    mediaModel: MediaModel;
};

export interface Dals {
    mediaDal: MediaDal;
};