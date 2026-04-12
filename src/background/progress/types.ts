import { Types } from "@ido_kawaz/mongo-client";
import { z } from 'zod';
import { MediaMetadata, mediaMetadataZodSchema, MediaResultStatus } from "../../dal/media/model";
import { validateSchema } from '../../utils/zod';


export interface Progress {
    mediaId: string;
    status: MediaResultStatus;
    percentage: number;
    metadata?: MediaMetadata;
}

const progressSchema = z.object({
    mediaId: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' }),
    status: z.enum(['completed', 'failed']),
    percentage: z.coerce.number().min(0).max(100),
    metadata: mediaMetadataZodSchema.optional()
});

export const validateProgressPayload = validateSchema<Progress>(progressSchema);   