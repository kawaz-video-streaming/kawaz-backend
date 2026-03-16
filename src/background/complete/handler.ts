import { MediaDal } from "../../dal/media";
import { Complete } from "./types";

export const completeMediaHandler = (mediaDal: MediaDal) =>
    async ({ mediaId }: Complete) => mediaDal.updateMediaStatus(mediaId, "completed");