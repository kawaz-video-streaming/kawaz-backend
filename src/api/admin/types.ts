import z from "zod";
import { validateRequest } from "../../utils/zod";

export const adminRequestZodSchema: z.ZodType<ValidatedAdminRequest> = z
  .object({
    params: z.object({
      username: z.string().min(3, "valid username is required"),
    }),
  })
  .transform(({ params }) => params);

interface ValidatedAdminRequest {
  username: string;
}

export const validateAdminRequest = validateRequest(adminRequestZodSchema);