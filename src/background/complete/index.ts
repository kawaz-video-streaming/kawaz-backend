import { Consumer } from "@ido_kawaz/amqp-client";
import { MediaDal } from "../../dal/media";
import { CompleteConsumerBinding, createCompleteConsumerBinding } from "./binding";
import { completeMediaHandler } from "./handler";
import { Complete, validateCompletePayload } from "./types"
import { UpdateWriteOpResult } from "@ido_kawaz/mongo-client";


export const createCompleteConsumer = (mediaDal: MediaDal) =>
    new Consumer<Complete, CompleteConsumerBinding, UpdateWriteOpResult>('complete', createCompleteConsumerBinding())
        .on('validateMessage', validateCompletePayload)
        .on('handleMessage', completeMediaHandler(mediaDal))