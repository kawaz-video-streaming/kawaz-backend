import { Request, Response } from "@ido_kawaz/server-framework";
import { StatusCodes } from "http-status-codes";
import { UserDal } from '../../dal/user';
import { requestHandlerDecorator } from "../../utils/decorator";
import { createAuthLogic } from './logic';
import { validateAuthRequest } from "./types";

export const createAuthHandlers = (jwtSecret: string, userDal: UserDal) => {
    const logic = createAuthLogic(jwtSecret, userDal);
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
                })
    };
}
