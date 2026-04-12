// import { Router } from "@ido_kawaz/server-framework";
// import { StorageClient } from "@ido_kawaz/storage-client";
// import multer from "multer";
// import { AvatarDal } from "../../dal/avatar";
// import { requireAdmin } from "../middleware";
// import { createAvatarHandlers } from "./handlers";

// export const createAvatarRouter = (avatarDal: AvatarDal, storageClient: StorageClient) => {
//     const avatarHandlers = createAvatarHandlers(avatarDal, storageClient);
//     const router = Router();
//     const upload = multer({ storage: multer.diskStorage({ destination: './tmp' }) });

//     /**
//      * @openapi
//      * /avatar:
//      *   get:
//      *     summary: Get all avatars
//      *     description: Returns all avatars from the database
//      *     tags:
//      *       - Avatar
//      *     security:
//      *       - cookieAuth: []
//      *     responses:
//      *       200:
//      *         description: List of avatars
//      *         content:
//      *           application/json:
//      *             schema:
//      *               type: array
//      *               items:
//      *                 $ref: '#/components/schemas/MediaCollection'
//      *       401:
//      *         description: Unauthorized
//      *       404:
//      *         description: Avatar not found
//      */
//     router.get("/", avatarHandlers.getAllAvatars);

//     /**
//      * @openapi
//      * /avatar:
//      *   post:
//      *     summary: Create a new avatar
//      *     description: Creates a new avatar. Requires admin privileges. The request must include a name and category.
//      *     tags:
//      *       - Avatar
//      *     security:
//      *       - cookieAuth: []
//      *     requestBody:
//      *       required: true
//      *       content:
//      *         multipart/form-data:
//      *           schema:
//      *             type: object
//      *             properties:
//      *               title:
//      *                 type: string
//      *               tags:
//      *                 type: array
//      *                 items:
//      *                   type: string
//      *               thumbnail:
//      *                 type: string
//      *                 format: binary
//      *               thumbnailFocalPoint:
//      *                 type: object
//      *                 properties:
//      *                   x:
//      *                     type: number
//      *                   y:
//      *                     type: number
//      *               collectionId:
//      *                 type: string
//      *                 required: false
//      *                 description: Optional ID of a containing collection if this collection is nested within another collection
//      *     responses:
//      *       200:
//      *         description: Media upload started successfully
//      *       400:
//      *         description: Bad request - invalid input data
//      *       401:
//      *         description: Unauthorized
//      *       403:
//      *         description: Forbidden - admin only
//      *       500:
//      *         description: Internal server error
//      */
//     router.post("/", requireAdmin, upload.single('thumbnail'), mediaCollectionHandlers.createMediaCollection);

//     /**
//      * @openapi
//      * /mediaCollection/{id}:
//      *   put:
//      *     summary: Update media collection metadata
//      *     description: Update the title, thumbnail focal point, or tags of a media collection
//      *     tags:
//      *       - MediaCollection
//      *     security:
//      *       - cookieAuth: []
//      *     parameters:
//      *       - in: path
//      *         name: id
//      *         required: true
//      *         schema:
//      *           type: string
//      *         description: Media Collection ID
//      *     requestBody:
//      *       required: true
//      *       content:
//      *         application/json:
//      *           schema:
//      *             type: object
//      *             properties:
//      *               title:
//      *                 type: string
//      *               tags:
//      *                 type: array
//      *                 items:
//      *                   type: string
//      *               thumbnailFocalPoint:
//      *                 type: object
//      *                 properties:
//      *                   x:
//      *                     type: number
//      *                   y:
//      *                     type: number
//      *     responses:
//      *       200:
//      *         description: Media collection updated successfully
//      *       400:
//      *         description: Bad request - invalid media collection ID or invalid request body
//      *       401:
//      *         description: Unauthorized
//      *       403:
//      *         description: Forbidden - admin only
//      *       404:
//      *         description: Media collection not found
//      */
//     router.put("/:id", requireAdmin, upload.fields([{ name: 'thumbnail', maxCount: 1 }]), mediaCollectionHandlers.updateMediaCollection);

//     /**
//      * @openapi
//      * /mediaCollection/{id}:
//      *   delete:
//      *     summary: Delete a media collection
//      *     description: Deletes a media collection from the database and storage
//      *     tags:
//      *       - MediaCollection
//      *     security:
//      *       - cookieAuth: []
//      *     parameters:
//      *       - in: path
//      *         name: id
//      *         required: true
//      *         schema:
//      *           type: string
//      *         description: Media Collection ID
//      *     responses:
//      *       200:
//      *         description: Media collection deleted successfully
//      *       401:
//      *         description: Unauthorized
//      *       403:
//      *         description: Forbidden - admin only
//      *       404:
//      *         description: Media collection not found
//      *       500:
//      *         description: Internal server error
//      */
//     router.delete("/:id", requireAdmin, mediaCollectionHandlers.deleteMediaCollection);

//     /**
//     * @openapi
//     * /mediaCollection/{id}:
//     *   get:
//     *     summary: Get a specific media collection metadata
//     *     description: Returns metadata for a single ready media collection from the database
//     *     tags:
//     *       - MediaCollection
//     *     security:
//     *       - cookieAuth: []
//     *     parameters:
//     *       - in: path
//     *         name: id
//     *         required: true
//     *         schema:
//     *           type: string
//     *         description: Media ID
//     *     responses:
//     *       200:
//     *         description: Media collection metadata
//     *         content:
//     *           application/json:
//     *             schema:
//     *               $ref: '#/components/schemas/MediaCollection'
//     *       401:
//     *         description: Unauthorized
//     *       404:
//     *         description: Media collection not found
//     */
//     router.get("/:id", mediaCollectionHandlers.getMediaCollection);

//     /**
//      * @openapi
//      * /mediaCollection/{id}/thumbnail:
//      *   get:
//      *     summary: Get media collection thumbnail
//      *     description: Redirects to the thumbnail image URL for a media collection
//      *     tags:
//      *       - MediaCollection
//      *     security:
//      *       - cookieAuth: []
//      *     parameters:
//      *       - in: path
//      *         name: id
//      *         required: true
//      *         schema:
//      *           type: string
//      *         description: Media Collection ID
//      *     responses:
//      *       302:
//      *         description: Redirects to the thumbnail URL
//      *       401:
//      *         description: Unauthorized
//      *       404:
//      *         description: Media collection not found
//      *       500:
//      *         description: Internal server error - thumbnail not found or storage service error
//      */
//     router.get("/:id/thumbnail", mediaCollectionHandlers.getThumbnail);

//     return router;
// };
