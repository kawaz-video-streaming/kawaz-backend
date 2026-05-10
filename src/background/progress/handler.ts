import { isNotNil } from "ramda";
import { MediaDal } from "../../dal/media";
import { COMPLETED } from "../../dal/media/model";
import { Progress } from "./types";

export const mediaProgressHandler = (mediaDal: MediaDal, specialMediaDal: MediaDal) =>
    async ({ mediaId, status, percentage, metadata }: Progress) => {
        const update = { status, percentage, ...((status === COMPLETED && isNotNil(metadata)) && { metadata }) };
        await Promise.all([
            mediaDal.updateMedia(mediaId, update),
            specialMediaDal.updateMedia(mediaId, update),
        ]);
    }