import { ApiError } from '@ido_kawaz/server-framework';
import express, { Application, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { UserDal } from '../../../dal/user';
import { createUserRouter } from '../index';

const injectUser = (username: string, role: string) =>
    (req: Request, _res: Response, next: NextFunction) => {
        (req as any).user = { username, role };
        next();
    };

const makeApp = (userDal: Partial<UserDal>, username = 'alice', role = 'user'): Application => {
    const app = express();
    app.use(express.json());
    app.use(injectUser(username, role));
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
        expect(userDal.createProfile).toHaveBeenCalledWith('alice', { name: 'Kids', avatarId: '507f1f77bcf86cd799439011' });
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
