import { AmqpClient } from "@ido_kawaz/amqp-client";
import { RequestFile } from "@ido_kawaz/server-framework";
import { UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC } from "../../background/upload/binding";
import { Upload } from "../../background/upload/types";
import { MediaDal } from "../../dal/media";

export const createMediaLogic = (
  mediaDal: MediaDal,
  amqpClient: AmqpClient,
) => ({
  uploadMedia: async ({ path, originalname, mimetype, size }: RequestFile) => {
    const media = await mediaDal.createMedia(originalname, mimetype, size);
    amqpClient.publish<Upload>(UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC, { media, path });
  }
});
