import { Types } from '@ido_kawaz/mongo-client';
import { validateMediaGenreIdRequest, validateMediaGenreNamedRequest } from '../types';

const makeValidObjectId = () => new Types.ObjectId().toString();

describe('validateMediaGenreIdRequest', () => {
    it('parses a valid genre ID from params', () => {
        const id = makeValidObjectId();
        const req = { params: { genreId: id } };
        const result = validateMediaGenreIdRequest(req as any);
        expect(result).toEqual({ genreId: id });
    });

    it('throws when genreId is not a valid ObjectId', () => {
        const req = { params: { genreId: 'not-an-objectid' } };
        expect(() => validateMediaGenreIdRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when genreId is missing', () => {
        const req = { params: {} };
        expect(() => validateMediaGenreIdRequest(req as any)).toThrow('Invalid request');
    });
});

describe('validateMediaGenreNamedRequest', () => {
    it('parses a valid name from body', () => {
        const req = { body: { name: 'Action' } };
        const result = validateMediaGenreNamedRequest(req as any);
        expect(result).toEqual({ name: 'Action' });
    });

    it('throws when name is missing', () => {
        const req = { body: {} };
        expect(() => validateMediaGenreNamedRequest(req as any)).toThrow('Invalid request');
    });

    it('throws when name is an empty string', () => {
        const req = { body: { name: '' } };
        expect(() => validateMediaGenreNamedRequest(req as any)).toThrow('Invalid request');
    });
});
