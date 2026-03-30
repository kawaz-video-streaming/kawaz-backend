import { BadRequestError, Request } from "@ido_kawaz/server-framework";
import z from "zod";
import { Role } from "../../utils/types";

export interface AuthConfig {
    jwtSecret: string;
    adminPromotionSecret: string;
}

export interface TokenPayload {
    username: string;
    role: Role;
}

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

const promoteRequestSchema = z.object({
    username: z.string().min(3, "Username is required"),
});

export const validatePromoteRequest = (req: Request): { secret: string; username: string } => {
    const secret = req.headers['x-admin-secret'];
    if (typeof secret !== 'string' || !secret) {
        throw new BadRequestError("Missing x-admin-secret header");
    }
    const validationResult = promoteRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new BadRequestError(`Invalid request: \n${validationResult.error.issues.map(detail => detail.message).join(',\n')}`);
    }
    return { secret, username: validationResult.data.username };
}