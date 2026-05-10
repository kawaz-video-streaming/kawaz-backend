import { Router } from "@ido_kawaz/server-framework";
import { UserDal } from "../../dal/user";
import { createAdminHandlers } from "./handlers";
import { Mailer } from "../../services/mailer";

export const createAdminRouter = (
    mailer: Mailer,
    userDal: UserDal,
) => {
    const adminHandlers = createAdminHandlers(mailer, userDal);
    const router = Router();

    /**
     * @openapi
     * /admin/pending:
     *   get:
     *     summary: List pending users
     *     description: Returns all users whose registration is awaiting admin approval. Requires admin role.
     *     tags:
     *       - Admin
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: List of pending users
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   name:
     *                     type: string
     *                   email:
     *                     type: string
     *                   status:
     *                     type: string
     *                     enum: [pending]
     *                   role:
     *                     type: string
     *       401:
     *         description: Not authenticated or not authorized (admin only)
     */
    router.get("/pending", adminHandlers.getPendingUsers);

    /**
     * @openapi
     * /admin/pending/{username}/approve:
     *   post:
     *     summary: Approve a pending user
     *     description: Sets the user's status to approved, granting them access. Requires admin role.
     *     tags:
     *       - Admin
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: username
     *         required: true
     *         schema:
     *           type: string
     *         description: Username of the pending user to approve
     *     responses:
     *       200:
     *         description: User approved successfully
     *       401:
     *         description: Not authenticated or not authorized (admin only)
     *       404:
     *         description: User not found
     */
    router.post("/pending/:username/approve/:role", adminHandlers.approveUser);

    /**
     * @openapi
     * /admin/pending/{username}/deny:
     *   post:
     *     summary: Deny a pending user
     *     description: Sets the user's status to denied, rejecting their registration. Requires admin role.
     *     tags:
     *       - Admin
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: username
     *         required: true
     *         schema:
     *           type: string
     *         description: Username of the pending user to deny
     *     responses:
     *       200:
     *         description: User denied successfully
     *       401:
     *         description: Not authenticated or not authorized (admin only)
     *       404:
     *         description: User not found
     */
    router.post("/pending/:username/deny", adminHandlers.denyUser);

    return router;
};
