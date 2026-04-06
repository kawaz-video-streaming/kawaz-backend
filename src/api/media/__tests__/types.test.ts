import { validateMediaUploadRequest } from '../types';

describe('validateMediaUploadRequest', () => {
    const makeFileEntry = (overrides: Record<string, unknown> = {}) => ({
        path: '/tmp/video.mp4',
        originalname: 'video.mp4',
        mimetype: 'video/mp4',
        size: 111,
        ...overrides,
    });

    const makeBody = (overrides: Record<string, unknown> = {}) => ({
        title: 'My Video',
        ...overrides,
    });

    const makeThumbnailEntry = (overrides: Record<string, unknown> = {}) => ({
        path: '/tmp/thumb.jpg',
        originalname: 'thumb.jpg',
        mimetype: 'image/jpeg',
        size: 8,
        ...overrides,
    });

    const makeReq = (overrides: Record<string, unknown> = {}) => ({
        files: { file: [makeFileEntry()], thumbnail: [makeThumbnailEntry()] },
        body: makeBody(),
        ...overrides,
    });

    it('returns file and body fields for a valid upload payload', () => {
        const result = validateMediaUploadRequest(makeReq() as any);

        expect(result).toMatchObject({
            file: { path: '/tmp/video.mp4', originalname: 'video.mp4', mimetype: 'video/mp4', size: 111 },
            body: { title: 'My Video', tags: [] },
        });
    });

    it('throws Invalid request when file is missing', () => {
        expect(() => validateMediaUploadRequest(makeReq({ files: {} }) as any)).toThrow('Invalid request');
    });

    it('throws when mimetype is not a video', () => {
        const req = makeReq({ files: { file: [makeFileEntry({ mimetype: 'application/pdf' })], thumbnail: [makeThumbnailEntry()] } });
        expect(() => validateMediaUploadRequest(req as any)).toThrow('Only video files are allowed');
    });

    it('throws when file size is not a number', () => {
        const req = makeReq({ files: { file: [makeFileEntry({ size: '111' })], thumbnail: [makeThumbnailEntry()] } });
        expect(() => validateMediaUploadRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when title is empty in body', () => {
        const req = makeReq({ body: { title: '' } });
        expect(() => validateMediaUploadRequest(req as any)).toThrow('Title is required');
    });

    it('returns thumbnail in result', () => {
        const result = validateMediaUploadRequest(makeReq() as any);
        expect(result.thumbnail).toMatchObject({ originalname: 'thumb.jpg', mimetype: 'image/jpeg' });
    });

    it('throws when thumbnail is missing', () => {
        const req = makeReq({ files: { file: [makeFileEntry()] } });
        expect(() => validateMediaUploadRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when thumbnail mimetype is not an image', () => {
        const req = makeReq({ files: { file: [makeFileEntry()], thumbnail: [makeThumbnailEntry({ mimetype: 'video/mp4' })] } });
        expect(() => validateMediaUploadRequest(req as any)).toThrow('Only image files are allowed');
    });
});
