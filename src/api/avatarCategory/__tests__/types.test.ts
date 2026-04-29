import { Types } from '@ido_kawaz/mongo-client';
import { validateAvatarCategoryCreationRequest, validateAvatarCategoryIdRequest } from '../types';

const makeValidObjectId = () => new Types.ObjectId().toString();

describe('validateAvatarCategoryIdRequest', () => {
    it('parses a valid category ID from params', () => {
        const id = makeValidObjectId();
        const req = { params: { categoryId: id } };
        const result = validateAvatarCategoryIdRequest(req as any);
        expect(result).toEqual({ categoryId: id });
    });

    it('throws when categoryId is not a valid ObjectId', () => {
        const req = { params: { categoryId: 'not-an-objectid' } };
        expect(() => validateAvatarCategoryIdRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when categoryId is missing', () => {
        const req = { params: {} };
        expect(() => validateAvatarCategoryIdRequest(req as any)).toThrow('Invalid request');
    });
});

describe('validateAvatarCategoryCreationRequest', () => {
    it('parses a valid creation request from body', () => {
        const req = { body: { name: 'Animals' } };
        const result = validateAvatarCategoryCreationRequest(req as any);
        expect(result).toEqual({ name: 'Animals' });
    });

    it('throws when name is missing', () => {
        const req = { body: {} };
        expect(() => validateAvatarCategoryCreationRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when name is an empty string', () => {
        const req = { body: { name: '' } };
        expect(() => validateAvatarCategoryCreationRequest(req as any)).toThrow('Invalid request');
    });
});
