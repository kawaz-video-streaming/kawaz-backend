import { ConflictError, Request, Response, UnauthorizedError } from "@ido_kawaz/server-framework";
import { decode } from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import { isNil, isNotNil } from "ramda";
import { UserDal } from "../../dal/user";
import { Mailer } from "../../services/mailer";
import { requestHandlerDecorator } from "../../utils/decorator";
import { AuthenticatedRequest } from "../../utils/types";
import { createAuthLogic } from "./logic";
import { popNativeCode, storeNativeCode } from "./nativeCodeStore";
import { initNonce, pollNonce, resolveNonce } from "./nativePollStore";
import { parseAppleUserName, verifyAppleIdentityToken } from "./utils";
import {
  AuthConfig,
  validateAuthSignupRequest,
  validateForgotPasswordRequest,
  validateGoogleDevicePollRequest,
  validateLoginRequest,
  validateNativeExchangeRequest,
  validateNativePollRequest,
  validatePromoteRequest,
  validateResetPasswordRequest,
} from "./types";
import { APPROVED_STATUS } from "../../dal/user/model";
import { NATIVE_SUCCESS_HTML } from "./consts";

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
    maxAge: 30 * 24 * 60 * 60 * 1000
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
        const { token, role, username: name } = await logic.login(username, password);
        res.status(StatusCodes.OK).cookie("kawaz-token", token, cookieOptions).json({ message: "Login successful", role, username: name, token });
      },
    ),
    googleLogin: requestHandlerDecorator(
      "google login",
      async (req: Request, res: Response) => {
        const nonce = typeof req.query.nonce === "string" ? req.query.nonce : null;
        if (isNotNil(nonce)) {
          initNonce(nonce);
        }
        const state = nonce ? `native:${nonce}` : (req.query.return === "native" ? "native" : undefined);
        const params = new URLSearchParams({
          client_id: authConfig.googleClientId,
          redirect_uri: `${authConfig.appDomain}/api/auth/google/callback`,
          response_type: "code",
          scope: "openid email profile",
          ...(isNotNil(state) && { state }),
        });
        res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
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
        const state = typeof req.query.state === "string" ? req.query.state : null;
        const nonce = state?.startsWith("native:") ? state.slice(7) : null;
        if (isNotNil(nonce)) {
          try {
            const token = await logic.googleCallback(code);
            if (isNil(token)) {
              resolveNonce(nonce, { status: "pending_approval" });
            } else {
              resolveNonce(nonce, { status: "success", code: storeNativeCode(token), provider: "google" });
            }
          } catch (err) {
            resolveNonce(nonce, { status: "error", ...(err instanceof ConflictError && { reason: "conflict" }) });
          }
          res.send(NATIVE_SUCCESS_HTML);
          return;
        }
        if (state === "native") {
          try {
            const token = await logic.googleCallback(code);
            if (isNil(token)) {
              res.redirect(`${authConfig.nativeAppScheme}://auth/callback?pending=true`);
            } else {
              const nativeCode = storeNativeCode(token);
              res.redirect(`${authConfig.nativeAppScheme}://auth/callback?code=${nativeCode}`);
            }
          } catch (err) {
            if (err instanceof ConflictError) {
              res.redirect(`${authConfig.nativeAppScheme}://auth/callback?error=conflict`);
            } else {
              res.redirect(`${authConfig.nativeAppScheme}://auth/callback?error=true`);
            }
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
        if (result.status === APPROVED_STATUS) {
          const { token, ...response } = result;
          res.cookie("kawaz-token", token, cookieOptions).status(StatusCodes.OK).json({ ...response, token });
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
        const payload = decode(jwt) as { username?: string; role?: string } | null;
        res.cookie("kawaz-token", jwt, cookieOptions).status(StatusCodes.OK).json({ message: "Login successful", role: payload?.role, username: payload?.username, token: jwt });
      },
    ),
    appleLogin: requestHandlerDecorator(
      "apple login",
      async (req: Request, res: Response) => {
        const nonce = typeof req.query.nonce === "string" ? req.query.nonce : null;
        if (isNotNil(nonce)) {
          initNonce(nonce);
        }
        const state = nonce ? `native:${nonce}` : (req.query.return === "native" ? "native" : undefined);
        const params = new URLSearchParams({
          client_id: authConfig.appleClientId,
          redirect_uri: `${authConfig.appDomain}/api/auth/apple/callback`,
          response_type: "code id_token",
          scope: "name email",
          response_mode: "form_post",
          ...(isNotNil(state) && { state }),
        });
        res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
      },
    ),
    appleCallback: requestHandlerDecorator(
      "apple callback",
      async (req: Request, res: Response) => {
        const state = typeof req.body.state === "string" ? req.body.state : null;
        const nonce = state?.startsWith("native:") ? state.slice(7) : null;
        if (typeof req.body.error === "string") {
          if (isNotNil(nonce)) {
            resolveNonce(nonce, { status: "error" });
            res.send(NATIVE_SUCCESS_HTML);
          } else if (state === "native") {
            res.redirect(`${authConfig.nativeAppScheme}://auth/callback?error=true`);
          } else {
            res.redirect(`${authConfig.appDomain}/auth/callback?error=true`);
          }
          return;
        }
        const identityToken = req.body.id_token;
        if (typeof identityToken !== "string") {
          res.status(StatusCodes.BAD_REQUEST).json({ message: "Invalid callback" });
          return;
        }
        const { sub: appleId, email } = await verifyAppleIdentityToken(identityToken, authConfig.appleClientId);
        const { givenName, familyName } = parseAppleUserName(req.body.user);
        const result = await logic.appleSignIn(appleId, email, givenName, familyName);
        if (isNotNil(nonce)) {
          if (isNil(result)) {
            resolveNonce(nonce, { status: "pending_approval" });
          } else {
            resolveNonce(nonce, { status: "success", code: storeNativeCode(result.token), provider: "apple" });
          }
          res.send(NATIVE_SUCCESS_HTML);
        } else if (state === "native") {
          if (isNil(result)) {
            res.redirect(`${authConfig.nativeAppScheme}://auth/callback?pending=true`);
          } else {
            const nativeCode = storeNativeCode(result.token);
            res.redirect(`${authConfig.nativeAppScheme}://auth/callback?code=${nativeCode}&provider=apple`);
          }
        } else {
          if (isNil(result)) {
            res.redirect(`${authConfig.appDomain}/auth/callback?pending=true`);
          } else {
            res.cookie("kawaz-token", result.token, cookieOptions).redirect(`${authConfig.appDomain}/auth/callback`);
          }
        }
      },
    ),
    nativePoll: requestHandlerDecorator(
      "native poll",
      async (req: Request, res: Response) => {
        const { nonce } = validateNativePollRequest(req);
        const entry = pollNonce(nonce);
        if (isNil(entry)) {
          res.status(StatusCodes.NOT_FOUND).json({ message: "Nonce not found or expired" });
          return;
        }
        res.status(StatusCodes.OK).json(entry);
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
