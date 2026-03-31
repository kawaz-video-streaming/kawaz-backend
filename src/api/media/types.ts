import { BadRequestError, Request, RequestFile } from "@ido_kawaz/server-framework";
import z from "zod";

export const mediaUploadRequestSchema = z.object({
    file: z.object({
        path: z.string(),
        originalname: z.string(),
        mimetype: z.string().refine(
            mime => mime.startsWith('video/'),
            { message: "Only video files are allowed" }
        ),
        size: z.number()
    }).refine(file => file !== undefined, {
        message: "file is required for uploading media"
    })
});

interface ValidatedMediaUploadRequest {
    file: RequestFile;
}

export const validateMediaUploadRequest = (req: Request): ValidatedMediaUploadRequest => {
    const validationResult = mediaUploadRequestSchema.safeParse(req);
    if (!validationResult.success) {
        throw new BadRequestError(`Invalid request: \n${validationResult.error.issues.map(detail => detail.message).join(',\n')}`);
    }
    return req as ValidatedMediaUploadRequest;
}