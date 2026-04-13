import { Types } from '@ido_kawaz/mongo-client';
import { validateUploadPayload } from '../types';

describe('validateUploadPayload', () => {
    const makeValidPayload = (mediaOverrides: Record<string, unknown> = {}, payloadOverrides: Record<string, unknown> = {}) => ({
        media: {
            _id: new Types.ObjectId().toHexString(),
            fileName: 'video.mp4',
            title: 'My Video',
            tags: [],
            size: 1024,
            status: 'pending',
            thumbnailFocalPoint: { x: 0.5, y: 0.5 },
            ...mediaOverrides,
        },
        mediaPath: '/tmp/video.mp4',
        thumbnailPath: '/tmp/thumb.jpg',
        ...payloadOverrides,
    });

    it('returns true for valid upload payload', () => {
        expect(validateUploadPayload(makeValidPayload())).toBe(true);
    });

    it('returns true when size is provided as string (coerced to number)', () => {
        expect(validateUploadPayload(makeValidPayload({ size: '2048' }))).toBe(true);
    });

    it('returns false when media._id is not a valid ObjectId', () => {
        expect(validateUploadPayload(makeValidPayload({ _id: 'invalid-id' }))).toBe(false);
    });

    it('returns false when media.fileName is missing', () => {
        const payload = makeValidPayload();
        delete (payload.media as Record<string, unknown>).fileName;
        expect(validateUploadPayload(payload)).toBe(false);
    });

    it('returns false when media.title is missing', () => {
        const payload = makeValidPayload();
        delete (payload.media as Record<string, unknown>).title;
        expect(validateUploadPayload(payload)).toBe(false);
    });

    it('returns false when media.status is not a valid enum value', () => {
        expect(validateUploadPayload(makeValidPayload({ status: 'invalid-status' }))).toBe(false);
    });

    it('returns false when mediaPath is missing', () => {
        const payload = makeValidPayload();
        delete (payload as Record<string, unknown>).mediaPath;
        expect(validateUploadPayload(payload)).toBe(false);
    });

    it('returns false when media object is missing entirely', () => {
        expect(validateUploadPayload({ mediaPath: '/tmp/video.mp4' })).toBe(false);
    });

    it('returns true for all valid media status values', () => {
        for (const status of ['pending', 'processing', 'completed', 'failed'] as const) {
            expect(validateUploadPayload(makeValidPayload({ status }))).toBe(true);
        }
    });

    it('returns false when thumbnailPath is missing', () => {
        const payload = makeValidPayload();
        delete (payload as Record<string, unknown>).thumbnailPath;
        expect(validateUploadPayload(payload)).toBe(false);
    });
});
