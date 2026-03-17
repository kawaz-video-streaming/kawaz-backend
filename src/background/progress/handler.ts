import { MediaDal } from "../../dal/media";
import { Progress } from "./types";

export const mediaProgressHandler = (mediaDal: MediaDal) =>
    async ({ mediaId, status }: Progress) => mediaDal.updateMediaStatus(mediaId, status);