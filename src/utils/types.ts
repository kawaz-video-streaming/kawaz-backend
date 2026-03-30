import { Request } from "@ido_kawaz/server-framework";

export const ADMIN_ROLE = "admin";
export const USER_ROLE = "user";

export const roles = [ADMIN_ROLE, USER_ROLE] as const;

export type Role = typeof roles[number];

export interface AuthenticatedRequest extends Request {
    user: {
        username: string;
        role: Role;
    }
}