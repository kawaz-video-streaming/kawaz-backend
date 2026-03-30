import { Request, Response } from "@ido_kawaz/server-framework";
import { StatusCodes } from "http-status-codes";
import { UserDal } from '../../dal/user';
import { requestHandlerDecorator } from "../../utils/decorator";
import { createAuthLogic } from './logic';
import { AuthConfig, validateAuthRequest, validatePromoteRequest } from "./types";

export const createAuthHandlers = (authConfig: AuthConfig, userDal: UserDal) => {
    const logic = createAuthLogic(authConfig, userDal);
    return {
        signUp:
            requestHandlerDecorator(
                'signup',
                async (req: Request, res: Response) => {
                    const { username, password } = validateAuthRequest(req);
                    const token = await logic.signUp(username, password);
                    res.status(StatusCodes.CREATED).json({ token });
                }),
        login:
            requestHandlerDecorator(
                'login',
                async (req: Request, res: Response) => {
                    const { username, password } = validateAuthRequest(req);
                    const token = await logic.login(username, password);
                    res.status(StatusCodes.OK).json({ token });
                }),
        promoteAdmin:
            requestHandlerDecorator(
                'promoteAdmin',
                async (req: Request, res: Response) => {
                    const { secret, username } = validatePromoteRequest(req);
                    await logic.promoteAdmin(secret, username);
                    res.status(StatusCodes.OK).json({ message: `User "${username}" promoted to admin` });
                })
    };
}
