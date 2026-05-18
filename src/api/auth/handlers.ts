import { Request, Response, UnauthorizedError } from "@ido_kawaz/server-framework";
import { StatusCodes } from "http-status-codes";
import { isNil } from "ramda";
import { UserDal } from "../../dal/user";
import { Mailer } from "../../services/mailer";
import { requestHandlerDecorator } from "../../utils/decorator";
import { AuthenticatedRequest } from "../../utils/types";
import { createAuthLogic } from "./logic";
import { popNativeCode, storeNativeCode } from "./nativeCodeStore";
import {
  AuthConfig,
  validateAuthSignupRequest,
  validateForgotPasswordRequest,
  validateGoogleDevicePollRequest,
  validateLoginRequest,
  validateNativeExchangeRequest,
  validatePromoteRequest,
  validateResetPasswordRequest,
} from "./types";

export const createAuthHandlers = (
  authConfig: AuthConfig,
  mailer: Mailer,
  userDal: UserDal,
) => {
  const logic = createAuthLogic(authConfig, mailer, userDal);
  const sameSiteOption = authConfig.isProduction ? "none" : "strict";
  const cookieOptions = {
    httpOnly: true,
    sameSite: sameSiteOption as "none" | "strict",
    ...(authConfig.isProduction && { secure: true }),
    maxAge: 2 * 24 * 60 * 60 * 1000
  };
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
        res.status(StatusCodes.OK).cookie("kawaz-token", token, cookieOptions).json({ message: "Login successful" });
      },
    ),
    googleLogin: requestHandlerDecorator(
      "google login",
      async (req: Request, res: Response) => {
        const params = new URLSearchParams({
          client_id: authConfig.googleClientId,
          redirect_uri: `${authConfig.appDomain}/api/auth/google/callback`,
          response_type: "code",
          scope: "openid email profile",
          ...(req.query.return === "native" && { state: "native" }),
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
        if (req.query.state === "native") {
          try {
            const token = await logic.googleCallback(code);
            if (isNil(token)) {
              res.redirect(`${authConfig.nativeAppScheme}://auth/callback?pending=true`);
            } else {
              const nativeCode = storeNativeCode(token);
              res.redirect(`${authConfig.nativeAppScheme}://auth/callback?code=${nativeCode}`);
            }
          } catch {
            res.redirect(`${authConfig.nativeAppScheme}://auth/callback?error=true`);
          }
          return;
        }
        const token = await logic.googleCallback(code);
        if (isNil(token)) {
          res.redirect(`${authConfig.appDomain}/auth/callback?pending=true`);
        } else {
          res.cookie("kawaz-token", token, cookieOptions).redirect(`${authConfig.appDomain}/auth/callback`);
        }
      },
    ),
    googleDeviceStart: requestHandlerDecorator(
      "google device start",
      async (_req: Request, res: Response) => {
        const result = await logic.googleDeviceStart();
        res.status(StatusCodes.OK).json(result);
      },
    ),
    googleDevicePoll: requestHandlerDecorator(
      "google device poll",
      async (req: Request, res: Response) => {
        const { deviceCode } = validateGoogleDevicePollRequest(req);
        const result = await logic.googleDevicePoll(deviceCode);
        if (result.status === "authorized") {
          const { token, ...response } = result;
          res.cookie("kawaz-token", token, cookieOptions).status(StatusCodes.OK).json(response);
        } else {
          res.status(StatusCodes.OK).json(result);
        }
      },
    ),
    googleNativeExchange: requestHandlerDecorator(
      "google native exchange",
      async (req: Request, res: Response) => {
        const { code } = validateNativeExchangeRequest(req);
        const jwt = popNativeCode(code);
        if (isNil(jwt)) {
          throw new UnauthorizedError("Invalid or expired code");
        }
        res.cookie("kawaz-token", jwt, cookieOptions).status(StatusCodes.OK).json({ message: "Login successful" });
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
