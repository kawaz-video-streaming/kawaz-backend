import { AvatarCategoryDal } from '../../../dal/avatarCategory';
import { AvatarDal } from '../../../dal/avatar';
import { AvatarCategory } from '../../../dal/avatarCategory/model';
import { Dals } from '../../../dal/types';
import { createAvatarCategoryLogic } from '../logic';

const makeCategoryDal = (): jest.Mocked<Pick<AvatarCategoryDal, 'getAllCategories' | 'getCategory' | 'createCategory' | 'deleteCategory'>> => ({
    getAllCategories: jest.fn().mockResolvedValue([]),
    getCategory: jest.fn().mockResolvedValue(null),
    createCategory: jest.fn().mockResolvedValue(undefined),
    deleteCategory: jest.fn().mockResolvedValue(undefined),
});

const makeAvatarDal = (): jest.Mocked<Pick<AvatarDal, 'isCategoryEmpty'>> => ({
    isCategoryEmpty: jest.fn().mockResolvedValue(true),
});

const makeDals = (
    avatarCategoryDal: ReturnType<typeof makeCategoryDal>,
    avatarDal: ReturnType<typeof makeAvatarDal>,
): Pick<Dals, 'avatarCategoryDal' | 'avatarDal'> => ({
    avatarCategoryDal: avatarCategoryDal as unknown as AvatarCategoryDal,
    avatarDal: avatarDal as unknown as AvatarDal,
});

const makeCategory = (overrides: Partial<AvatarCategory> = {}): AvatarCategory => ({
    _id: 'cat-1',
    name: 'Animals',
    ...overrides,
});

describe('createAvatarCategoryLogic.getAllCategories', () => {
    it('returns all categories from DAL', async () => {
        const categories = [makeCategory(), makeCategory({ _id: 'cat-2', name: 'Nature' })];
        const categoryDal = makeCategoryDal();
        categoryDal.getAllCategories.mockResolvedValue(categories);
        const avatarDal = makeAvatarDal();

        const logic = createAvatarCategoryLogic(makeDals(categoryDal, avatarDal) as unknown as Dals);
        const result = await logic.getAllCategories();

        expect(result).toEqual(categories);
    });
});

describe('createAvatarCategoryLogic.getCategory', () => {
    it('returns category by id', async () => {
        const category = makeCategory();
        const categoryDal = makeCategoryDal();
        categoryDal.getCategory.mockResolvedValue(category);
        const avatarDal = makeAvatarDal();

        const logic = createAvatarCategoryLogic(makeDals(categoryDal, avatarDal) as unknown as Dals);
        const result = await logic.getCategory('cat-1');

        expect(categoryDal.getCategory).toHaveBeenCalledWith('cat-1');
        expect(result).toEqual(category);
    });

    it('throws NotFoundError when category does not exist', async () => {
        const categoryDal = makeCategoryDal();
        categoryDal.getCategory.mockResolvedValue(null);
        const avatarDal = makeAvatarDal();

        const logic = createAvatarCategoryLogic(makeDals(categoryDal, avatarDal) as unknown as Dals);
        await expect(logic.getCategory('nonexistent')).rejects.toThrow('not found');
    });
});

describe('createAvatarCategoryLogic.createCategory', () => {
    it('creates a new category', async () => {
        const categoryDal = makeCategoryDal();
        const avatarDal = makeAvatarDal();

        const logic = createAvatarCategoryLogic(makeDals(categoryDal, avatarDal) as unknown as Dals);
        await logic.createCategory('Animals');

        expect(categoryDal.createCategory).toHaveBeenCalledWith('Animals');
    });

    it('throws ConflictError when category name already exists', async () => {
        const categoryDal = makeCategoryDal();
        categoryDal.createCategory.mockRejectedValue(new Error('duplicate key error'));
        const avatarDal = makeAvatarDal();

        const logic = createAvatarCategoryLogic(makeDals(categoryDal, avatarDal) as unknown as Dals);
        await expect(logic.createCategory('Animals')).rejects.toThrow('already exists');
    });

    it('rethrows unexpected errors', async () => {
        const categoryDal = makeCategoryDal();
        categoryDal.createCategory.mockRejectedValue(new Error('connection lost'));
        const avatarDal = makeAvatarDal();

        const logic = createAvatarCategoryLogic(makeDals(categoryDal, avatarDal) as unknown as Dals);
        await expect(logic.createCategory('Animals')).rejects.toThrow('connection lost');
    });
});

describe('createAvatarCategoryLogic.deleteCategory', () => {
    it('deletes category when it has no associated avatars', async () => {
        const categoryDal = makeCategoryDal();
        const avatarDal = makeAvatarDal();
        avatarDal.isCategoryEmpty.mockResolvedValue(true);

        const logic = createAvatarCategoryLogic(makeDals(categoryDal, avatarDal) as unknown as Dals);
        await logic.deleteCategory('cat-1');

        expect(categoryDal.deleteCategory).toHaveBeenCalledWith('cat-1');
    });

    it('throws BadRequestError when category has associated avatars', async () => {
        const categoryDal = makeCategoryDal();
        const avatarDal = makeAvatarDal();
        avatarDal.isCategoryEmpty.mockResolvedValue(false);

        const logic = createAvatarCategoryLogic(makeDals(categoryDal, avatarDal) as unknown as Dals);
        await expect(logic.deleteCategory('cat-1')).rejects.toThrow('has associated avatars');

        expect(categoryDal.deleteCategory).not.toHaveBeenCalled();
    });
});
