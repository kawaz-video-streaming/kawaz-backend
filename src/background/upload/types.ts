import { Types } from "@ido_kawaz/mongo-client";
import { z } from 'zod';
import { MediaDocument, mediaStatuses } from '../../dal/media/model';
import { validateSchema } from '../../utils/zod';


export interface Upload {
    media: MediaDocument;
    path: string;
}

export interface ConvertMessage {
    mediaName: string;
    mediaStorageBucket: string;
    mediaRoutingKey: string;
    includesSubtitles: boolean;
}

const uploadSchema = z.object({
    media: z.object({
        _id: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' }).transform((v) => new Types.ObjectId(v)),
        name: z.string(),
        type: z.string(),
        size: z.coerce.number(),
        includesSubtitles: z.coerce.boolean().optional(),
        status: z.enum(mediaStatuses)
    }),
    path: z.string()
});

export const validateUploadPayload = validateSchema<Upload>(uploadSchema);   