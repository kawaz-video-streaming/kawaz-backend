import { BadRequestError, Request } from '@ido_kawaz/server-framework';
import { z } from 'zod';
import { RequestWithIdParam, requestWithIdParamZodSchema } from './types';


export const validateSchema = <T>(schema: z.ZodType<T>) => (payload: any): payload is T => {
    const result = schema.safeParse(payload);
    return result.success;
}

export const validateRequest = <T>(schema: z.ZodType<T>) => (req: Request): T => {
    const validationResult = schema.safeParse(req);
    if (!validationResult.success) {
        throw new BadRequestError(`Invalid request: \n${validationResult.error.issues.map(detail => detail.message).join(',\n')}`);
    }
    return validationResult.data;
}

export const validateRequestWithId = validateRequest<RequestWithIdParam>(requestWithIdParamZodSchema);