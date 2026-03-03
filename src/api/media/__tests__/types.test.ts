import { validateMediaUploadRequest } from '../types';

describe('validateMediaUploadRequest', () => {
    it('returns file and body fields for a valid upload payload', () => {
        const req = {
            body: { includeSubtitles: 'true' },
            file: {
                path: '/tmp/video.mp4',
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 111,
            },
        };

        const result = validateMediaUploadRequest(req as any);

        expect(result).toMatchObject({
            body: { includeSubtitles: 'true' },
            file: {
                path: '/tmp/video.mp4',
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 111,
            },
        });
    });

    it('throws Invalid request when file is missing', () => {
        const req = {
            body: { includeSubtitles: false },
        };

        expect(() => validateMediaUploadRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when file size is not a number', () => {
        const req = {
            body: { includeSubtitles: true },
            file: {
                path: '/tmp/video.mp4',
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: '111',
            },
        };

        expect(() => validateMediaUploadRequest(req as any)).toThrow('Invalid request');
    });

    it('accepts payload when body is omitted and file exists', () => {
        const req = {
            file: {
                path: '/tmp/image.png',
                originalname: 'image.png',
                mimetype: 'image/png',
                size: 88,
            },
        };

        const result = validateMediaUploadRequest(req as any);

        expect(result.file.originalname).toBe('image.png');
        expect(result.file.size).toBe(88);
    });
});
