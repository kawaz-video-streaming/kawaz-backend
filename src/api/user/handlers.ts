import { ConflictError, NotFoundError, Request, Response } from "@ido_kawaz/server-framework";
import { UserDal } from '../../dal/user';
import { requestHandlerDecorator } from "../../utils/decorator";
import { AuthenticatedRequest } from "../../utils/types";
import { validateUserProfileRequest } from "./types";

export const createUserHandlers = (userDal: UserDal) => {
    return {
        me: requestHandlerDecorator(
            'me',
            async (req: Request, res: Response) => {
                const authenticatedReq = req as AuthenticatedRequest;
                res.json(authenticatedReq.user);
            }),
        createProfile: requestHandlerDecorator(
            'create new user profile',
            async (req: Request, res: Response) => {
                const { user: { username } } = req as AuthenticatedRequest;
                const { body: { profileName, avatarId } } = validateUserProfileRequest(req);
                const newProfile = { name: profileName, avatarId };
                const success = await userDal.createProfile(username, newProfile);
                if (success) {
                    res.status(201).json({ message: "Profile created successfully" });
                } else {
                    throw new ConflictError("Profile with the same name already exists for this user");
                }
            }
        ),
        updateProfileAvatar: requestHandlerDecorator(
            'update user profile avatar',
            async (req: Request, res: Response) => {
                const { user: { username } } = req as AuthenticatedRequest;
                const { body: { avatarId, profileName } } = validateUserProfileRequest(req);
                const success = await userDal.updateProfileAvatar(username, profileName, avatarId);
                if (success) {
                    res.status(200).json({ message: "Profile avatar updated successfully" });
                } else {
                    throw new NotFoundError("Profile not found for this user");
                }
            }
        ),
        deleteProfile: requestHandlerDecorator(
            'delete user profile',
            async (req: Request, res: Response) => {
                const { user: { username } } = req as AuthenticatedRequest;
                const profileName = req.params.name as string;
                await userDal.deleteProfile(username, profileName);
                res.json({ message: "Profile deleted successfully" });
            }
        ),
        getUserProfiles: requestHandlerDecorator(
            'get user profiles',
            async (req: Request, res: Response) => {
                const { user: { username } } = req as AuthenticatedRequest;
                const profiles = await userDal.getUserProfiles(username);
                res.json({ profiles });
            }
        )
    }
}
