import { ApiError } from '@ido_kawaz/server-framework';
import express, { Application } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Dals } from '../../../dal/types';
import { UserDal } from '../../../dal/user';
import { Mailer } from '../../../services/mailer';
import { TmdbClient } from '../../../services/tmdbClient';
import { createAuthMiddleware } from '../../middleware';
import { createContentRequestRouter } from '../index';

const parseCookies = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.cookies = {};
    const header = req.headers.cookie ?? '';
    for (const pair of header.split(';')) {
        const idx = pair.indexOf('=');
        if (idx > 0) req.cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
    next();
};

const AUTH_CONFIG = { jwtSecret: 'content-request-test-secret', adminPromotionSecret: 'admin-promote-secret', googleClientId: 'test-google-client-id', googleClientSecret: 'test-google-client-secret', googleTvClientId: 'test-google-tv-client-id', googleTvClientSecret: 'test-google-tv-client-secret', appDomain: 'http://localhost:3000', nativeAppScheme: 'com.kawaz.plus', appleClientId: 'test-apple-client-id', isProduction: false };

type MockUserDal = {
    findUser: jest.Mock;
};

type MockContentRequestDal = {
    createRequest: jest.Mock;
    getRequestsForUser: jest.Mock;
    getAllRequests: jest.Mock;
    getRequestById: jest.Mock;
    updateRequestStatus: jest.Mock;
};

type MockMailer = {
    sendContentRequestStatusEmail: jest.Mock;
};

type MockTmdbClient = {
    getMovieDetails: jest.Mock;
    getShowDetails: jest.Mock;
    getSeasonDetails: jest.Mock;
};

const makeApp = (userDal: MockUserDal, contentRequestDal: MockContentRequestDal, mailer: MockMailer, tmdbClient: MockTmdbClient): Application => {
    const app = express();
    app.use(parseCookies);
    app.use(express.json());
    app.use(createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal));
    const dals = { userDal, contentRequestDal } as unknown as Dals;
    app.use('/contentRequest', createContentRequestRouter(dals, mailer as unknown as Mailer, tmdbClient as unknown as TmdbClient));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : 'Internal server error';
        res.status(500).json({ message });
    });
    return app;
};

const makeUserDal = (overrides: Partial<MockUserDal> = {}): MockUserDal => ({
    findUser: jest.fn().mockResolvedValue({ name: 'alice', email: 'alice@example.com', role: 'user' }),
    ...overrides,
});

const contentRequest = { _id: '507f1f77bcf86cd799439011', username: 'alice', tmdbId: 42, mediaType: 'movie', title: 'Dune', status: 'requested' };

const makeContentRequestDal = (overrides: Partial<MockContentRequestDal> = {}): MockContentRequestDal => ({
    createRequest: jest.fn().mockResolvedValue(contentRequest),
    getRequestsForUser: jest.fn().mockResolvedValue([contentRequest]),
    getAllRequests: jest.fn().mockResolvedValue([contentRequest]),
    getRequestById: jest.fn().mockResolvedValue(contentRequest),
    updateRequestStatus: jest.fn().mockResolvedValue({ ...contentRequest, status: 'acknowledged' }),
    ...overrides,
});

const makeMailer = (overrides: Partial<MockMailer> = {}): MockMailer => ({
    sendContentRequestStatusEmail: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

const makeTmdbClient = (overrides: Partial<MockTmdbClient> = {}): MockTmdbClient => ({
    getMovieDetails: jest.fn().mockResolvedValue({ id: 1, title: 'Dune' }),
    getShowDetails: jest.fn().mockResolvedValue({ id: 2, name: 'The Bear' }),
    getSeasonDetails: jest.fn().mockResolvedValue({ id: 100, name: 'Season 1', season_number: 1 }),
    ...overrides,
});

describe('GET /contentRequest/tmdb/movie', () => {
    it('returns the top matching tmdb movie for any authenticated user', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const tmdbClient = makeTmdbClient();
        const app = makeApp(makeUserDal(), makeContentRequestDal(), makeMailer(), tmdbClient);

        const response = await request(app)
            .get('/contentRequest/tmdb/movie?title=Dune&year=2021')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: 1, title: 'Dune' });
        expect(tmdbClient.getMovieDetails).toHaveBeenCalledWith('Dune', 2021);
    });

    it('returns 401 when not authenticated', async () => {
        const app = makeApp(makeUserDal(), makeContentRequestDal(), makeMailer(), makeTmdbClient());
        const response = await request(app).get('/contentRequest/tmdb/movie?title=Dune&year=2021');
        expect(response.status).toBe(401);
    });
});

describe('GET /contentRequest/tmdb/show', () => {
    it('returns the top matching tmdb show for any authenticated user', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const tmdbClient = makeTmdbClient();
        const app = makeApp(makeUserDal(), makeContentRequestDal(), makeMailer(), tmdbClient);

        const response = await request(app)
            .get('/contentRequest/tmdb/show?title=The+Bear&year=2022')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: 2, name: 'The Bear' });
        expect(tmdbClient.getShowDetails).toHaveBeenCalledWith('The Bear', 2022);
    });

    it('returns 401 when not authenticated', async () => {
        const app = makeApp(makeUserDal(), makeContentRequestDal(), makeMailer(), makeTmdbClient());
        const response = await request(app).get('/contentRequest/tmdb/show?title=The+Bear&year=2022');
        expect(response.status).toBe(401);
    });
});

describe('GET /contentRequest/tmdb/season', () => {
    it('returns the matching tmdb season for any authenticated user', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const tmdbClient = makeTmdbClient();
        const app = makeApp(makeUserDal(), makeContentRequestDal(), makeMailer(), tmdbClient);

        const response = await request(app)
            .get('/contentRequest/tmdb/season?showTitle=The+Bear&showYear=2022&seasonNumber=1')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: 100, name: 'Season 1', season_number: 1 });
        expect(tmdbClient.getSeasonDetails).toHaveBeenCalledWith('The Bear', 2022, 1);
    });

    it('returns 401 when not authenticated', async () => {
        const app = makeApp(makeUserDal(), makeContentRequestDal(), makeMailer(), makeTmdbClient());
        const response = await request(app).get('/contentRequest/tmdb/season?showTitle=The+Bear&showYear=2022&seasonNumber=1');
        expect(response.status).toBe(401);
    });
});

describe('POST /contentRequest', () => {
    it('returns 201 and creates a request for a regular user', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const contentRequestDal = makeContentRequestDal();
        const app = makeApp(makeUserDal(), contentRequestDal, makeMailer(), makeTmdbClient());

        const response = await request(app)
            .post('/contentRequest')
            .set('Cookie', `kawaz-token=${userToken}`)
            .send({ tmdbId: 42, mediaType: 'movie', title: 'Dune', year: 2021, posterPath: '/poster.jpg' });

        expect(response.status).toBe(201);
        expect(contentRequestDal.createRequest).toHaveBeenCalledWith('alice', 42, 'movie', 'Dune', 2021, '/poster.jpg', undefined);
    });

    it('creates a season request when mediaType is season and seasonNumber is provided', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const contentRequestDal = makeContentRequestDal();
        const app = makeApp(makeUserDal(), contentRequestDal, makeMailer(), makeTmdbClient());

        const response = await request(app)
            .post('/contentRequest')
            .set('Cookie', `kawaz-token=${userToken}`)
            .send({ tmdbId: 2, mediaType: 'season', title: 'The Bear', seasonNumber: 2 });

        expect(response.status).toBe(201);
        expect(contentRequestDal.createRequest).toHaveBeenCalledWith('alice', 2, 'season', 'The Bear', undefined, undefined, 2);
    });

    it('returns 400 when mediaType is season and seasonNumber is missing', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const contentRequestDal = makeContentRequestDal();
        const app = makeApp(makeUserDal(), contentRequestDal, makeMailer(), makeTmdbClient());

        const response = await request(app)
            .post('/contentRequest')
            .set('Cookie', `kawaz-token=${userToken}`)
            .send({ tmdbId: 2, mediaType: 'season', title: 'The Bear' });

        expect(response.status).toBe(400);
        expect(contentRequestDal.createRequest).not.toHaveBeenCalled();
    });

    it('returns 400 when seasonNumber is provided for a non-season mediaType', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const contentRequestDal = makeContentRequestDal();
        const app = makeApp(makeUserDal(), contentRequestDal, makeMailer(), makeTmdbClient());

        const response = await request(app)
            .post('/contentRequest')
            .set('Cookie', `kawaz-token=${userToken}`)
            .send({ tmdbId: 42, mediaType: 'movie', title: 'Dune', seasonNumber: 2 });

        expect(response.status).toBe(400);
        expect(contentRequestDal.createRequest).not.toHaveBeenCalled();
    });

    it('returns 401 when the requester is a special user', async () => {
        const specialToken = jwt.sign({ username: 'carol', role: 'special' }, AUTH_CONFIG.jwtSecret);
        const userDal = makeUserDal({ findUser: jest.fn().mockResolvedValue({ name: 'carol', email: 'carol@example.com', role: 'special' }) });
        const contentRequestDal = makeContentRequestDal();
        const app = makeApp(userDal, contentRequestDal, makeMailer(), makeTmdbClient());

        const response = await request(app)
            .post('/contentRequest')
            .set('Cookie', `kawaz-token=${specialToken}`)
            .send({ tmdbId: 42, mediaType: 'movie', title: 'Dune' });

        expect(response.status).toBe(401);
        expect(contentRequestDal.createRequest).not.toHaveBeenCalled();
    });

    it('returns 401 when the requester is an admin', async () => {
        const adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);
        const userDal = makeUserDal({ findUser: jest.fn().mockResolvedValue({ name: 'admin', email: 'admin@example.com', role: 'admin' }) });
        const contentRequestDal = makeContentRequestDal();
        const app = makeApp(userDal, contentRequestDal, makeMailer(), makeTmdbClient());

        const response = await request(app)
            .post('/contentRequest')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ tmdbId: 42, mediaType: 'movie', title: 'Dune' });

        expect(response.status).toBe(401);
        expect(contentRequestDal.createRequest).not.toHaveBeenCalled();
    });

    it('returns 400 on invalid body', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const app = makeApp(makeUserDal(), makeContentRequestDal(), makeMailer(), makeTmdbClient());

        const response = await request(app)
            .post('/contentRequest')
            .set('Cookie', `kawaz-token=${userToken}`)
            .send({ mediaType: 'movie' });

        expect(response.status).toBe(400);
    });
});

describe('GET /contentRequest/mine', () => {
    it('returns the authenticated user\'s own requests', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const contentRequestDal = makeContentRequestDal();
        const app = makeApp(makeUserDal(), contentRequestDal, makeMailer(), makeTmdbClient());

        const response = await request(app)
            .get('/contentRequest/mine')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([contentRequest]);
        expect(contentRequestDal.getRequestsForUser).toHaveBeenCalledWith('alice');
    });
});

describe('GET /contentRequest', () => {
    it('returns all requests for admin', async () => {
        const adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);
        const userDal = makeUserDal({ findUser: jest.fn().mockResolvedValue({ name: 'admin', email: 'admin@example.com', role: 'admin' }) });
        const app = makeApp(userDal, makeContentRequestDal(), makeMailer(), makeTmdbClient());

        const response = await request(app)
            .get('/contentRequest')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([contentRequest]);
    });

    it('returns 401 for a non-admin user', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const app = makeApp(makeUserDal(), makeContentRequestDal(), makeMailer(), makeTmdbClient());

        const response = await request(app)
            .get('/contentRequest')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(401);
    });
});

describe('PATCH /contentRequest/:id/status', () => {
    it('updates status and sends an email on terminal transitions', async () => {
        const adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);
        const userDal = makeUserDal({
            findUser: jest.fn()
                .mockResolvedValueOnce({ name: 'admin', email: 'admin@example.com', role: 'admin' })
                .mockResolvedValueOnce({ name: 'alice', email: 'alice@example.com', role: 'user' }),
        });
        const contentRequestDal = makeContentRequestDal({
            updateRequestStatus: jest.fn().mockResolvedValue({ ...contentRequest, status: 'uploaded' }),
        });
        const mailer = makeMailer();
        const app = makeApp(userDal, contentRequestDal, mailer, makeTmdbClient());

        const response = await request(app)
            .patch(`/contentRequest/${contentRequest._id}/status`)
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ status: 'uploaded' });

        expect(response.status).toBe(200);
        expect(contentRequestDal.updateRequestStatus).toHaveBeenCalledWith(contentRequest._id, 'uploaded', undefined);
        expect(mailer.sendContentRequestStatusEmail).toHaveBeenCalledWith('alice@example.com', 'Dune', 'uploaded', undefined);
    });

    it('returns 404 when the request does not exist', async () => {
        const adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);
        const userDal = makeUserDal({ findUser: jest.fn().mockResolvedValue({ name: 'admin', email: 'admin@example.com', role: 'admin' }) });
        const contentRequestDal = makeContentRequestDal({ getRequestById: jest.fn().mockResolvedValue(null) });
        const app = makeApp(userDal, contentRequestDal, makeMailer(), makeTmdbClient());

        const response = await request(app)
            .patch(`/contentRequest/${contentRequest._id}/status`)
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ status: 'acknowledged' });

        expect(response.status).toBe(404);
    });

    it('returns 401 for a non-admin user', async () => {
        const userToken = jwt.sign({ username: 'alice', role: 'user' }, AUTH_CONFIG.jwtSecret);
        const contentRequestDal = makeContentRequestDal();
        const app = makeApp(makeUserDal(), contentRequestDal, makeMailer(), makeTmdbClient());

        const response = await request(app)
            .patch(`/contentRequest/${contentRequest._id}/status`)
            .set('Cookie', `kawaz-token=${userToken}`)
            .send({ status: 'acknowledged' });

        expect(response.status).toBe(401);
        expect(contentRequestDal.updateRequestStatus).not.toHaveBeenCalled();
    });
});
