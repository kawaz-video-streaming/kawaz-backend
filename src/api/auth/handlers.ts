import { Request, Response } from "@ido_kawaz/server-framework";
import { StatusCodes } from "http-status-codes";
import { UserDal } from "../../dal/user";
import { requestHandlerDecorator } from "../../utils/decorator";
import { createAuthLogic } from "./logic";
import {
  AuthConfig,
  validateAuthRequest,
  validateLoginRequest,
  validatePromoteRequest,
} from "./types";
import { AuthenticatedRequest } from "../../utils/types";

export const createAuthHandlers = (
  authConfig: AuthConfig,
  userDal: UserDal,
) => {
  const logic = createAuthLogic(authConfig, userDal);
  return {
    me: requestHandlerDecorator("me", async (req: Request, res: Response) => {
      const authenticatedReq = req as AuthenticatedRequest;
      res.json(authenticatedReq.user);
    }),
    signUp: requestHandlerDecorator(
      "signup",
      async (req: Request, res: Response) => {
        const { username, password, email } = validateAuthRequest(req);
        await logic.signUp(username, password, email);
        res.status(StatusCodes.ACCEPTED).json({
          message: "signup finished. Your account is awaiting admin approval",
        });
      },
    ),
    login: requestHandlerDecorator(
      "login",
      async (req: Request, res: Response) => {
        const { username, password } = validateLoginRequest(req);
        const token = await logic.login(username, password);
        res
          .status(StatusCodes.OK)
          .cookie("kawaz-token", token, {
            httpOnly: true,
            sameSite: "strict",
          })
          .json({ message: "Login successful" });
      },
    ),
    promoteAdmin: requestHandlerDecorator(
      "promoteAdmin",
      async (req: Request, res: Response) => {
        const { secret, username } = validatePromoteRequest(req);
        await logic.promoteAdmin(secret, username);
        res
          .status(StatusCodes.OK)
          .json({ message: `User "${username}" promoted to admin` });
      },
    ),
  };
};
