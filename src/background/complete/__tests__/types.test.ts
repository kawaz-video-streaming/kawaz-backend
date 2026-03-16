import { Types } from '@ido_kawaz/mongo-client';
import { validateCompletePayload } from '../types';

describe('validateCompletePayload', () => {
    it('returns true for a valid payload', () => {
        const payload = { mediaId: new Types.ObjectId().toHexString() };

        expect(validateCompletePayload(payload)).toBe(true);
    });

    it('returns false when mediaId is not a valid ObjectId', () => {
        const payload = { mediaId: 'invalid-id' };

        expect(validateCompletePayload(payload)).toBe(false);
    });

    it('returns false when mediaId is missing', () => {
        const payload = {};

        expect(validateCompletePayload(payload)).toBe(false);
    });

    it('returns false when payload is not an object', () => {
        expect(validateCompletePayload(null)).toBe(false);
        expect(validateCompletePayload('string')).toBe(false);
    });
});
