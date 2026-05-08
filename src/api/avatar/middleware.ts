import { Request, Response, NextFunction } from "@ido_kawaz/server-framework";
import { AvatarAuthenticatedRequest } from "./types";
import { ADMIN_ROLE, AuthenticatedRequest, SPECIAL_USER_ROLE, USER_ROLE } from "../../utils/types";
import { Dals } from "../../dal/types";

export const decideAvatarDalByUserRoleMiddleware = ({ avatarDal, specialAvatarDal }: Dals) => (req: Request, _res: Response, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;
    if (authenticatedReq.user.role === USER_ROLE) {
        (req as AvatarAuthenticatedRequest).avatarDal = avatarDal;
    } else if (authenticatedReq.user.role === SPECIAL_USER_ROLE) {
        (req as AvatarAuthenticatedRequest).avatarDal = specialAvatarDal;
    } else if (authenticatedReq.user.role === ADMIN_ROLE) {
        (req as AvatarAuthenticatedRequest).avatarDal = req.query.special === "true" ? specialAvatarDal : avatarDal;
    }
    next();
}