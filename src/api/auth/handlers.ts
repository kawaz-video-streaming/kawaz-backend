import { Request, Response } from "@ido_kawaz/server-framework";
import { StatusCodes } from "http-status-codes";
import { UserDal } from "../../dal/user";
import { Mailer } from "../../services/mailer";
import { requestHandlerDecorator } from "../../utils/decorator";
import { AuthenticatedRequest } from "../../utils/types";
import { createAuthLogic } from "./logic";
import {
  AuthConfig,
  validateAuthRequest,
  validateLoginRequest,
  validatePromoteRequest,
} from "./types";

export const createAuthHandlers = (
  authConfig: AuthConfig,
  mailer: Mailer,
  userDal: UserDal,
) => {
  const logic = createAuthLogic(authConfig, mailer, userDal);
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
            maxAge: 2 * 24 * 60 * 60 * 1000,
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
