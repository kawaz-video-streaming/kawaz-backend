import { createReadStream } from "fs";
import { MediaDal } from "../../models/media/media.dal";
import { StorageClient } from "../../services/storageClient/storageClient";

export const createMediaLogic = (
  mediaDal: MediaDal,
  storageClient: StorageClient,
) => ({
  uploadMedia: async (file: Express.Multer.File) => {
    const fileData = createReadStream(file.path);
    await storageClient.uploadObject("kawaz-plus", `raw/${file.originalname}`, fileData, { ensureBucket: true });
    await mediaDal.createMedia(file.originalname, file.mimetype, file.size);
  }
});
