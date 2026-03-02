import { AmqpClient } from "@ido_kawaz/amqp-client";
import { RequestFile } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { MediaDal } from "../../dal/media";
import { ConvertMediaMessage } from "./types";

export const createMediaLogic = (
  mediaDal: MediaDal,
  storageClient: StorageClient,
  amqpClient: AmqpClient,
  storagePartSize: number
) => ({
  uploadMedia: async ({ path: filePath, originalname: fileName, mimetype: fileType, size: fileSize }: RequestFile, includeSubtitles?: boolean) => {
    const fileData = createReadStream(filePath);
    const bucket = "kawaz-plus";
    const path = `raw/${fileName}`;
    await storageClient.uploadObject(bucket, path, fileData, { ensureBucket: true, multipartUpload: fileSize > storagePartSize });
    await mediaDal.createMedia(fileName, fileType, fileSize);
    if (fileType === "video/mp4") {
      const message: ConvertMediaMessage = {
        mediaName: fileName,
        mediaStorageBucket: bucket,
        mediaRoutingKey: path,
        areSubtitlesIncluded: includeSubtitles ?? false
      };
      amqpClient.publish<ConvertMediaMessage>("converter", "uploaded.media", message);
    }
  }
});
