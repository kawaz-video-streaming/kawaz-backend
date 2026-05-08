import z from "zod";
import { validateRequest } from "../../utils/zod";
import { Role } from "../../utils/types";

export const adminRejectionRequestZodSchema: z.ZodType<ValidatedAdminRejectionRequest> = z
  .object({
    params: z.object({
      username: z.string().min(3, "valid username is required"),
    }),
  })
  .transform(({ params }) => params);

interface ValidatedAdminRejectionRequest {
  username: string;
}

export const validateAdminRejectionRequest = validateRequest(adminRejectionRequestZodSchema);

export const adminApprovalRequestZodSchema: z.ZodType<ValidatedAdminApprovalRequest> = z
  .object({
    params: z.object({
      username: z.string().min(3, "valid username is required"),
      role: z.enum(["user", "special"], "valid role is required"),
    }),
  })
  .transform(({ params }) => params);

interface ValidatedAdminApprovalRequest {
  username: string;
  role: Omit<Role, "admin">;
}

export const validateAdminApprovalRequest = validateRequest(adminApprovalRequestZodSchema);
