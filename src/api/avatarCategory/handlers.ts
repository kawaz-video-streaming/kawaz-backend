import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Dals } from "../../dal/types";
import { requestHandlerDecorator } from "../../utils/decorator";
import { createAvatarCategoryLogic } from "./logic";
import { validateAvatarCategoryCreationRequest, validateAvatarCategoryIdRequest } from "./types";

export const createAvatarCategoryHandlers = (
    dals: Dals
) => {
    const avatarCategoryLogic = createAvatarCategoryLogic(dals);
    return {
        getAllCategories: requestHandlerDecorator(
            "get all avatar categories",
            async (_req: Request, res: Response) => {
                const categories = await avatarCategoryLogic.getAllCategories();
                res.status(StatusCodes.OK).json(categories);
            }
        ),
        getCategory: requestHandlerDecorator(
            "get avatar category by id",
            async (req: Request, res: Response) => {
                const { categoryId } = validateAvatarCategoryIdRequest(req);
                const category = await avatarCategoryLogic.getCategory(categoryId);
                res.status(StatusCodes.OK).json(category);
            }
        ),
        createCategory: requestHandlerDecorator(
            "create avatar category",
            async (req: Request, res: Response) => {
                const { name } = validateAvatarCategoryCreationRequest(req);
                await avatarCategoryLogic.createCategory(name);
                res.status(StatusCodes.CREATED).json({ message: "Avatar category created successfully" });
            }
        ),
        deleteCategory: requestHandlerDecorator(
            "delete avatar category",
            async (req: Request, res: Response) => {
                const { categoryId } = validateAvatarCategoryIdRequest(req);
                await avatarCategoryLogic.deleteCategory(categoryId);
                res.status(StatusCodes.OK).json({ message: "Avatar category deleted successfully" });
            }
        )
    }
}