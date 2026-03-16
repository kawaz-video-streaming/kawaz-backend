import { Types } from "@ido_kawaz/mongo-client";
import { z } from 'zod';
import { validateSchema } from '../../utils/zod';


export interface Complete {
    mediaId: string;
}

const completeSchema = z.object({
    mediaId: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' })
});

export const validateCompletePayload = validateSchema<Complete>(completeSchema);   