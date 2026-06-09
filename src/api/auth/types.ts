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
  googleTvClientId: string;
  googleTvClientSecret: string;
  appleClientId: string;
  appDomain: string;
  nativeAppScheme: string;
  isProduction: boolean;
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

interface GoogleDeviceCodeApiResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

const googleDeviceCodeApiResponseSchema: z.ZodType<GoogleDeviceCodeApiResponse> = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_url: z.string(),
  expires_in: z.number(),
  interval: z.number(),
});

export const validateGoogleDeviceCodeApiResponse = validateSchemaAndReturnValue(googleDeviceCodeApiResponseSchema);

type GoogleDeviceTokenApiResponse =
  | { access_token: string }
  | { error: "authorization_pending" | "slow_down" | "access_denied" | "expired_token" };

const googleDeviceTokenApiResponseSchema: z.ZodType<GoogleDeviceTokenApiResponse> = z.union([
  z.object({ access_token: z.string() }),
  z.object({ error: z.enum(["authorization_pending", "slow_down", "access_denied", "expired_token"]) }),
]);

export const validateGoogleDeviceTokenApiResponse = validateSchemaAndReturnValue(googleDeviceTokenApiResponseSchema);

export type DeviceTokenResult =
  | { status: "authorized"; accessToken: string }
  | { status: "pending" }
  | { status: "slow_down" };

const googleDevicePollRequestSchema: z.ZodType<{ deviceCode: string }> = z.object({
  query: z.object({
    device_code: z.string().min(1, "device_code is required"),
  }),
}).transform(({ query }) => ({ deviceCode: query.device_code }));

export const validateGoogleDevicePollRequest = validateRequest(googleDevicePollRequestSchema);

const nativeExchangeRequestSchema: z.ZodType<{ code: string }> = z.object({
  body: z.object({
    code: z.string().min(1, "code is required"),
  }),
}).transform(({ body }) => body);

export const validateNativeExchangeRequest = validateRequest(nativeExchangeRequestSchema);

const appleJwkSchema = z.object({
  kty: z.string(),
  kid: z.string(),
  use: z.string(),
  alg: z.string(),
  n: z.string(),
  e: z.string(),
});

export type AppleJwk = z.infer<typeof appleJwkSchema>;

export const validateAppleJwksResponse = validateSchemaAndReturnValue(z.object({
  keys: z.array(appleJwkSchema),
}));

export const validateAppleTokenPayload = validateSchemaAndReturnValue(z.object({
  sub: z.string(),
  email: z.string(),
}));

export interface AppleUserName {
  givenName?: string;
  familyName?: string;
}

export const validateAppleUserJson = validateSchemaAndReturnValue(
  z.preprocess(
    (val) => {
      if (typeof val !== "string") {
        return val;
      }
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    },
    z.object({
      name: z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      }).optional(),
    }),
  ),
);
