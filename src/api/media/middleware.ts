import { Request, Response, NextFunction } from "@ido_kawaz/server-framework";
import { MediaAuthenticatedRequest } from "./types";
import { ADMIN_ROLE, AuthenticatedRequest, SPECIAL_USER_ROLE, USER_ROLE } from "../../utils/types";
import { Dals } from "../../dal/types";

export const decideMediaAndMediaCollectionDalByUserRoleMiddleware = ({ mediaDal, specialMediaDal, mediaCollectionDal, specialMediaCollectionDal }: Dals) => (req: Request, _res: Response, next: NextFunction): void => {
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
    }
    next();
}