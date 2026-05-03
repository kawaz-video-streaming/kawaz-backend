import { BadRequestError, Request } from "@ido_kawaz/server-framework";
import { isNil } from "ramda";
import z from "zod";
import { Role } from "../../utils/types";
import { validateRequest, validateSchemaAndReturnValue } from "../../utils/zod";

export interface AuthConfig {
  jwtSecret: string;
  adminPromotionSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  appDomain: string;
}

export interface TokenPayload {
  username: string;
  role: Role;
}

const authSignupRequestSchema: z.ZodType<ValidatedAuthSignupRequest> = z.object({
  body: z.object({
    username: z.string().min(3, "Username is required"),
    password: z.string().min(12, "Password is required"),
    email: z.email("Valid email is required"),
  })
}).transform(({ body }) => body);

interface ValidatedAuthSignupRequest {
  username: string;
  password: string;
  email: string;
}

export const validateAuthSignupRequest = validateRequest(authSignupRequestSchema);

const loginRequestSchema: z.ZodType<ValidatedLoginRequest> = z.object({
  body: z.object({
    username: z.string().min(3, "Username is required"),
    password: z.string().min(12, "Password is required"),
  })
}).transform(({ body }) => body);

interface ValidatedLoginRequest {
  username: string;
  password: string;
}

export const validateLoginRequest = validateRequest(loginRequestSchema);

const promoteRequestSchema = z.object({
  username: z.string().min(3, "Username is required"),
});

export const validatePromoteRequest = (req: Request): { secret: string; username: string } => {
  const secret = req.headers["x-admin-secret"];
  if (typeof secret !== "string" || isNil(secret)) {
    throw new BadRequestError("Missing x-admin-secret header");
  }
  const validationResult = promoteRequestSchema.safeParse(req.body);
  if (!validationResult.success) {
    throw new BadRequestError(
      `Invalid request: \n${validationResult.error.issues.map((detail) => detail.message).join(",\n")}`,
    );
  }
  return { secret, username: validationResult.data.username };
};


const forgotPasswordRequestSchema: z.ZodType<ValidatedForgotPasswordRequest> = z.object({
  body: z.object({
    email: z.email("Valid email is required"),
  }),
}).transform(({ body }) => body);

interface ValidatedForgotPasswordRequest {
  email: string;
}

export const validateForgotPasswordRequest = validateRequest(forgotPasswordRequestSchema);

const resetPasswordRequestSchema: z.ZodType<ValidatedResetPasswordRequest> = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(12, "New password is required"),
  }),
}).transform(({ body }) => body);

interface ValidatedResetPasswordRequest {
  token: string;
  newPassword: string;
}

export const validateResetPasswordRequest = validateRequest(resetPasswordRequestSchema);

interface GoogleTokenRequestResult {
  access_token: string;
}

const googleTokenRequestSchema: z.ZodType<GoogleTokenRequestResult> = z.object({
  access_token: z.string(),
});

export const validateGoogleTokenRequestResult = validateSchemaAndReturnValue(googleTokenRequestSchema);