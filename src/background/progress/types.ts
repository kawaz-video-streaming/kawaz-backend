import { Types } from "@ido_kawaz/mongo-client";
import { z } from 'zod';
import { MediaMetadata, mediaMetadataZodSchema, MediaResultStatus } from "../../dal/media/model";
import { validateSchema } from '../../utils/zod';


export interface Progress {
    mediaId: string;
    status: MediaResultStatus;
    metadata?: MediaMetadata;
}

const progressSchema = z.object({
    mediaId: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' }),
    status: z.enum(['completed', 'failed']),
    metadata: mediaMetadataZodSchema.optional()
});

export const validateProgressPayload = validateSchema<Progress>(progressSchema);   