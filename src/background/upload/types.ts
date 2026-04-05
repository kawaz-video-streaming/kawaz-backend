import { z } from 'zod';
import { Media, mediaZodSchema } from '../../dal/media/model';
import { validateSchema } from '../../utils/zod';


export interface Upload {
    media: Media;
    mediaPath: string;
    thumbnailPath?: string;
}

export interface ConvertMessage {
    mediaId: string;
    mediaFileName: string;
    mediaStorageBucket: string;
    mediaRoutingKey: string;
}

const uploadSchema = z.object({
    media: mediaZodSchema,
    mediaPath: z.string(),
    thumbnailPath: z.string().optional()
}) satisfies z.ZodType<Upload>;

export const validateUploadPayload = validateSchema<Upload>(uploadSchema);   