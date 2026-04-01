import { isNotNil } from "ramda";
import { MediaDal } from "../../dal/media";
import { COMPLETED } from "../../dal/media/model";
import { Progress } from "./types";

export const mediaProgressHandler = (mediaDal: MediaDal) =>
    async ({ mediaId, status, metadata }: Progress) => {
        await mediaDal.updateMediaStatus(mediaId, status);
        if (status === COMPLETED && isNotNil(metadata)) {
            await mediaDal.updateMediaMetadata(mediaId, metadata);
        }
    }