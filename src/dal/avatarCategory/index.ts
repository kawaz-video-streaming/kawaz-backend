import { Dal, Types } from "@ido_kawaz/mongo-client";
import { AvatarCategory, AvatarCategoryModel } from "./model";
import { isNotNil } from "ramda";

export class AvatarCategoryDal extends Dal<AvatarCategory> {
    constructor(model: AvatarCategoryModel) {
        super(model);
    }

    getAllCategories = async (): Promise<AvatarCategory[]> =>
        this.model.find().lean<AvatarCategory[]>().exec();

    getCategory = async (categoryId: string): Promise<AvatarCategory | null> =>
        this.model.findById(categoryId).lean<AvatarCategory>().exec();

    verifyCategoryExists = async (categoryId: string): Promise<boolean> =>
        isNotNil(await this.model.exists({ _id: categoryId }).lean().exec());

    createCategory = async (name: string): Promise<AvatarCategory> => {
        const category: AvatarCategory = {
            _id: new Types.ObjectId().toString(),
            name
        };
        await this.model.insertOne(category);
        return category;
    }

    deleteCategory = async (categoryId: string) =>
        this.model.deleteOne({ _id: categoryId }).exec();
}