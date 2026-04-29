import { Types } from '@ido_kawaz/mongo-client';
import { validateAvatarCreationRequest } from '../types';

const makeValidCategoryId = () => new Types.ObjectId().toString();

const makeFileEntry = (overrides: Record<string, unknown> = {}) => ({
    path: '/tmp/avatar.jpg',
    originalname: 'avatar.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    ...overrides,
});

const makeReq = (overrides: Record<string, unknown> = {}) => ({
    body: { name: 'lion', categoryId: makeValidCategoryId() },
    file: makeFileEntry(),
    ...overrides,
});

describe('validateAvatarCreationRequest', () => {
    it('returns body and avatarImage for a valid request', () => {
        const categoryId = makeValidCategoryId();
        const result = validateAvatarCreationRequest(makeReq({ body: { name: 'lion', categoryId } }) as any);

        expect(result.body).toEqual({ name: 'lion', categoryId });
        expect(result.avatarImage).toMatchObject({
            path: '/tmp/avatar.jpg',
            fileName: 'avatar.jpg',
            mimetype: 'image/jpeg',
            size: 1024,
        });
    });

    it('throws when avatar image is missing', () => {
        const req = makeReq({ file: undefined });
        expect(() => validateAvatarCreationRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when image mimetype is not an image', () => {
        const req = makeReq({ file: makeFileEntry({ mimetype: 'video/mp4' }) });
        expect(() => validateAvatarCreationRequest(req as any)).toThrow('Only image files are allowed');
    });

    it('throws when name is missing from body', () => {
        const categoryId = makeValidCategoryId();
        const req = makeReq({ body: { categoryId } });
        expect(() => validateAvatarCreationRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when categoryId is not a valid ObjectId', () => {
        const req = makeReq({ body: { name: 'lion', categoryId: 'not-an-objectid' } });
        expect(() => validateAvatarCreationRequest(req as any)).toThrow('Invalid category ID');
    });

    it('throws when categoryId is missing', () => {
        const req = makeReq({ body: { name: 'lion' } });
        expect(() => validateAvatarCreationRequest(req as any)).toThrow('Invalid request');
    });

    it('accepts a valid ObjectId as categoryId', () => {
        const categoryId = makeValidCategoryId();
        const result = validateAvatarCreationRequest(makeReq({ body: { name: 'lion', categoryId } }) as any);
        expect(result.body.categoryId).toBe(categoryId);
    });
});
