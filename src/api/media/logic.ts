import { AmqpClient } from "@ido_kawaz/amqp-client";
import { RequestFile } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { MediaDal } from "../../dal/media";

export const createMediaLogic = (
  mediaDal: MediaDal,
  storageClient: StorageClient,
  amqpClient: AmqpClient
) => ({
  uploadMedia: async ({ path: filePath, originalname: fileName, mimetype: fileType, size: fileSize }: RequestFile) => {
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
