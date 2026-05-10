import { NextFunction, Request, Response } from "@ido_kawaz/server-framework";
import jwt from "jsonwebtoken";
import { isNil } from "ramda";
import { Dals } from "../dal/types";
import { UserDal } from "../dal/user";
import { ADMIN_ROLE, AuthenticatedRequest, SPECIAL_USER_ROLE, USER_ROLE } from "../utils/types";
import { AuthConfig, TokenPayload } from "./auth/types";
import { AvatarAuthenticatedRequest, MediaAuthenticatedRequest } from "./types";


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

export const decideAvatarDalByUserRoleMiddleware = ({ avatarDal, specialAvatarDal }: Dals) => (req: Request, res: Response, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;
    if (authenticatedReq.user.role === USER_ROLE) {
        (req as AvatarAuthenticatedRequest).avatarDal = avatarDal;
    } else if (authenticatedReq.user.role === SPECIAL_USER_ROLE) {
        (req as AvatarAuthenticatedRequest).avatarDal = specialAvatarDal;
    } else if (authenticatedReq.user.role === ADMIN_ROLE) {
        (req as AvatarAuthenticatedRequest).avatarDal = req.query.special === "true" ? specialAvatarDal : avatarDal;
    } else {
        res.status(401).json({ message: "user role does not exist" });
        return;
    }
    next();
}

export const decideMediaAndMediaCollectionDalByUserRoleMiddleware = ({ mediaDal, specialMediaDal, mediaCollectionDal, specialMediaCollectionDal }: Dals) => (req: Request, res: Response, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;
    if (authenticatedReq.user.role === USER_ROLE) {
        (req as MediaAuthenticatedRequest).mediaDal = mediaDal;
        (req as MediaAuthenticatedRequest).mediaCollectionDal = mediaCollectionDal;
    } else if (authenticatedReq.user.role === SPECIAL_USER_ROLE) {
        (req as MediaAuthenticatedRequest).mediaDal = specialMediaDal;
        (req as MediaAuthenticatedRequest).mediaCollectionDal = specialMediaCollectionDal;
    } else if (authenticatedReq.user.role === ADMIN_ROLE) {
        if (req.query.special === "true") {
            (req as MediaAuthenticatedRequest).mediaDal = specialMediaDal;
            (req as MediaAuthenticatedRequest).mediaCollectionDal = specialMediaCollectionDal;
        } else {
            (req as MediaAuthenticatedRequest).mediaDal = mediaDal;
            (req as MediaAuthenticatedRequest).mediaCollectionDal = mediaCollectionDal;
        }
    } else {
        res.status(401).json({ message: "user role does not exist" });
        return;
    }
    next();
}
