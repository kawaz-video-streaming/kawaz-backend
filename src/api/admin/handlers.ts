import { Request, Response } from "@ido_kawaz/server-framework";
import { StatusCodes } from "http-status-codes";
import { UserDal } from "../../dal/user";
import { requestHandlerDecorator } from "../../utils/decorator";
import { validateAdminApprovalRequest, validateAdminRejectionRequest } from "./types";
import { createAdminLogic } from "./logic";
import { Mailer } from "../../services/mailer";

export const createAdminHandlers = (
    mailer: Mailer,
    userDal: UserDal
) => {
    const logic = createAdminLogic(mailer, userDal);
    return {
        getPendingUsers: requestHandlerDecorator(
            "get pending users",
            async (_req: Request, res: Response) => {
                const pendingUsers = await logic.getPendingUsers();
                res.status(StatusCodes.OK).json(pendingUsers);
            }
        ),
        approveUser: requestHandlerDecorator(
            "approve pending user",
            async (req: Request, res: Response) => {
                const { username, role } = validateAdminApprovalRequest(req);
                await logic.approveUser(username, role);
                res.status(StatusCodes.OK).json({
                    message: "User approved",
                });
            },
        ),
        denyUser: requestHandlerDecorator(
            "deny pending user",
            async (req: Request, res: Response) => {
                const { username } = validateAdminRejectionRequest(req);
                await logic.denyUser(username);
                res.status(StatusCodes.OK).json({
                    message: "User denied",
                });
            },
        ),
    };
};
