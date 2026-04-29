import { MediaGenreDal } from '../../../dal/mediaGenre';
import { MediaDal } from '../../../dal/media';
import { MediaCollectionDal } from '../../../dal/mediaCollection';
import { MediaGenre } from '../../../dal/mediaGenre/model';
import { Dals } from '../../../dal/types';
import { createMediaGenreLogic } from '../logic';

const makeGenreDal = (): jest.Mocked<Pick<MediaGenreDal, 'getAllGenres' | 'getGenre' | 'createGenre' | 'deleteGenre'>> => ({
    getAllGenres: jest.fn().mockResolvedValue([]),
    getGenre: jest.fn().mockResolvedValue(null),
    createGenre: jest.fn().mockResolvedValue(undefined),
    deleteGenre: jest.fn().mockResolvedValue(undefined),
});

const makeMediaDal = (): jest.Mocked<Pick<MediaDal, 'isGenreEmpty'>> => ({
    isGenreEmpty: jest.fn().mockResolvedValue(true),
});

const makeMediaCollectionDal = (): jest.Mocked<Pick<MediaCollectionDal, 'isGenreUsedInCollection'>> => ({
    isGenreUsedInCollection: jest.fn().mockResolvedValue(false),
});

const makeDals = (
    mediaGenreDal: ReturnType<typeof makeGenreDal>,
    mediaDal: ReturnType<typeof makeMediaDal>,
    mediaCollectionDal: ReturnType<typeof makeMediaCollectionDal>,
): Pick<Dals, 'mediaGenreDal' | 'mediaDal' | 'mediaCollectionDal'> => ({
    mediaGenreDal: mediaGenreDal as unknown as MediaGenreDal,
    mediaDal: mediaDal as unknown as MediaDal,
    mediaCollectionDal: mediaCollectionDal as unknown as MediaCollectionDal,
});

const makeGenre = (overrides: Partial<MediaGenre> = {}): MediaGenre => ({
    _id: 'genre-1',
    name: 'Action',
    ...overrides,
});

describe('createMediaGenreLogic.getAllGenres', () => {
    it('returns all genres from DAL', async () => {
        const genres = [makeGenre(), makeGenre({ _id: 'genre-2', name: 'Comedy' })];
        const genreDal = makeGenreDal();
        genreDal.getAllGenres.mockResolvedValue(genres);

        const logic = createMediaGenreLogic(makeDals(genreDal, makeMediaDal(), makeMediaCollectionDal()) as unknown as Dals);
        const result = await logic.getAllGenres();

        expect(result).toEqual(genres);
    });
});

describe('createMediaGenreLogic.getGenre', () => {
    it('returns genre by id', async () => {
        const genre = makeGenre();
        const genreDal = makeGenreDal();
        genreDal.getGenre.mockResolvedValue(genre);

        const logic = createMediaGenreLogic(makeDals(genreDal, makeMediaDal(), makeMediaCollectionDal()) as unknown as Dals);
        const result = await logic.getGenre('genre-1');

        expect(genreDal.getGenre).toHaveBeenCalledWith('genre-1');
        expect(result).toEqual(genre);
    });

    it('throws NotFoundError when genre does not exist', async () => {
        const genreDal = makeGenreDal();
        genreDal.getGenre.mockResolvedValue(null);

        const logic = createMediaGenreLogic(makeDals(genreDal, makeMediaDal(), makeMediaCollectionDal()) as unknown as Dals);
        await expect(logic.getGenre('nonexistent')).rejects.toThrow('not found');
    });
});

describe('createMediaGenreLogic.createGenre', () => {
    it('creates a new genre', async () => {
        const genreDal = makeGenreDal();

        const logic = createMediaGenreLogic(makeDals(genreDal, makeMediaDal(), makeMediaCollectionDal()) as unknown as Dals);
        await logic.createGenre('Action');

        expect(genreDal.createGenre).toHaveBeenCalledWith('Action');
    });

    it('throws ConflictError when genre name already exists', async () => {
        const genreDal = makeGenreDal();
        genreDal.createGenre.mockRejectedValue(new Error('duplicate key error'));

        const logic = createMediaGenreLogic(makeDals(genreDal, makeMediaDal(), makeMediaCollectionDal()) as unknown as Dals);
        await expect(logic.createGenre('Action')).rejects.toThrow('already exists');
    });

    it('rethrows unexpected errors', async () => {
        const genreDal = makeGenreDal();
        genreDal.createGenre.mockRejectedValue(new Error('connection lost'));

        const logic = createMediaGenreLogic(makeDals(genreDal, makeMediaDal(), makeMediaCollectionDal()) as unknown as Dals);
        await expect(logic.createGenre('Action')).rejects.toThrow('connection lost');
    });
});

describe('createMediaGenreLogic.deleteGenre', () => {
    it('deletes genre when no media or collections reference it', async () => {
        const genreDal = makeGenreDal();
        const mediaDal = makeMediaDal();
        const collectionDal = makeMediaCollectionDal();
        mediaDal.isGenreEmpty.mockResolvedValue(true);
        collectionDal.isGenreUsedInCollection.mockResolvedValue(false);

        const logic = createMediaGenreLogic(makeDals(genreDal, mediaDal, collectionDal) as unknown as Dals);
        await logic.deleteGenre('Action');

        expect(genreDal.deleteGenre).toHaveBeenCalledWith('Action');
    });

    it('throws BadRequestError when genre has associated media', async () => {
        const genreDal = makeGenreDal();
        const mediaDal = makeMediaDal();
        const collectionDal = makeMediaCollectionDal();
        mediaDal.isGenreEmpty.mockResolvedValue(false);
        collectionDal.isGenreUsedInCollection.mockResolvedValue(false);

        const logic = createMediaGenreLogic(makeDals(genreDal, mediaDal, collectionDal) as unknown as Dals);
        await expect(logic.deleteGenre('Action')).rejects.toThrow('has associated media or collections');

        expect(genreDal.deleteGenre).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when genre is used in a collection', async () => {
        const genreDal = makeGenreDal();
        const mediaDal = makeMediaDal();
        const collectionDal = makeMediaCollectionDal();
        mediaDal.isGenreEmpty.mockResolvedValue(true);
        collectionDal.isGenreUsedInCollection.mockResolvedValue(true);

        const logic = createMediaGenreLogic(makeDals(genreDal, mediaDal, collectionDal) as unknown as Dals);
        await expect(logic.deleteGenre('Action')).rejects.toThrow('has associated media or collections');

        expect(genreDal.deleteGenre).not.toHaveBeenCalled();
    });
});
