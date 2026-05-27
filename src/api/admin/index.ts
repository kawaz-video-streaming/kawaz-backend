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

    /**
     * @openapi
     * /admin/newsletter:
     *   post:
     *     summary: Send a newsletter to all approved users
     *     description: Sends an HTML email to every approved user. Personalized with each recipient's username. Requires admin role.
     *     tags:
     *       - Admin
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [subject, body]
     *             properties:
     *               subject:
     *                 type: string
     *                 example: "Kawaz+ is now available on Android TV"
     *               body:
     *                 type: string
     *                 example: "Hi everyone,\n\nWe're excited to announce..."
     *     responses:
     *       200:
     *         description: Newsletter sent successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: Newsletter sent to 12 users
     *       400:
     *         description: Missing or invalid subject/body
     *       401:
     *         description: Not authenticated or not authorized (admin only)
     *       500:
     *         description: Internal server error
     */
    router.post("/newsletter", adminHandlers.sendNewsletter);

    return router;
};
