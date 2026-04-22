import { NotFoundError } from "@ido_kawaz/server-framework";
import { UserDal } from "../../dal/user";
import { Mailer } from "../../services/mailer";

export const createAdminLogic = (
    mailer: Mailer,
    userDal: UserDal
) => ({
    getPendingUsers: userDal.getPendingUsers,
    approveUser: async (username: string) => {
        const user = await userDal.approveUser(username);
        if (user) {
            await mailer.sendApprovalEmail(user.name, user.email);
        } else {
            throw new NotFoundError(`User "${username}" not found`);
        }
    },
    denyUser: async (username: string) => {
        const user = await userDal.denyUser(username);
        if (user) {
            await mailer.sendDenialEmail(user.name, user.email);
            await userDal.removeUser(username);
        } else {
            throw new NotFoundError(`User "${username}" not found`);
        }
    }
});
