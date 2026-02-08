import { Media } from "../../models/media/media";
// import { MediaDal } from "../../models/media/media.dal";
import { StorageClient } from "../../services/storageClient";

export const createMediaLogic = (
  // mediaDal: MediaDal,
  storageClient: StorageClient,
) => ({
  uploadMedia: async (file: Express.Multer.File) => {
    const media: Media = {
      filename: file.originalname,
      contentType: file.mimetype,
      size: file.size,
      uploadedAt: new Date()
    };
    await storageClient.uploadObject("kawaz-plus", `uploads/${media.filename}`, file.buffer, { ensureBucket: true });
    // await mediaDal.createMedia(media);
  }
});
