import { Types } from '@ido_kawaz/mongo-client';
import { validateProgressPayload } from '../types';

describe('validateProgressPayload', () => {
    it('returns true for a valid payload with completed status', () => {
        const payload = { mediaId: new Types.ObjectId().toHexString(), status: 'completed', percentage: 100 };

        expect(validateProgressPayload(payload)).toBe(true);
    });

    it('returns true for a valid payload with failed status', () => {
        const payload = { mediaId: new Types.ObjectId().toHexString(), status: 'failed', percentage: 50 };

        expect(validateProgressPayload(payload)).toBe(true);
    });

    it('returns false when mediaId is not a valid ObjectId', () => {
        const payload = { mediaId: 'invalid-id', status: 'completed', percentage: 100 };

        expect(validateProgressPayload(payload)).toBe(false);
    });

    it('returns false when status is invalid', () => {
        const payload = { mediaId: new Types.ObjectId().toHexString(), status: 'invalid-status', percentage: 50 };

        expect(validateProgressPayload(payload)).toBe(false);
    });

    it('returns false when mediaId is missing', () => {
        const payload = { status: 'completed', percentage: 100 };

        expect(validateProgressPayload(payload)).toBe(false);
    });

    it('returns false when status is missing', () => {
        const payload = { mediaId: new Types.ObjectId().toHexString(), percentage: 100 };

        expect(validateProgressPayload(payload)).toBe(false);
    });

    it('returns false when percentage is missing', () => {
        const payload = { mediaId: new Types.ObjectId().toHexString(), status: 'completed' };

        expect(validateProgressPayload(payload)).toBe(false);
    });

    it('returns false when percentage is out of range', () => {
        const payload = { mediaId: new Types.ObjectId().toHexString(), status: 'completed', percentage: 150 };

        expect(validateProgressPayload(payload)).toBe(false);
    });

    it('returns false when payload is not an object', () => {
        expect(validateProgressPayload(null)).toBe(false);
        expect(validateProgressPayload('string')).toBe(false);
    });
});
