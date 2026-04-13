import { Types } from "@ido_kawaz/mongo-client";
import { z } from 'zod';
import { MediaMetadata, mediaMetadataZodSchema, MediaStatus } from "../../dal/media/model";
import { validateSchema } from '../../utils/zod';


export interface Progress {
    mediaId: string;
    status: MediaStatus;
    percentage: number;
    metadata?: MediaMetadata;
}

const progressSchema = z.object({
    mediaId: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' }),
    status: z.enum(['completed', 'failed', 'processing', 'pending']),
    percentage: z.coerce.number().min(0).max(100),
    metadata: mediaMetadataZodSchema.optional()
});

export const validateProgressPayload = validateSchema<Progress>(progressSchema);   