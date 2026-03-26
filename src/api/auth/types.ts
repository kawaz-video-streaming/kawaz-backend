import { BadRequestError, Request } from "@ido_kawaz/server-framework";
import z from "zod";

export const authRequestSchema = z.object({
    username: z.string().min(3, "Username is required"),
    password: z.string().min(12, "Password is required")
});

interface ValidatedAuthRequest {
    username: string;
    password: string;
}

export const validateAuthRequest = (req: Request): ValidatedAuthRequest => {
    const validationResult = authRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new BadRequestError(`Invalid request: \n${validationResult.error.issues.map(detail => detail.message).join(',\n')}`);
    }
    return validationResult.data;
}