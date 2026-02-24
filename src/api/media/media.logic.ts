import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { MediaDal } from "../../models/media/media.dal";

export const createMediaLogic = (
  mediaDal: MediaDal,
  storageClient: StorageClient,
  amqpClient: AmqpClient
) => ({
  uploadMedia: async (file: Express.Multer.File) => {
    const fileData = createReadStream(file.path);
    const bucket = "kawaz-plus";
    const path = `raw/${file.originalname}`;
    await storageClient.uploadObject(bucket, path, fileData, { ensureBucket: true });
    await mediaDal.createMedia(file.originalname, file.mimetype, file.size);
    if (file.mimetype == "video/mp4") {
      amqpClient.publish("converter", "media.uploaded", { bucket, path });
    }
  }
});
