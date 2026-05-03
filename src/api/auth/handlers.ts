import { Request, Response } from "@ido_kawaz/server-framework";
import { StatusCodes } from "http-status-codes";
import { UserDal } from "../../dal/user";
import { Mailer } from "../../services/mailer";
import { requestHandlerDecorator } from "../../utils/decorator";
import { AuthenticatedRequest } from "../../utils/types";
import { createAuthLogic } from "./logic";
import {
  AuthConfig,
  validateAuthSignupRequest,
  validateForgotPasswordRequest,
  validateLoginRequest,
  validatePromoteRequest,
  validateResetPasswordRequest,
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
        const { username, password, email } = validateAuthSignupRequest(req);
        await logic.signUp(username, password, email);
        res.status(StatusCodes.ACCEPTED).json({ message: "Signup finished. Your account is awaiting admin approval" });
      },
    ),
    login: requestHandlerDecorator(
      "login",
      async (req: Request, res: Response) => {
        const { username, password } = validateLoginRequest(req);
        const token = await logic.login(username, password);
        res.status(StatusCodes.OK).cookie("kawaz-token", token, {
          httpOnly: true,
          sameSite: "strict",
          maxAge: 2 * 24 * 60 * 60 * 1000
        }).json({ message: "Login successful" });
      },
    ),
    googleLogin: requestHandlerDecorator(
      "google login",
      async (_req: Request, res: Response) => {
        const params = new URLSearchParams({
          client_id: authConfig.googleClientId,
          redirect_uri: `${authConfig.appDomain}/api/auth/google/callback`,
          response_type: "code",
          scope: "openid email profile",
        });
        const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
        res.redirect(redirectUrl);
      },
    ),
    googleCallback: requestHandlerDecorator(
      "google callback",
      async (req: Request, res: Response) => {
        const code = req.query.code;
        if (typeof code !== "string") {
          res.status(StatusCodes.BAD_REQUEST).json({ message: "Invalid code" });
          return;
        }
        const token = await logic.googleCallback(code);
        if (token === null) {
          res.status(StatusCodes.ACCEPTED).json({ message: "Signup finished. Your account is awaiting admin approval" });
        } else {
          res.status(StatusCodes.OK).cookie("kawaz-token", token, {
            httpOnly: true,
            sameSite: "strict",
            maxAge: 2 * 24 * 60 * 60 * 1000
          }).json({ message: "Login successful" });
        }
      },
    ),
    promoteAdmin: requestHandlerDecorator(
      "promote admin",
      async (req: Request, res: Response) => {
        const { secret, username } = validatePromoteRequest(req);
        await logic.promoteAdmin(secret, username);
        res.status(StatusCodes.OK).json({ message: `User "${username}" promoted to admin` });
      },
    ),
    forgotPassword: requestHandlerDecorator(
      "forgot password",
      async (req: Request, res: Response) => {
        const { email } = validateForgotPasswordRequest(req);
        await logic.forgotPassword(email);
        res.status(StatusCodes.OK).json({ message: "If an account with that email exists, a password reset email has been sent" });
      },
    ),
    resetPassword: requestHandlerDecorator(
      "reset password",
      async (req: Request, res: Response) => {
        const { token, newPassword } = validateResetPasswordRequest(req);
        await logic.resetPassword(token, newPassword);
        res.status(StatusCodes.OK).json({ message: "Password reset successful" });
      },
    )
  };
};
