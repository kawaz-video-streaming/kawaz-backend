import { BadRequestError, Request } from "@ido_kawaz/server-framework";
import z from "zod";
import { Role } from "../../utils/types";
import { isNil } from "ramda";
import { validateRequest } from "../../utils/zod";

export interface AuthConfig {
  jwtSecret: string;
  adminPromotionSecret: string;
}

export interface TokenPayload {
  username: string;
  role: Role;
}

export const authSignupRequestSchema: z.ZodType<ValidatedAuthRequest> = z
  .object({
    body: z.object({
      username: z.string().min(3, "Username is required"),
      password: z.string().min(12, "Password is required"),
      email: z.email("Valid email is required"),
    }),
  })
  .transform(({ body }) => body);

interface ValidatedAuthRequest {
  username: string;
  password: string;
  email: string;
}

export const validateAuthRequest = validateRequest(authSignupRequestSchema);

const loginRequestSchema: z.ZodType<ValidatedLoginRequest> = z
  .object({
    body: z.object({
      username: z.string().min(3, "Username is required"),
      password: z.string().min(12, "Password is required"),
    }),
  })
  .transform(({ body }) => body);

interface ValidatedLoginRequest {
  username: string;
  password: string;
}

export const validateLoginRequest = validateRequest(loginRequestSchema);

const promoteRequestSchema = z.object({
  username: z.string().min(3, "Username is required"),
});

export const validatePromoteRequest = (
  req: Request,
): { secret: string; username: string } => {
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
