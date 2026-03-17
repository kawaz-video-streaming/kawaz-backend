import { Types } from "@ido_kawaz/mongo-client";
import { z } from 'zod';
import { validateSchema } from '../../utils/zod';
import { MediaResultStatus } from "../../dal/media/model";


export interface Progress {
    mediaId: string;
    status: MediaResultStatus;
}

const progressSchema = z.object({
    mediaId: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' }),
    status: z.enum(['completed', 'failed'])
});

export const validateProgressPayload = validateSchema<Progress>(progressSchema);   