import { ApiError } from '@ido_kawaz/server-framework';
import express, { Application, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { MediaDal } from '../../../dal/media';
import { UserDal } from '../../../dal/user';
import { createUserRouter } from '../index';

const injectUser = (username: string, role: string) =>
    (req: Request, _res: Response, next: NextFunction) => {
        (req as any).user = { username, role };
        next();
    };

const injectMediaDal = (mediaDal: Partial<MediaDal>) =>
    (req: Request, _res: Response, next: NextFunction) => {
        (req as any).mediaDal = mediaDal;
        next();
    };

const makeApp = (userDal: Partial<UserDal>, username = 'alice', role = 'user', mediaDal: Partial<MediaDal> = {}): Application => {
    const app = express();
    app.use(express.json());
    app.use(injectUser(username, role));
    app.use(injectMediaDal(mediaDal));
    app.use('/user', createUserRouter(userDal as unknown as UserDal));
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

describe('GET /user/me', () => {
    it('returns the authenticated user info', async () => {
        const app = makeApp({}, 'alice', 'admin');
        const response = await request(app).get('/user/me');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ username: 'alice', role: 'admin' });
    });
});

describe('POST /user/profile', () => {
    it('returns 201 when profile is created successfully', async () => {
        const userDal = { createProfile: jest.fn().mockResolvedValue(true) };
        const app = makeApp(userDal);

        const response = await request(app)
            .post('/user/profile')
            .send({ profileName: 'Kids', avatarId: '507f1f77bcf86cd799439011' });

        expect(response.status).toBe(201);
        expect(userDal.createProfile).toHaveBeenCalledWith('alice', { name: 'Kids', avatarId: '507f1f77bcf86cd799439011', watchProgress: [], watchlist: [] });
    });

    it('returns 409 when a profile with the same name already exists', async () => {
        const userDal = { createProfile: jest.fn().mockResolvedValue(false) };
        const app = makeApp(userDal);

        const response = await request(app)
            .post('/user/profile')
            .send({ profileName: 'Kids', avatarId: '507f1f77bcf86cd799439011' });

        expect(response.status).toBe(409);
    });

    it('returns 400 when avatarId is not a valid ObjectId', async () => {
        const userDal = { createProfile: jest.fn() };
        const app = makeApp(userDal);

        const response = await request(app)
            .post('/user/profile')
            .send({ profileName: 'Kids', avatarId: 'not-a-valid-id' });

        expect(response.status).toBe(400);
        expect(userDal.createProfile).not.toHaveBeenCalled();
    });

    it('returns 400 when body is missing', async () => {
        const userDal = { createProfile: jest.fn() };
        const app = makeApp(userDal);

        const response = await request(app).post('/user/profile');

        expect(response.status).toBe(400);
    });
});

describe('PUT /user/profile', () => {
    it('returns 200 when avatar is updated successfully', async () => {
        const userDal = { updateProfileAvatar: jest.fn().mockResolvedValue(true) };
        const app = makeApp(userDal);

        const response = await request(app)
            .put('/user/profile')
            .send({ profileName: 'Kids', avatarId: '507f1f77bcf86cd799439011' });

        expect(response.status).toBe(200);
        expect(userDal.updateProfileAvatar).toHaveBeenCalledWith('alice', 'Kids', '507f1f77bcf86cd799439011');
    });

    it('returns 404 when profile does not exist for the user', async () => {
        const userDal = { updateProfileAvatar: jest.fn().mockResolvedValue(false) };
        const app = makeApp(userDal);

        const response = await request(app)
            .put('/user/profile')
            .send({ profileName: 'NonExistent', avatarId: '507f1f77bcf86cd799439011' });

        expect(response.status).toBe(404);
    });

    it('returns 400 when avatarId is not a valid ObjectId', async () => {
        const userDal = { updateProfileAvatar: jest.fn() };
        const app = makeApp(userDal);

        const response = await request(app)
            .put('/user/profile')
            .send({ profileName: 'Kids', avatarId: 'bad-id' });

        expect(response.status).toBe(400);
        expect(userDal.updateProfileAvatar).not.toHaveBeenCalled();
    });
});

describe('DELETE /user/profile/:name', () => {
    it('returns 200 and deletes the profile', async () => {
        const userDal = { deleteProfile: jest.fn().mockResolvedValue(undefined) };
        const app = makeApp(userDal);

        const response = await request(app).delete('/user/profile/Kids');

        expect(response.status).toBe(200);
        expect(userDal.deleteProfile).toHaveBeenCalledWith('alice', 'Kids');
    });
});

describe('DELETE /user/account', () => {
    it('returns 200 and clears cookie when account is deleted', async () => {
        const userDal = { removeUser: jest.fn().mockResolvedValue(undefined) };
        const app = makeApp(userDal);

        const response = await request(app).delete('/user/account');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Account deleted successfully' });
        expect(userDal.removeUser).toHaveBeenCalledWith('alice');
    });

    it('propagates errors from removeUser', async () => {
        const userDal = { removeUser: jest.fn().mockRejectedValue(new Error('DB error')) };
        const app = makeApp(userDal);

        const response = await request(app).delete('/user/account');

        expect(response.status).toBe(500);
    });
});

describe('GET /user/profiles', () => {
    it('returns all profiles for the authenticated user', async () => {
        const profiles = [
            { name: 'Kids', avatarId: '507f1f77bcf86cd799439011' },
            { name: 'Dad', avatarId: '507f1f77bcf86cd799439012' },
        ];
        const userDal = { getUserProfiles: jest.fn().mockResolvedValue(profiles) };
        const app = makeApp(userDal);

        const response = await request(app).get('/user/profiles');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ profiles });
        expect(userDal.getUserProfiles).toHaveBeenCalledWith('alice');
    });

    it('returns empty profiles array when user has no profiles', async () => {
        const userDal = { getUserProfiles: jest.fn().mockResolvedValue([]) };
        const app = makeApp(userDal);

        const response = await request(app).get('/user/profiles');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ profiles: [] });
    });
});

describe('PUT /user/profile/:profileName/progress', () => {
    it('returns 200 when watch progress is upserted successfully', async () => {
        const userDal = { upsertWatchProgress: jest.fn().mockResolvedValue(true) };
        const app = makeApp(userDal);

        const response = await request(app)
            .put('/user/profile/Kids/progress')
            .send({ mediaId: '507f1f77bcf86cd799439011', positionInMs: 5000 });

        expect(response.status).toBe(200);
        expect(userDal.upsertWatchProgress).toHaveBeenCalledWith('alice', 'Kids', '507f1f77bcf86cd799439011', 5000);
    });

    it('returns 404 when profile does not exist', async () => {
        const userDal = { upsertWatchProgress: jest.fn().mockResolvedValue(false) };
        const app = makeApp(userDal);

        const response = await request(app)
            .put('/user/profile/NonExistent/progress')
            .send({ mediaId: '507f1f77bcf86cd799439011', positionInMs: 5000 });

        expect(response.status).toBe(404);
    });

    it('returns 400 when body is missing required fields', async () => {
        const userDal = { upsertWatchProgress: jest.fn() };
        const app = makeApp(userDal);

        const response = await request(app)
            .put('/user/profile/Kids/progress')
            .send({ mediaId: '507f1f77bcf86cd799439011' });

        expect(response.status).toBe(400);
        expect(userDal.upsertWatchProgress).not.toHaveBeenCalled();
    });
});

describe('DELETE /user/profile/:profileName/progress/:mediaId', () => {
    it('returns 200 when watch progress is removed', async () => {
        const userDal = { removeWatchProgress: jest.fn().mockResolvedValue(undefined) };
        const app = makeApp(userDal);

        const response = await request(app).delete('/user/profile/Kids/progress/507f1f77bcf86cd799439011');

        expect(response.status).toBe(200);
        expect(userDal.removeWatchProgress).toHaveBeenCalledWith('alice', 'Kids', '507f1f77bcf86cd799439011');
    });
});

describe('GET /user/profile/:profileName/continue-watching', () => {
    it('returns empty array when profile does not exist', async () => {
        const userDal = { getProfile: jest.fn().mockResolvedValue(null) };
        const app = makeApp(userDal);

        const response = await request(app).get('/user/profile/Kids/continue-watching');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('returns resolved media items with positionInMs', async () => {
        const profile = {
            name: 'Kids',
            avatarId: '507f1f77bcf86cd799439011',
            watchProgress: [
                { mediaId: 'm1', positionInMs: 3000, updatedAt: new Date('2026-01-02') },
            ],
            watchlist: [],
        };
        const media = { _id: 'm1', title: 'Movie', durationInMs: 10000, metadata: { durationInMs: 10000 } };
        const userDal = { getProfile: jest.fn().mockResolvedValue(profile) };
        const mediaDal = { getMedia: jest.fn().mockResolvedValue(media) };
        const app = makeApp(userDal, 'alice', 'user', mediaDal);

        const response = await request(app).get('/user/profile/Kids/continue-watching');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({ _id: 'm1', positionInMs: 3000 });
    });

    it('excludes finished items (positionInMs >= 90% of duration)', async () => {
        const profile = {
            name: 'Kids',
            avatarId: '507f1f77bcf86cd799439011',
            watchProgress: [
                { mediaId: 'm1', positionInMs: 9500, updatedAt: new Date('2026-01-02') },
            ],
            watchlist: [],
        };
        const media = { _id: 'm1', title: 'Movie', metadata: { durationInMs: 10000 } };
        const userDal = { getProfile: jest.fn().mockResolvedValue(profile) };
        const mediaDal = { getMedia: jest.fn().mockResolvedValue(media) };
        const app = makeApp(userDal, 'alice', 'user', mediaDal);

        const response = await request(app).get('/user/profile/Kids/continue-watching');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(0);
    });
});

describe('POST /user/profile/:profileName/watchlist/:mediaId', () => {
    it('returns 200 when media is added to watchlist', async () => {
        const userDal = { addToWatchlist: jest.fn().mockResolvedValue(undefined) };
        const app = makeApp(userDal);

        const response = await request(app).post('/user/profile/Kids/watchlist/507f1f77bcf86cd799439011');

        expect(response.status).toBe(200);
        expect(userDal.addToWatchlist).toHaveBeenCalledWith('alice', 'Kids', '507f1f77bcf86cd799439011');
    });
});

describe('DELETE /user/profile/:profileName/watchlist/:mediaId', () => {
    it('returns 200 when media is removed from watchlist', async () => {
        const userDal = { removeFromWatchlist: jest.fn().mockResolvedValue(undefined) };
        const app = makeApp(userDal);

        const response = await request(app).delete('/user/profile/Kids/watchlist/507f1f77bcf86cd799439011');

        expect(response.status).toBe(200);
        expect(userDal.removeFromWatchlist).toHaveBeenCalledWith('alice', 'Kids', '507f1f77bcf86cd799439011');
    });
});

describe('GET /user/profile/:profileName/watchlist', () => {
    it('returns empty array when profile does not exist', async () => {
        const userDal = { getProfile: jest.fn().mockResolvedValue(null) };
        const app = makeApp(userDal);

        const response = await request(app).get('/user/profile/Kids/watchlist');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('returns resolved media items for watchlist', async () => {
        const profile = {
            name: 'Kids',
            avatarId: '507f1f77bcf86cd799439011',
            watchProgress: [],
            watchlist: ['m1', 'm2'],
        };
        const m1 = { _id: 'm1', title: 'Movie One' };
        const m2 = { _id: 'm2', title: 'Movie Two' };
        const userDal = { getProfile: jest.fn().mockResolvedValue(profile) };
        const mediaDal = { getMedia: jest.fn().mockImplementation((id: string) => Promise.resolve(id === 'm1' ? m1 : m2)) };
        const app = makeApp(userDal, 'alice', 'user', mediaDal);

        const response = await request(app).get('/user/profile/Kids/watchlist');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body[0]).toMatchObject({ _id: 'm1' });
        expect(response.body[1]).toMatchObject({ _id: 'm2' });
    });

    it('filters out null media from watchlist', async () => {
        const profile = {
            name: 'Kids',
            avatarId: '507f1f77bcf86cd799439011',
            watchProgress: [],
            watchlist: ['m1', 'deleted'],
        };
        const m1 = { _id: 'm1', title: 'Movie One' };
        const userDal = { getProfile: jest.fn().mockResolvedValue(profile) };
        const mediaDal = { getMedia: jest.fn().mockImplementation((id: string) => Promise.resolve(id === 'm1' ? m1 : null)) };
        const app = makeApp(userDal, 'alice', 'user', mediaDal);

        const response = await request(app).get('/user/profile/Kids/watchlist');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({ _id: 'm1' });
    });
});
