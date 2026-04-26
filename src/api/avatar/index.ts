import { Router } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import multer from "multer";
import { AvatarDal } from "../../dal/avatar";
import { BucketsConfig } from "../../utils/types";
import { requireAdmin } from "../middleware";
import { createAvatarHandlers } from './handlers';

export const createAvatarRouter = (bucketsConfig: BucketsConfig, avatarDal: AvatarDal, storageClient: StorageClient) => {
    const avatarHandlers = createAvatarHandlers(bucketsConfig, avatarDal, storageClient);
    const router = Router();
    const upload = multer({ storage: multer.diskStorage({ destination: './tmp' }) });

    /**
     * @openapi
     * /avatar:
     *   get:
     *     summary: Get all avatars
     *     description: Returns all avatars from the database
     *     tags:
     *       - Avatar
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: List of avatars
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Avatar'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: No Avatar found
     */
    router.get("/", avatarHandlers.getAllAvatars);

    /**
     * @openapi
     * /avatar:
     *   post:
     *     summary: Create a new avatar
     *     description: Creates a new avatar. Requires admin privileges. The request must include a name and category.
     *     tags:
     *       - Avatar
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               category:
     *                 type: string
     *     responses:
     *       200:
     *         description: Avatar created successfully
     *       400:
     *         description: Bad request - invalid input data
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - admin only
     *       500:
     *         description: Internal server error
     */
    router.post("/", requireAdmin, upload.single('avatar'), avatarHandlers.createAvatar);

    /**
     * @openapi
     * /avatar/{id}:
     *   delete:
     *     summary: Delete an avatar
     *     description: Deletes an avatar from the database and storage
     *     tags:
     *       - Avatar
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Avatar ID
     *     responses:
     *       200:
     *         description: Avatar deleted successfully
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - admin only
     *       404:
     *         description: Avatar not found
     *       500:
     *         description: Internal server error
     */
    router.delete("/:id", requireAdmin, avatarHandlers.deleteAvatar);

    /**
    * @openapi
    * /avatar/{id}:
    *   get:
    *     summary: Get a specific avatar metadata
    *     description: Returns metadata for a single avatar from the database
    *     tags:
    *       - Avatar
    *     security:
    *       - cookieAuth: []
    *     parameters:
    *       - in: path
    *         name: id
    *         required: true
    *         schema:
    *           type: string
    *         description: Avatar ID
    *     responses:
    *       200:
    *         description: Avatar metadata
    *         content:
    *           application/json:
    *             schema:
    *               $ref: '#/components/schemas/Avatar'
    *       401:
    *         description: Unauthorized
    *       404:
    *         description: Avatar not found
    */
    router.get("/:id", avatarHandlers.getAvatar);

    /**
     * @openapi
     * /avatar/{id}/image:
     *   get:
     *     summary: Get avatar image
     *     description: Streams the avatar image directly as JPEG
     *     tags:
     *       - Avatar
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Avatar ID
     *     responses:
     *       200:
     *         description: Avatar image binary data (image/jpeg)
     *         content:
     *           image/jpeg:
     *             schema:
     *               type: string
     *               format: binary
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Avatar not found
     *       500:
     *         description: Internal server error - image not found or storage service error
     */
    router.get("/:id/image", avatarHandlers.getImage);

    return router;
};
