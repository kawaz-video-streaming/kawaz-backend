import { Types } from '@ido_kawaz/mongo-client';
import { validateUploadPayload } from '../types';

describe('validateUploadPayload', () => {
    const makeValidPayload = (overrides: Record<string, unknown> = {}) => ({
        media: {
            _id: new Types.ObjectId().toHexString(),
            name: 'video.mp4',
            type: 'video/mp4',
            size: 1024,
            status: 'pending',
            ...((overrides.media as Record<string, unknown>) ?? {}),
        },
        path: '/tmp/video.mp4',
        ...(overrides.path !== undefined ? { path: overrides.path } : {}),
    });

    it('returns true for valid upload payload', () => {
        const payload = makeValidPayload();

        expect(validateUploadPayload(payload)).toBe(true);
    });

    it('returns true when includesSubtitles is provided', () => {
        const payload = makeValidPayload({ media: { includesSubtitles: true } });

        expect(validateUploadPayload(payload)).toBe(true);
    });

    it('returns true when size is provided as string (coerced to number)', () => {
        const payload = makeValidPayload({ media: { size: '2048' } });

        expect(validateUploadPayload(payload)).toBe(true);
    });

    it('returns false when media._id is not a valid ObjectId', () => {
        const payload = makeValidPayload({ media: { _id: 'invalid-id' } });

        expect(validateUploadPayload(payload)).toBe(false);
    });

    it('returns false when media.name is missing', () => {
        const payload = makeValidPayload();
        delete (payload.media as Record<string, unknown>).name;

        expect(validateUploadPayload(payload)).toBe(false);
    });

    it('returns false when media.type is missing', () => {
        const payload = makeValidPayload();
        delete (payload.media as Record<string, unknown>).type;

        expect(validateUploadPayload(payload)).toBe(false);
    });

    it('returns false when media.status is not a valid enum value', () => {
        const payload = makeValidPayload({ media: { status: 'invalid-status' } });

        expect(validateUploadPayload(payload)).toBe(false);
    });

    it('returns false when path is missing', () => {
        const payload = makeValidPayload();
        delete (payload as Record<string, unknown>).path;

        expect(validateUploadPayload(payload)).toBe(false);
    });

    it('returns false when media object is missing entirely', () => {
        const payload = { path: '/tmp/video.mp4' };

        expect(validateUploadPayload(payload)).toBe(false);
    });

    it('returns true for all valid media status values', () => {
        const statuses = ['pending', 'processing', 'completed', 'failed'] as const;

        for (const status of statuses) {
            const payload = makeValidPayload({ media: { status } });
            expect(validateUploadPayload(payload)).toBe(true);
        }
    });
});
