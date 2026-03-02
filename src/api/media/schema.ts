import { BadRequestError, Request, RequestFile } from "@ido_kawaz/server-framework";
import z from "zod";

export const mediaUploadRequestSchema = z.object({
    body: z.object({
        includeSubtitle: z.boolean().optional()
    }).optional(),
    file: z.object({
        path: z.string(),
        originalname: z.string(),
        mimetype: z.string(),
        size: z.number()
    }).refine(file => file !== undefined, {
        message: "file is required for uploading media"
    })
});

interface ValidatedMediaUploadRequest {
    includeSubtitle?: boolean;
    file: RequestFile;
}

export const validateMediaUploadRequest = (req: Request): ValidatedMediaUploadRequest => {
    const res = mediaUploadRequestSchema.safeParse(req);
    if (!res.success) {
        throw new BadRequestError(`Invalid request: \n${res.error.issues.map(detail => detail.message).join(',\n')}`);
    }
    return req as ValidatedMediaUploadRequest;
}