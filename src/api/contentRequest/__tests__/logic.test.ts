import { NotFoundError, UnauthorizedError } from '@ido_kawaz/server-framework';
import { ContentRequestDal } from '../../../dal/contentRequest';
import { UserDal } from '../../../dal/user';
import { Mailer } from '../../../services/mailer';
import { TmdbClient } from '../../../services/tmdbClient';
import { createContentRequestLogic } from '../logic';

const makeContentRequestDal = (overrides: Partial<Record<keyof ContentRequestDal, jest.Mock>> = {}) =>
    ({
        createRequest: jest.fn(),
        getRequestsForUser: jest.fn(),
        getAllRequests: jest.fn(),
        getRequestById: jest.fn(),
        updateRequestStatus: jest.fn(),
        deleteRequest: jest.fn(),
        ...overrides,
    }) as unknown as ContentRequestDal;

const makeUserDal = (overrides: Partial<Record<keyof UserDal, jest.Mock>> = {}) =>
    ({
        findUser: jest.fn(),
        ...overrides,
    }) as unknown as UserDal;

const makeMailer = (overrides: Partial<Record<keyof Mailer, jest.Mock>> = {}) =>
    ({
        sendContentRequestStatusEmail: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    }) as unknown as Mailer;

const makeTmdbClient = (overrides: Partial<Record<keyof TmdbClient, jest.Mock>> = {}) =>
    ({
        getMovieDetails: jest.fn(),
        getShowDetails: jest.fn(),
        getSeasonDetails: jest.fn(),
        ...overrides,
    }) as unknown as TmdbClient;

describe('createContentRequestLogic.createRequest', () => {
    it('delegates to contentRequestDal.createRequest', async () => {
        const created = { _id: '1', username: 'alice', tmdbId: 42, mediaType: 'movie', title: 'Dune', status: 'requested' };
        const contentRequestDal = makeContentRequestDal({ createRequest: jest.fn().mockResolvedValue(created) });
        const logic = createContentRequestLogic({ contentRequestDal, userDal: makeUserDal() } as any, makeMailer(), makeTmdbClient());

        const result = await logic.createRequest('alice', 42, 'movie', 'Dune', 2021, '/poster.jpg');

        expect(result).toBe(created);
        expect(contentRequestDal.createRequest).toHaveBeenCalledWith('alice', 42, 'movie', 'Dune', 2021, '/poster.jpg', undefined);
    });

    it('passes seasonNumber through for season requests', async () => {
        const created = { _id: '1', username: 'alice', tmdbId: 2, mediaType: 'season', title: 'The Bear', seasonNumber: 3, status: 'requested' };
        const contentRequestDal = makeContentRequestDal({ createRequest: jest.fn().mockResolvedValue(created) });
        const logic = createContentRequestLogic({ contentRequestDal, userDal: makeUserDal() } as any, makeMailer(), makeTmdbClient());

        const result = await logic.createRequest('alice', 2, 'season', 'The Bear', undefined, undefined, 3);

        expect(result).toBe(created);
        expect(contentRequestDal.createRequest).toHaveBeenCalledWith('alice', 2, 'season', 'The Bear', undefined, undefined, 3);
    });
});

describe('createContentRequestLogic.updateStatus', () => {
    it('throws NotFoundError when the request does not exist', async () => {
        const contentRequestDal = makeContentRequestDal({ getRequestById: jest.fn().mockResolvedValue(null) });
        const logic = createContentRequestLogic({ contentRequestDal, userDal: makeUserDal() } as any, makeMailer(), makeTmdbClient());

        await expect(logic.updateStatus('missing-id', 'acknowledged')).rejects.toThrow(NotFoundError);
    });

    it('updates status without sending an email for non-terminal transitions', async () => {
        const existingRequest = { _id: '1', username: 'alice', tmdbId: 42, mediaType: 'movie', title: 'Dune', status: 'requested' };
        const updatedRequest = { ...existingRequest, status: 'acknowledged' };
        const contentRequestDal = makeContentRequestDal({
            getRequestById: jest.fn().mockResolvedValue(existingRequest),
            updateRequestStatus: jest.fn().mockResolvedValue(updatedRequest),
        });
        const userDal = makeUserDal();
        const mailer = makeMailer();
        const logic = createContentRequestLogic({ contentRequestDal, userDal } as any, mailer, makeTmdbClient());

        const result = await logic.updateStatus('1', 'acknowledged');

        expect(result).toBe(updatedRequest);
        expect(contentRequestDal.updateRequestStatus).toHaveBeenCalledWith('1', 'acknowledged', undefined);
        expect(userDal.findUser).not.toHaveBeenCalled();
        expect(mailer.sendContentRequestStatusEmail).not.toHaveBeenCalled();
    });

    it('sends a status email to the requester on terminal transitions', async () => {
        const existingRequest = { _id: '1', username: 'alice', tmdbId: 42, mediaType: 'movie', title: 'Dune', status: 'acknowledged' };
        const updatedRequest = { ...existingRequest, status: 'uploaded' };
        const contentRequestDal = makeContentRequestDal({
            getRequestById: jest.fn().mockResolvedValue(existingRequest),
            updateRequestStatus: jest.fn().mockResolvedValue(updatedRequest),
        });
        const userDal = makeUserDal({ findUser: jest.fn().mockResolvedValue({ name: 'alice', email: 'alice@example.com' }) });
        const mailer = makeMailer();
        const logic = createContentRequestLogic({ contentRequestDal, userDal } as any, mailer, makeTmdbClient());

        const result = await logic.updateStatus('1', 'uploaded');

        expect(result).toBe(updatedRequest);
        expect(userDal.findUser).toHaveBeenCalledWith('alice');
        expect(mailer.sendContentRequestStatusEmail).toHaveBeenCalledWith('alice@example.com', 'Dune', 'uploaded', undefined);
    });

    it('includes the season number in the emailed title for season requests', async () => {
        const existingRequest = { _id: '1', username: 'alice', tmdbId: 2, mediaType: 'season', title: 'The Bear', seasonNumber: 3, status: 'acknowledged' };
        const updatedRequest = { ...existingRequest, status: 'uploaded' };
        const contentRequestDal = makeContentRequestDal({
            getRequestById: jest.fn().mockResolvedValue(existingRequest),
            updateRequestStatus: jest.fn().mockResolvedValue(updatedRequest),
        });
        const userDal = makeUserDal({ findUser: jest.fn().mockResolvedValue({ name: 'alice', email: 'alice@example.com' }) });
        const mailer = makeMailer();
        const logic = createContentRequestLogic({ contentRequestDal, userDal } as any, mailer, makeTmdbClient());

        await logic.updateStatus('1', 'uploaded');

        expect(mailer.sendContentRequestStatusEmail).toHaveBeenCalledWith('alice@example.com', 'The Bear - Season 3', 'uploaded', undefined);
    });

    it('passes the admin note through on rejection', async () => {
        const existingRequest = { _id: '1', username: 'alice', tmdbId: 42, mediaType: 'movie', title: 'Dune', status: 'requested' };
        const contentRequestDal = makeContentRequestDal({
            getRequestById: jest.fn().mockResolvedValue(existingRequest),
            updateRequestStatus: jest.fn().mockResolvedValue({ ...existingRequest, status: 'rejected', adminNote: 'duplicate' }),
        });
        const userDal = makeUserDal({ findUser: jest.fn().mockResolvedValue({ name: 'alice', email: 'alice@example.com' }) });
        const mailer = makeMailer();
        const logic = createContentRequestLogic({ contentRequestDal, userDal } as any, mailer, makeTmdbClient());

        await logic.updateStatus('1', 'rejected', 'duplicate');

        expect(contentRequestDal.updateRequestStatus).toHaveBeenCalledWith('1', 'rejected', 'duplicate');
        expect(mailer.sendContentRequestStatusEmail).toHaveBeenCalledWith('alice@example.com', 'Dune', 'rejected', 'duplicate');
    });
});

describe('createContentRequestLogic.deleteRequest', () => {
    it('throws NotFoundError when the request does not exist', async () => {
        const contentRequestDal = makeContentRequestDal({ getRequestById: jest.fn().mockResolvedValue(null) });
        const logic = createContentRequestLogic({ contentRequestDal, userDal: makeUserDal() } as any, makeMailer(), makeTmdbClient());

        await expect(logic.deleteRequest('alice', 'user', 'missing-id')).rejects.toThrow(NotFoundError);
    });

    it('allows a regular user to delete their own pending request', async () => {
        const existingRequest = { _id: '1', username: 'alice', tmdbId: 42, mediaType: 'movie', title: 'Dune', status: 'requested' };
        const contentRequestDal = makeContentRequestDal({ getRequestById: jest.fn().mockResolvedValue(existingRequest) });
        const logic = createContentRequestLogic({ contentRequestDal, userDal: makeUserDal() } as any, makeMailer(), makeTmdbClient());

        await logic.deleteRequest('alice', 'user', '1');

        expect(contentRequestDal.deleteRequest).toHaveBeenCalledWith('1');
    });

    it('rejects a regular user deleting someone else\'s request', async () => {
        const existingRequest = { _id: '1', username: 'bob', tmdbId: 42, mediaType: 'movie', title: 'Dune', status: 'requested' };
        const contentRequestDal = makeContentRequestDal({ getRequestById: jest.fn().mockResolvedValue(existingRequest) });
        const logic = createContentRequestLogic({ contentRequestDal, userDal: makeUserDal() } as any, makeMailer(), makeTmdbClient());

        await expect(logic.deleteRequest('alice', 'user', '1')).rejects.toThrow(UnauthorizedError);
        expect(contentRequestDal.deleteRequest).not.toHaveBeenCalled();
    });

    it('rejects a regular user deleting their own non-pending request', async () => {
        const existingRequest = { _id: '1', username: 'alice', tmdbId: 42, mediaType: 'movie', title: 'Dune', status: 'acknowledged' };
        const contentRequestDal = makeContentRequestDal({ getRequestById: jest.fn().mockResolvedValue(existingRequest) });
        const logic = createContentRequestLogic({ contentRequestDal, userDal: makeUserDal() } as any, makeMailer(), makeTmdbClient());

        await expect(logic.deleteRequest('alice', 'user', '1')).rejects.toThrow(UnauthorizedError);
        expect(contentRequestDal.deleteRequest).not.toHaveBeenCalled();
    });

    it('allows an admin to delete any request regardless of owner or status', async () => {
        const existingRequest = { _id: '1', username: 'bob', tmdbId: 42, mediaType: 'movie', title: 'Dune', status: 'uploaded' };
        const contentRequestDal = makeContentRequestDal({ getRequestById: jest.fn().mockResolvedValue(existingRequest) });
        const logic = createContentRequestLogic({ contentRequestDal, userDal: makeUserDal() } as any, makeMailer(), makeTmdbClient());

        await logic.deleteRequest('admin', 'admin', '1');

        expect(contentRequestDal.deleteRequest).toHaveBeenCalledWith('1');
    });
});

describe('createContentRequestLogic tmdb lookups', () => {
    it('delegates getMovieTmdbDetails/getShowTmdbDetails to the tmdb client', async () => {
        const tmdbClient = makeTmdbClient({
            getMovieDetails: jest.fn().mockResolvedValue({ id: 1, title: 'Dune' }),
            getShowDetails: jest.fn().mockResolvedValue({ id: 2, name: 'The Bear' }),
        });
        const logic = createContentRequestLogic({ contentRequestDal: makeContentRequestDal(), userDal: makeUserDal() } as any, makeMailer(), tmdbClient);

        expect(await logic.getMovieTmdbDetails('Dune', 2021)).toEqual({ id: 1, title: 'Dune' });
        expect(await logic.getShowTmdbDetails('The Bear', 2022)).toEqual({ id: 2, name: 'The Bear' });
        expect(tmdbClient.getMovieDetails).toHaveBeenCalledWith('Dune', 2021);
        expect(tmdbClient.getShowDetails).toHaveBeenCalledWith('The Bear', 2022);
    });

    it('delegates getSeasonTmdbDetails to the tmdb client', async () => {
        const tmdbClient = makeTmdbClient({
            getSeasonDetails: jest.fn().mockResolvedValue({ id: 100, name: 'Season 1', season_number: 1 }),
        });
        const logic = createContentRequestLogic({ contentRequestDal: makeContentRequestDal(), userDal: makeUserDal() } as any, makeMailer(), tmdbClient);

        expect(await logic.getSeasonTmdbDetails('The Bear', 2022, 1)).toEqual({ id: 100, name: 'Season 1', season_number: 1 });
        expect(tmdbClient.getSeasonDetails).toHaveBeenCalledWith('The Bear', 2022, 1);
    });
});
