import { validateAvatarCreationRequest } from '../types';

const makeFileEntry = (overrides: Record<string, unknown> = {}) => ({
    path: '/tmp/avatar.jpg',
    originalname: 'avatar.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    ...overrides,
});

const makeReq = (overrides: Record<string, unknown> = {}) => ({
    body: { name: 'lion', category: 'Israel' },
    file: makeFileEntry(),
    ...overrides,
});

describe('validateAvatarCreationRequest', () => {
    it('returns body and avatarImage for a valid request', () => {
        const result = validateAvatarCreationRequest(makeReq() as any);

        expect(result.body).toEqual({ name: 'lion', category: 'Israel' });
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
        const req = makeReq({ body: { category: 'Israel' } });
        expect(() => validateAvatarCreationRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when category is not a valid AVATAR_CATEGORIES value', () => {
        const req = makeReq({ body: { name: 'lion', category: 'Antarctica' } });
        expect(() => validateAvatarCreationRequest(req as any)).toThrow('Invalid request');
    });

    it('accepts all valid avatar categories', () => {
        const categories = ['United Kingdom', 'United States', 'Israel', 'Japan', 'France'];
        for (const category of categories) {
            const result = validateAvatarCreationRequest(makeReq({ body: { name: 'test', category } }) as any);
            expect(result.body.category).toBe(category);
        }
    });
});
