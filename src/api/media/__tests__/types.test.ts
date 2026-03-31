import { validateMediaUploadRequest } from '../types';

describe('validateMediaUploadRequest', () => {
    it('returns file and body fields for a valid upload payload', () => {
        const req = {
            file: {
                path: '/tmp/video.mp4',
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 111,
            },
        };

        const result = validateMediaUploadRequest(req as any);

        expect(result).toMatchObject({
            file: {
                path: '/tmp/video.mp4',
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 111,
            },
        });
    });

    it('throws Invalid request when file is missing', () => {
        const req = {};

        expect(() => validateMediaUploadRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when mimetype is not a video', () => {
        const req = {
            file: {
                path: '/tmp/doc.pdf',
                originalname: 'doc.pdf',
                mimetype: 'application/pdf',
                size: 100,
            },
        };

        expect(() => validateMediaUploadRequest(req as any)).toThrow('Only video files are allowed');
    });

    it('throws when file size is not a number', () => {
        const req = {
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
                path: '/tmp/video.mp4',
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 88,
            },
        };

        const result = validateMediaUploadRequest(req as any);

        expect(result.file.originalname).toBe('video.mp4');
        expect(result.file.size).toBe(88);
    });
});
