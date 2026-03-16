import { Types } from "@ido_kawaz/mongo-client";
import { z } from 'zod';
import { Media, mediaStatuses } from '../../dal/media/model';
import { validateSchema } from '../../utils/zod';


export interface Upload {
    media: Media;
    path: string;
}

export interface ConvertMessage {
    mediaId: string;
    mediaName: string;
    mediaStorageBucket: string;
    mediaRoutingKey: string;
}

const uploadSchema = z.object({
    media: z.object({
        _id: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' }),
        name: z.string(),
        type: z.string(),
        size: z.coerce.number(),
        status: z.enum(mediaStatuses)
    }),
    path: z.string()
});

export const validateUploadPayload = validateSchema<Upload>(uploadSchema);   