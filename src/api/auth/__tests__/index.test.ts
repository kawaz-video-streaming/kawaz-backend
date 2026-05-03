import { ApiError } from '@ido_kawaz/server-framework';
import bcrypt from 'bcrypt';
import express, { Application } from 'express';
import * as jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';
import { UserDal } from '../../../dal/user';
import { Mailer } from '../../../services/mailer';
import { createAuthRouter } from '../index';

jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../utils');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedSign = jsonwebtoken.sign as jest.Mock;

import { fetchGoogleAccessToken, fetchGoogleUserInfo } from '../utils';
const mockedFetchGoogleAccessToken = fetchGoogleAccessToken as jest.Mock;
const mockedFetchGoogleUserInfo = fetchGoogleUserInfo as jest.Mock;

const AUTH_CONFIG = {
    jwtSecret: 'test-secret',
    adminPromotionSecret: 'test-admin-secret',
    googleClientId: 'test-google-client-id',
    googleClientSecret: 'test-google-client-secret',
    appDomain: 'http://localhost:3000',
};

const makeMailer = (): jest.Mocked<Mailer> =>
    ({
        sendApprovalRequestEmail: jest.fn().mockResolvedValue(undefined),
        sendApprovalEmail: jest.fn().mockResolvedValue(undefined),
        sendDenialEmail: jest.fn().mockResolvedValue(undefined),
        sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    }) as unknown as jest.Mocked<Mailer>;

const makeErrorHandler = () =>
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : 'Internal server error';
        res.status(500).json({ message });
    };

describe('POST /auth/signup', () => {
    let app: Application;
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock; promoteToAdmin: jest.Mock };

    beforeEach(() => {
        userDal = {
            verifyUser: jest.fn().mockResolvedValue(false),
            createUser: jest.fn().mockResolvedValue(undefined),
            findUser: jest.fn(),
            promoteToAdmin: jest.fn(),
        };

        mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
        mockedSign.mockReturnValue('signed-token');

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, makeMailer(), userDal as unknown as UserDal));
        app.use(makeErrorHandler());
    });

    it('returns 202 for valid signup', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'strongpassword123', email: 'ido@example.com' });

        expect(response.status).toBe(202);
        expect(response.body).toEqual({ message: 'Signup finished. Your account is awaiting admin approval' });
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(userDal.createUser).toHaveBeenCalledWith('ido', 'hashed-password', 'ido@example.com');
    });

    it('returns 409 when username already exists', async () => {
        userDal.verifyUser.mockResolvedValue(true);

        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'strongpassword123', email: 'ido@example.com' });

        expect(response.status).toBe(409);
        expect(userDal.createUser).not.toHaveBeenCalled();
    });

    it('returns 400 when username is too short', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'id', password: 'strongpassword123', email: 'ido@example.com' });

        expect(response.status).toBe(400);
    });

    it('returns 400 when password is too short', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'short', email: 'ido@example.com' });

        expect(response.status).toBe(400);
    });

    it('returns 400 when email is missing', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'strongpassword123' });

        expect(response.status).toBe(400);
    });

    it('returns 400 when body is missing', async () => {
        const response = await request(app).post('/auth/signup');

        expect(response.status).toBe(400);
    });
});

describe('POST /auth/login', () => {
    let app: Application;
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock; promoteToAdmin: jest.Mock };

    beforeEach(() => {
        userDal = {
            verifyUser: jest.fn(),
            createUser: jest.fn(),
            findUser: jest.fn().mockResolvedValue({ name: 'ido', password: 'hashed-password', role: 'user', status: 'approved' }),
            promoteToAdmin: jest.fn(),
        };

        mockedBcrypt.compare.mockResolvedValue(true as never);
        mockedSign.mockReturnValue('signed-token');

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, makeMailer(), userDal as unknown as UserDal));
        app.use(makeErrorHandler());
    });

    it('returns 200 with cookie for valid credentials', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({ username: 'ido', password: 'strongpassword123' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Login successful' });
        expect(response.headers['set-cookie']).toBeDefined();
        expect(response.headers['set-cookie'][0]).toContain('kawaz-token=signed-token');
    });

    it('returns 401 when user does not exist', async () => {
        userDal.findUser.mockResolvedValue(null);
        mockedBcrypt.compare.mockResolvedValue(false as never);

        const response = await request(app)
            .post('/auth/login')
            .send({ username: 'unknown', password: 'strongpassword123' });

        expect(response.status).toBe(401);
    });

    it('returns 401 when password is wrong', async () => {
        mockedBcrypt.compare.mockResolvedValue(false as never);

        const response = await request(app)
            .post('/auth/login')
            .send({ username: 'ido', password: 'wrongpassword123' });

        expect(response.status).toBe(401);
    });

    it('returns 401 when user is not approved', async () => {
        userDal.findUser.mockResolvedValue({ name: 'ido', password: 'hashed-password', role: 'user', status: 'pending' });

        const response = await request(app)
            .post('/auth/login')
            .send({ username: 'ido', password: 'strongpassword123' });

        expect(response.status).toBe(401);
    });

    it('returns 400 when body is missing', async () => {
        const response = await request(app).post('/auth/login');

        expect(response.status).toBe(400);
    });
});

describe('POST /auth/promote', () => {
    let app: Application;
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock; promoteToAdmin: jest.Mock };

    beforeEach(() => {
        userDal = {
            verifyUser: jest.fn(),
            createUser: jest.fn(),
            findUser: jest.fn(),
            promoteToAdmin: jest.fn().mockResolvedValue(true),
        };

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, makeMailer(), userDal as unknown as UserDal));
        app.use(makeErrorHandler());
    });

    it('returns 200 when secret and username are valid', async () => {
        const response = await request(app)
            .post('/auth/promote')
            .set('x-admin-secret', AUTH_CONFIG.adminPromotionSecret)
            .send({ username: 'ido' });

        expect(response.status).toBe(200);
        expect(userDal.promoteToAdmin).toHaveBeenCalledWith('ido');
    });

    it('returns 401 when secret is wrong', async () => {
        const response = await request(app)
            .post('/auth/promote')
            .set('x-admin-secret', 'wrong-secret')
            .send({ username: 'ido' });

        expect(response.status).toBe(401);
        expect(userDal.promoteToAdmin).not.toHaveBeenCalled();
    });

    it('returns 400 when x-admin-secret header is missing', async () => {
        const response = await request(app)
            .post('/auth/promote')
            .send({ username: 'ido' });

        expect(response.status).toBe(400);
    });

    it('returns 400 when username is missing', async () => {
        const response = await request(app)
            .post('/auth/promote')
            .set('x-admin-secret', AUTH_CONFIG.adminPromotionSecret)
            .send({});

        expect(response.status).toBe(400);
    });

    it('returns 404 when user does not exist', async () => {
        userDal.promoteToAdmin.mockResolvedValue(false);

        const response = await request(app)
            .post('/auth/promote')
            .set('x-admin-secret', AUTH_CONFIG.adminPromotionSecret)
            .send({ username: 'unknown' });

        expect(response.status).toBe(404);
    });
});

describe('POST /auth/forgot-password', () => {
    let app: Application;
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock; promoteToAdmin: jest.Mock; createPasswordResetRequestForUser: jest.Mock };

    beforeEach(() => {
        userDal = {
            verifyUser: jest.fn(),
            createUser: jest.fn(),
            findUser: jest.fn(),
            promoteToAdmin: jest.fn(),
            createPasswordResetRequestForUser: jest.fn().mockResolvedValue(true),
        };

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, makeMailer(), userDal as unknown as UserDal));
        app.use(makeErrorHandler());
    });

    it('returns 200 when email is registered', async () => {
        const response = await request(app)
            .post('/auth/forgot-password')
            .send({ email: 'ido@example.com' });

        expect(response.status).toBe(200);
    });

    it('returns 200 even when email is not registered (no enumeration)', async () => {
        userDal.createPasswordResetRequestForUser.mockResolvedValue(false);

        const response = await request(app)
            .post('/auth/forgot-password')
            .send({ email: 'unknown@example.com' });

        expect(response.status).toBe(200);
    });

    it('returns 400 when email is missing', async () => {
        const response = await request(app)
            .post('/auth/forgot-password')
            .send({});

        expect(response.status).toBe(400);
    });

    it('returns 400 when email is invalid', async () => {
        const response = await request(app)
            .post('/auth/forgot-password')
            .send({ email: 'not-an-email' });

        expect(response.status).toBe(400);
    });
});

describe('POST /auth/reset-password', () => {
    let app: Application;
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock; promoteToAdmin: jest.Mock; findUserByPasswordResetToken: jest.Mock; resetUserPassword: jest.Mock };

    beforeEach(() => {
        userDal = {
            verifyUser: jest.fn(),
            createUser: jest.fn(),
            findUser: jest.fn(),
            promoteToAdmin: jest.fn(),
            findUserByPasswordResetToken: jest.fn().mockResolvedValue('ido'),
            resetUserPassword: jest.fn().mockResolvedValue(undefined),
        };

        mockedBcrypt.hash.mockResolvedValue('new-hashed-password' as never);

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, makeMailer(), userDal as unknown as UserDal));
        app.use(makeErrorHandler());
    });

    it('returns 200 when token is valid', async () => {
        const response = await request(app)
            .post('/auth/reset-password')
            .send({ token: 'valid-token', newPassword: 'newpassword123' });

        expect(response.status).toBe(200);
        expect(userDal.resetUserPassword).toHaveBeenCalledWith('ido', 'new-hashed-password');
    });

    it('returns 400 when token is invalid or expired', async () => {
        userDal.findUserByPasswordResetToken.mockResolvedValue(null);

        const response = await request(app)
            .post('/auth/reset-password')
            .send({ token: 'expired-token', newPassword: 'newpassword123' });

        expect(response.status).toBe(400);
        expect(userDal.resetUserPassword).not.toHaveBeenCalled();
    });

    it('returns 400 when new password is too short', async () => {
        const response = await request(app)
            .post('/auth/reset-password')
            .send({ token: 'valid-token', newPassword: 'short' });

        expect(response.status).toBe(400);
    });

    it('returns 400 when body is missing', async () => {
        const response = await request(app)
            .post('/auth/reset-password')
            .send({});

        expect(response.status).toBe(400);
    });
});

describe('GET /auth/google/login', () => {
    let app: Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, makeMailer(), {} as unknown as UserDal));
        app.use(makeErrorHandler());
    });

    it('redirects to Google OAuth consent screen', async () => {
        const response = await request(app).get('/auth/google/login');

        expect(response.status).toBe(302);
        expect(response.headers['location']).toContain('https://accounts.google.com/o/oauth2/v2/auth');
        expect(response.headers['location']).toContain('client_id=test-google-client-id');
        expect(response.headers['location']).toContain('scope=openid+email+profile');
    });
});

describe('GET /auth/google/callback', () => {
    let app: Application;
    let userDal: { findUserByEmail: jest.Mock; verifyUser: jest.Mock; createUser: jest.Mock };

    beforeEach(() => {
        mockedFetchGoogleAccessToken.mockResolvedValue('access-token');
        mockedFetchGoogleUserInfo.mockResolvedValue({ name: 'John Doe', email: 'john@gmail.com' });

        userDal = {
            findUserByEmail: jest.fn(),
            verifyUser: jest.fn().mockResolvedValue(false),
            createUser: jest.fn().mockResolvedValue(undefined),
        };

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, makeMailer(), userDal as unknown as UserDal));
        app.use(makeErrorHandler());
    });

    it('redirects to /auth/callback with cookie for an approved existing user', async () => {
        userDal.findUserByEmail.mockResolvedValue({ name: 'John Doe', email: 'john@gmail.com', role: 'user', status: 'approved' });
        mockedSign.mockReturnValue('signed-token');

        const response = await request(app).get('/auth/google/callback?code=auth-code');

        expect(response.status).toBe(302);
        expect(response.headers['location']).toBe(`${AUTH_CONFIG.appDomain}/auth/callback`);
        expect(response.headers['set-cookie'][0]).toContain('kawaz-token=signed-token');
    });

    it('redirects to /auth/callback?pending=true for a new user', async () => {
        userDal.findUserByEmail.mockResolvedValue(null);
        mockedBcrypt.hash.mockResolvedValue('placeholder-hash' as never);

        const response = await request(app).get('/auth/google/callback?code=auth-code');

        expect(response.status).toBe(302);
        expect(response.headers['location']).toBe(`${AUTH_CONFIG.appDomain}/auth/callback?pending=true`);
        expect(userDal.createUser).toHaveBeenCalledWith('John Doe', 'placeholder-hash', 'john@gmail.com');
    });

    it('returns 401 for a pending existing user', async () => {
        userDal.findUserByEmail.mockResolvedValue({ name: 'John Doe', email: 'john@gmail.com', role: 'user', status: 'pending' });

        const response = await request(app).get('/auth/google/callback?code=auth-code');

        expect(response.status).toBe(401);
    });

    it('returns 409 when the Google display name is already taken', async () => {
        userDal.findUserByEmail.mockResolvedValue(null);
        userDal.verifyUser.mockResolvedValue(true);

        const response = await request(app).get('/auth/google/callback?code=auth-code');

        expect(response.status).toBe(409);
    });

    it('returns 400 when code is missing', async () => {
        const response = await request(app).get('/auth/google/callback');

        expect(response.status).toBe(400);
    });
});
