import { NextFunction, Request, Response } from "@ido_kawaz/server-framework";
import jwt from "jsonwebtoken";
import { isNil } from "ramda";
import { UserDal } from "../dal/user";
import { ADMIN_ROLE, AuthenticatedRequest } from "../utils/types";
import { AuthConfig, TokenPayload } from "./auth/types";

export const createAuthMiddleware = ({ jwtSecret }: AuthConfig, userDal: UserDal) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const token = req.cookies?.["kawaz-token"];
        if (isNil(token)) {
            res.status(401).json({ message: "no token provided" });
            return;
        }
        try {
            const payload = jwt.verify(token, jwtSecret) as TokenPayload;
            const user = await userDal.findUser(payload.username);
            if (isNil(user) || user.role !== payload.role) {
                res.status(401).json({ message: "Invalid or expired token" });
                return;
            }
            (req as AuthenticatedRequest).user = { username: user.name, role: user.role };
            next();
        } catch {
            res.status(401).json({ message: "Invalid or expired token" });
        }
    }

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;
    if (authenticatedReq.user.role !== ADMIN_ROLE) {
        res.status(401).json({ message: "Admin access required" });
        return;
    }
    next();
}