import { AmqpClient } from "@ido_kawaz/amqp-client";
import { RequestFile } from "@ido_kawaz/server-framework";
import { VodClient } from "@ido_kawaz/vod-client";
import { UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC } from "../../background/upload/binding";
import { Upload } from "../../background/upload/types";
import { MediaDal } from "../../dal/media";

export const createMediaLogic = (
  mediaDal: MediaDal,
  amqpClient: AmqpClient,
  vodClient: VodClient,
) => ({
  uploadMedia: async ({ path, originalname, mimetype, size }: RequestFile) => {
    const media = await mediaDal.createMedia(originalname, mimetype, size);
    amqpClient.publish<Upload>(UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC, { media, path });
  },
  getVideos: async () => vodClient.getVideos(),
  getVideoById: async (id: string) => vodClient.getVideoById(id),
  getManifest: async (id: string) => vodClient.getManifest(id),
  getSegmentUrl: async (id: string, filename: string) => vodClient.getSegmentUrl(id, filename),
  getVtt: async (id: string, filename: string) => vodClient.getVtt(id, filename),
});
