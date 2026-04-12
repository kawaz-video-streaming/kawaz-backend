import { isNotNil } from "ramda";
import { MediaDal } from "../../dal/media";
import { COMPLETED } from "../../dal/media/model";
import { Progress } from "./types";

export const mediaProgressHandler = (mediaDal: MediaDal) =>
    async ({ mediaId, status, percentage, metadata }: Progress) => {
        await mediaDal.updateMedia(mediaId, { status, percentage, ...((status === COMPLETED && isNotNil(metadata)) && { metadata }) });
    }