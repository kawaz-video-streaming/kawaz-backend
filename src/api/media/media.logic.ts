import { AmqpClient } from "@ido_kawaz/amqp-client";
import { StorageClient } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { MediaDal } from "../../models/media/media.dal";

export const createMediaLogic = (
  mediaDal: MediaDal,
  storageClient: StorageClient,
  amqpClient: AmqpClient
) => ({
  uploadMedia: async ({ path: filePath, originalname: fileName, mimetype: fileType, size: fileSize }: Express.Multer.File) => {
    const fileData = createReadStream(filePath);
    const bucket = "kawaz-plus";
    const path = `raw/${fileName}`;
    await storageClient.uploadObject(bucket, path, fileData, { ensureBucket: true });
    await mediaDal.createMedia(fileName, fileType, fileSize);
    if (fileType === "video/mp4") {
      amqpClient.publish("converter", "uploaded.media", { bucket, path });
    }
  }
});
