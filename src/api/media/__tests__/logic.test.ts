import { AmqpClient } from '@ido_kawaz/amqp-client';
import { BadRequestError, NotFoundError } from '@ido_kawaz/server-framework';
import { StorageClient } from '@ido_kawaz/storage-client';
import { MediaDal } from '../../../dal/media';
import { MediaCollectionDal } from '../../../dal/mediaCollection';
import { MediaGenreDal } from '../../../dal/mediaGenre';
import { Dals } from '../../../dal/types';
import { TmdbClient } from '../../../services/tmdbClient';
import { createMediaLogic } from '../logic';
import { InitiateUploadRequestBody } from '../types';

const makeConfig = () => ({
    kawazPlus: {
        kawazStorageBucket: 'upload-bucket',
        uploadPrefix: 'raw',
        thumbnailPrefix: 'raw/thumbnails',
        avatarPrefix: 'avatars',
    },
    vod: { vodStorageBucket: 'vod-bucket' },
});

const makeBody = (overrides: Partial<InitiateUploadRequestBody> = {}): InitiateUploadRequestBody => ({
    title: 'My Video',
    kind: 'movie',
    genres: [],
    thumbnailFocalPoint: { x: 0.5, y: 0.5 },
    fileName: 'video.mp4',
    fileSize: 64,
    mimeType: 'video/mp4',
    ...overrides,
});

const makeMediaGenreDal = (): jest.Mocked<Pick<MediaGenreDal, 'verifyGenreExists'>> => ({
    verifyGenreExists: jest.fn().mockResolvedValue(true),
});

const makeMediaCollectionDal = (): jest.Mocked<Pick<MediaCollectionDal, 'getCollection'>> => ({
    getCollection: jest.fn().mockResolvedValue(null),
});

const makeTmdbClient = (): jest.Mocked<Pick<TmdbClient, 'getMovieDetails'>> => ({
    getMovieDetails: jest.fn(),
});

describe('createMediaLogic.initiateUpload', () => {
    it('creates media record and returns presigned URLs', async () => {
        const media = { _id: 'm1', fileName: 'video.mp4', title: 'My Video', genres: [], size: 64, status: 'pending' };
        const mediaDal = { createMedia: jest.fn().mockResolvedValue(media) } as unknown as MediaDal;
        const storageClient = {
            ensureBucket: jest.fn().mockResolvedValue(undefined),
            getPutPresignedUrl: jest.fn()
                .mockResolvedValueOnce('https://minio/raw/video.mp4?sig=abc')
                .mockResolvedValueOnce('https://minio/raw/thumbnails/m1.jpg?sig=xyz'),
        } as unknown as StorageClient;

        const logic = createMediaLogic(makeConfig(), {
            mediaDal,
            mediaCollectionDal: makeMediaCollectionDal() as unknown as MediaCollectionDal,
            mediaGenreDal: makeMediaGenreDal() as unknown as MediaGenreDal,
        } as unknown as Dals, {} as any, storageClient, makeTmdbClient() as unknown as TmdbClient);
        const result = await logic.initiateUpload(makeBody());

        expect(mediaDal.createMedia).toHaveBeenCalledWith({
            title: 'My Video',
            kind: 'movie',
            genres: [],
            thumbnailFocalPoint: { x: 0.5, y: 0.5 },
            fileName: 'video.mp4',
            size: 64,
        });
        expect(storageClient.ensureBucket).toHaveBeenCalledWith('upload-bucket');
        expect(storageClient.getPutPresignedUrl).toHaveBeenCalledWith('upload-bucket', 'raw/video.mp4', 3600);
        expect(storageClient.getPutPresignedUrl).toHaveBeenCalledWith('upload-bucket', 'raw/thumbnails/m1.jpg', 3600);
        expect(result).toEqual({
            mediaId: 'm1',
            videoUploadUrl: 'https://minio/raw/video.mp4?sig=abc',
            thumbnailUploadUrl: 'https://minio/raw/thumbnails/m1.jpg?sig=xyz',
        });
    });

    it('throws BadRequestError when a referenced genre does not exist', async () => {
        const mediaDal = { createMedia: jest.fn() } as unknown as MediaDal;
        const mediaGenreDal = makeMediaGenreDal();
        mediaGenreDal.verifyGenreExists.mockResolvedValue(false);
        const storageClient = {
            ensureBucket: jest.fn().mockResolvedValue(undefined),
            getPutPresignedUrl: jest.fn(),
        } as unknown as StorageClient;

        const logic = createMediaLogic(makeConfig(), {
            mediaDal,
            mediaCollectionDal: makeMediaCollectionDal() as unknown as MediaCollectionDal,
            mediaGenreDal: mediaGenreDal as unknown as MediaGenreDal,
        } as unknown as Dals, {} as any, storageClient, makeTmdbClient() as unknown as TmdbClient);

        await expect(logic.initiateUpload(makeBody({ genres: ['NonExistent'] }))).rejects.toBeInstanceOf(BadRequestError);
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
    });

    it('propagates DAL failure and never generates URLs', async () => {
        const mediaDal = { createMedia: jest.fn().mockRejectedValue(new Error('db write failed')) } as unknown as MediaDal;
        const storageClient = {
            ensureBucket: jest.fn().mockResolvedValue(undefined),
            getPutPresignedUrl: jest.fn(),
        } as unknown as StorageClient;

        const logic = createMediaLogic(makeConfig(), {
            mediaDal,
            mediaCollectionDal: makeMediaCollectionDal() as unknown as MediaCollectionDal,
            mediaGenreDal: makeMediaGenreDal() as unknown as MediaGenreDal,
        } as unknown as Dals, {} as any, storageClient, makeTmdbClient() as unknown as TmdbClient);

        await expect(logic.initiateUpload(makeBody())).rejects.toThrow('db write failed');
        expect(storageClient.getPutPresignedUrl).not.toHaveBeenCalled();
    });
});

describe('createMediaLogic.completeUpload', () => {
    it('publishes convert message and sets status to processing', async () => {
        const media = { _id: 'm1', fileName: 'video.mp4', title: 'My Video', genres: [], size: 64, status: 'pending' };
        const mediaDal = {
            getPendingMedia: jest.fn().mockResolvedValue(media),
            updateMedia: jest.fn().mockResolvedValue(undefined),
        } as unknown as MediaDal;
        const amqpClient = { publish: jest.fn() } as unknown as AmqpClient;

        const logic = createMediaLogic(makeConfig(), {
            mediaDal,
            mediaCollectionDal: makeMediaCollectionDal() as unknown as MediaCollectionDal,
            mediaGenreDal: makeMediaGenreDal() as unknown as MediaGenreDal,
        } as unknown as Dals, amqpClient, {} as any, makeTmdbClient() as unknown as TmdbClient);
        await logic.completeUpload('m1');

        expect(mediaDal.getPendingMedia).toHaveBeenCalledWith('m1');
        expect(amqpClient.publish).toHaveBeenCalledWith('convert', 'convert.media', {
            mediaId: 'm1',
            mediaFileName: 'video.mp4',
            mediaStorageBucket: 'upload-bucket',
            mediaRoutingKey: 'raw/video.mp4',
        });
        expect(mediaDal.updateMedia).toHaveBeenCalledWith('m1', { status: 'processing', percentage: 20 });
    });

    it('throws NotFoundError when media is not pending', async () => {
        const mediaDal = { getPendingMedia: jest.fn().mockResolvedValue(null) } as unknown as MediaDal;
        const amqpClient = { publish: jest.fn() } as unknown as AmqpClient;

        const logic = createMediaLogic(makeConfig(), {
            mediaDal,
            mediaCollectionDal: makeMediaCollectionDal() as unknown as MediaCollectionDal,
            mediaGenreDal: makeMediaGenreDal() as unknown as MediaGenreDal,
        } as unknown as Dals, amqpClient, {} as any, makeTmdbClient() as unknown as TmdbClient);

        await expect(logic.completeUpload('m-missing')).rejects.toThrow(NotFoundError);
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });

    it('never updates status when publish throws', async () => {
        const media = { _id: 'm1', fileName: 'video.mp4', title: 'My Video', genres: [], size: 64, status: 'pending' };
        const mediaDal = {
            getPendingMedia: jest.fn().mockResolvedValue(media),
            updateMedia: jest.fn(),
        } as unknown as MediaDal;
        const amqpClient = { publish: jest.fn().mockImplementation(() => { throw new Error('amqp down'); }) } as unknown as AmqpClient;

        const logic = createMediaLogic(makeConfig(), {
            mediaDal,
            mediaCollectionDal: makeMediaCollectionDal() as unknown as MediaCollectionDal,
            mediaGenreDal: makeMediaGenreDal() as unknown as MediaGenreDal,
        } as unknown as Dals, amqpClient, {} as any, makeTmdbClient() as unknown as TmdbClient);

        await expect(logic.completeUpload('m1')).rejects.toThrow('amqp down');
        expect(mediaDal.updateMedia).not.toHaveBeenCalled();
    });
});

describe('createMediaLogic.getMovieMediaTmdbDetails', () => {
    const movieDetails = {
        id: 27205,
        title: 'Inception',
        overview: 'A thief who steals corporate secrets.',
        release_date: '2010-07-16',
        poster_url: 'https://image.tmdb.org/t/p/original/poster.jpg',
        backdrop_url: null,
        genres: [{ id: 28, name: 'Action' }],
        vote_average: 8.4,
        vote_count: 35000,
        runtime: 148,
        tagline: 'Your mind is the scene of the crime.',
        imdb_id: 'tt1375666',
        belongs_to_collection: null,
    };

    it('returns movie details from tmdbClient', async () => {
        const tmdbClient = makeTmdbClient();
        tmdbClient.getMovieDetails.mockResolvedValue(movieDetails as any);

        const logic = createMediaLogic(makeConfig(), {
            mediaDal: {} as unknown as MediaDal,
            mediaCollectionDal: makeMediaCollectionDal() as unknown as MediaCollectionDal,
            mediaGenreDal: makeMediaGenreDal() as unknown as MediaGenreDal,
        } as unknown as Dals, {} as any, {} as any, tmdbClient as unknown as TmdbClient);

        const result = await logic.getMovieMediaTmdbDetails('Inception', 2010);

        expect(tmdbClient.getMovieDetails).toHaveBeenCalledWith('Inception', 2010);
        expect(result).toEqual(movieDetails);
    });

    it('propagates NotFoundError from tmdbClient', async () => {
        const tmdbClient = makeTmdbClient();
        tmdbClient.getMovieDetails.mockRejectedValue(new NotFoundError('No movie found on TMDB'));

        const logic = createMediaLogic(makeConfig(), {
            mediaDal: {} as unknown as MediaDal,
            mediaCollectionDal: makeMediaCollectionDal() as unknown as MediaCollectionDal,
            mediaGenreDal: makeMediaGenreDal() as unknown as MediaGenreDal,
        } as unknown as Dals, {} as any, {} as any, tmdbClient as unknown as TmdbClient);

        await expect(logic.getMovieMediaTmdbDetails('Unknown', 1900)).rejects.toThrow(NotFoundError);
    });
});
