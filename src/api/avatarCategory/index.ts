import { Router } from "@ido_kawaz/server-framework";
import { Dals } from "../../dal/types";
import { createAvatarCategoryHandlers } from "./handlers";
import { requireAdmin } from "../middleware";

export const createAvatarCategoryRouter = (
    dals: Dals
) => {
    const handlers = createAvatarCategoryHandlers(dals);
    const router = Router();

    /**
     * @openapi
     * /avatar-category:
     *   get:
     *     summary: Get all avatar categories
     *     description: Returns all avatar categories from the database
     *     tags:
     *       - AvatarCategory
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: List of avatar categories
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/AvatarCategory'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: No avatar categories found
     */
    router.get("/", handlers.getAllCategories);

    /**
     * @openapi
     * /avatar-category/{categoryId}:
     *   get:
     *     summary: Get a specific avatar category
     *     description: Returns a single avatar category by ID
     *     tags:
     *       - AvatarCategory
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: categoryId
     *         required: true
     *         schema:
     *           type: string
     *         description: Avatar category ID
     *     responses:
     *       200:
     *         description: Avatar category metadata
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AvatarCategory'
     *       400:
     *         description: Bad request - invalid category ID
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Avatar category not found
     */
    router.get("/:categoryId", handlers.getCategory);

    /**
     * @openapi
     * /avatar-category:
     *   post:
     *     summary: Create a new avatar category
     *     description: Creates a new avatar category. Requires admin privileges.
     *     tags:
     *       - AvatarCategory
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *             properties:
     *               name:
     *                 type: string
     *     responses:
     *       201:
     *         description: Avatar category created successfully
     *       400:
     *         description: Bad request - invalid input data
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - admin only
     *       500:
     *         description: Internal server error
     */
    router.post("/", requireAdmin, handlers.createCategory);

    /**
     * @openapi
     * /avatar-category/{categoryId}:
     *   delete:
     *     summary: Delete an avatar category
     *     description: Deletes an avatar category from the database. Requires admin privileges.
     *     tags:
     *       - AvatarCategory
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: categoryId
     *         required: true
     *         schema:
     *           type: string
     *         description: Avatar category ID
     *     responses:
     *       200:
     *         description: Avatar category deleted successfully
     *       400:
     *         description: Bad request - invalid category ID
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - admin only
     *       404:
     *         description: Avatar category not found
     *       500:
     *         description: Internal server error
     */
    router.delete("/:categoryId", requireAdmin, handlers.deleteCategory);

    return router;
}