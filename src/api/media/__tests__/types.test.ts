import { validateInitiateUploadRequest, validateCompleteUploadRequest, validateGetMovieTmdbDetailsRequest } from '../types';

describe('validateInitiateUploadRequest', () => {
    const makeReq = (overrides: Record<string, unknown> = {}) => ({
        body: {
            title: 'My Video',
            fileName: 'video.mp4',
            fileSize: 1024,
            kind: 'movie',
            mimeType: 'video/mp4',
            genres: [],
            thumbnailFocalPoint: { x: 0.5, y: 0.5 },
            ...overrides,
        },
    });

    it('returns parsed body for a valid payload', () => {
        const result = validateInitiateUploadRequest(makeReq() as any);
        expect(result).toMatchObject({
            title: 'My Video',
            fileName: 'video.mp4',
            fileSize: 1024,
            mimeType: 'video/mp4',
        });
    });

    it('throws when title is empty', () => {
        expect(() => validateInitiateUploadRequest(makeReq({ title: '' }) as any)).toThrow('Title is required');
    });

    it('throws when fileName is missing', () => {
        expect(() => validateInitiateUploadRequest(makeReq({ fileName: '' }) as any)).toThrow();
    });

    it('throws when mimeType is not a video', () => {
        expect(() => validateInitiateUploadRequest(makeReq({ mimeType: 'image/jpeg' }) as any)).toThrow('Only video files are allowed');
    });

    it('throws when fileSize is not positive', () => {
        expect(() => validateInitiateUploadRequest(makeReq({ fileSize: 0 }) as any)).toThrow();
    });

    it('defaults genres to empty array when omitted', () => {
        const req = { body: { title: 'T', fileName: 'v.mp4', kind: 'movie', fileSize: 1, mimeType: 'video/mp4' } };
        const result = validateInitiateUploadRequest(req as any);
        expect(result.genres).toEqual([]);
    });
});

describe('validateCompleteUploadRequest', () => {
    it('accepts a valid mediaId', () => {
        const result = validateCompleteUploadRequest({ body: { mediaId: 'abc123' } } as any);
        expect(result.body.mediaId).toBe('abc123');
    });

    it('throws when mediaId is missing', () => {
        expect(() => validateCompleteUploadRequest({ body: {} } as any)).toThrow();
    });

    it('throws when mediaId is empty string', () => {
        expect(() => validateCompleteUploadRequest({ body: { mediaId: '' } } as any)).toThrow();
    });
});

describe('validateGetMovieTmdbDetailsRequest', () => {
    it('returns parsed query for valid params', () => {
        const result = validateGetMovieTmdbDetailsRequest({ query: { title: 'Breaking Bad', year: '2008' } } as any);
        expect(result).toEqual({ title: 'Breaking Bad', year: 2008 });
    });

    it('coerces year string to number', () => {
        const result = validateGetMovieTmdbDetailsRequest({ query: { title: 'Inception', year: '2010' } } as any);
        expect(result.year).toBe(2010);
    });

    it('throws when title is missing', () => {
        expect(() => validateGetMovieTmdbDetailsRequest({ query: { year: '2010' } } as any)).toThrow();
    });

    it('throws when title is empty', () => {
        expect(() => validateGetMovieTmdbDetailsRequest({ query: { title: '', year: '2010' } } as any)).toThrow();
    });

    it('throws when year is missing', () => {
        expect(() => validateGetMovieTmdbDetailsRequest({ query: { title: 'Inception' } } as any)).toThrow();
    });

    it('throws when year is not a positive integer', () => {
        expect(() => validateGetMovieTmdbDetailsRequest({ query: { title: 'Inception', year: '-1' } } as any)).toThrow();
    });
});
