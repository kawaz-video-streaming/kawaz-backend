import { Consumer } from "@ido_kawaz/amqp-client";
import { MediaDal } from "../../dal/media";
import { createProgressConsumerBinding, ProgressConsumerBinding } from "./binding";
import { mediaProgressHandler } from "./handler";
import { Progress, validateProgressPayload } from "./types";


export const createProgressConsumer = (mediaDal: MediaDal, specialMediaDal: MediaDal) =>
    new Consumer<Progress, ProgressConsumerBinding>('progress', createProgressConsumerBinding())
        .on('validateMessage', validateProgressPayload)
        .on('handleMessage', mediaProgressHandler(mediaDal, specialMediaDal))