import { MediaModel, Media } from "./media";

export class MediaDal {
  constructor(private readonly mediaModel: MediaModel) {}

  createMedia = async (media: Media) => this.mediaModel.insertOne(media);
}
