import { BadRequestError, ConflictError, NotFoundError } from "@ido_kawaz/server-framework";
import { Dals } from "../../dal/types";
import { isNil } from "ramda";

export const createAvatarCategoryLogic = (
    { avatarCategoryDal, avatarDal, specialAvatarDal }: Dals,
) => ({
    getAllCategories: () => avatarCategoryDal.getAllCategories(),
    getCategory: async (categoryId: string) => {
        const category = await avatarCategoryDal.getCategory(categoryId);
        if (isNil(category)) {
            throw new NotFoundError(`Avatar category with id ${categoryId} not found`);
        }
        return category;
    },
    createCategory: async (name: string) => {
        try {
            await avatarCategoryDal.createCategory(name);
        } catch (e) {
            if (e instanceof Error && e.message.includes("duplicate key error")) {
                throw new ConflictError(`Avatar category with name ${name} already exists`);
            }
            throw e;
        }
    },
    deleteCategory: async (categoryId: string) => {
        const isEmpty = await avatarDal.isCategoryEmpty(categoryId) && await specialAvatarDal.isCategoryEmpty(categoryId);
        if (!isEmpty) {
            throw new BadRequestError(`Cannot delete category with id ${categoryId} because it has associated avatars`);
        }
        await avatarCategoryDal.deleteCategory(categoryId);
    }
});