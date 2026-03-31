import { ApiError } from '@ido_kawaz/server-framework';
import bcrypt from 'bcrypt';
import express, { Application, NextFunction, Request, Response } from 'express';
import * as jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';
import { UserDal } from '../../../dal/user';
import { createAuthRouter } from '../index';

const noopMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedSign = jsonwebtoken.sign as jest.Mock;

const AUTH_CONFIG = { jwtSecret: 'test-secret', adminPromotionSecret: 'test-admin-secret' };

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
        app.use('/auth', createAuthRouter(AUTH_CONFIG, noopMiddleware, userDal as unknown as UserDal));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    });

    it('returns 201 with cookie for valid signup', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'strongpassword123' });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ message: 'Signup successful' });
        expect(response.headers['set-cookie']).toBeDefined();
        expect(response.headers['set-cookie'][0]).toContain('kawaz-token=signed-token');
        expect(userDal.createUser).toHaveBeenCalledWith('ido', 'hashed-password');
    });

    it('returns 409 when username already exists', async () => {
        userDal.verifyUser.mockResolvedValue(true);

        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'strongpassword123' });

        expect(response.status).toBe(409);
        expect(userDal.createUser).not.toHaveBeenCalled();
    });

    it('returns 400 when username is too short', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'id', password: 'strongpassword123' });

        expect(response.status).toBe(400);
    });

    it('returns 400 when password is too short', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'short' });

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
            findUser: jest.fn().mockResolvedValue({ name: 'ido', password: 'hashed-password', role: 'user' }),
            promoteToAdmin: jest.fn(),
        };

        mockedBcrypt.compare.mockResolvedValue(true as never);
        mockedSign.mockReturnValue('signed-token');

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, noopMiddleware, userDal as unknown as UserDal));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
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
        app.use('/auth', createAuthRouter(AUTH_CONFIG, noopMiddleware, userDal as unknown as UserDal));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
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

describe('GET /auth/me', () => {
    let app: Application;
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock; promoteToAdmin: jest.Mock };

    const meMiddleware = (req: Request, _res: Response, next: NextFunction) => {
        (req as any).user = { username: 'ido', role: 'user' };
        next();
    };

    beforeEach(() => {
        userDal = {
            verifyUser: jest.fn(),
            createUser: jest.fn(),
            findUser: jest.fn(),
            promoteToAdmin: jest.fn(),
        };

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, meMiddleware, userDal as unknown as UserDal));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    });

    it('returns 200 with authenticated user info', async () => {
        const response = await request(app).get('/auth/me');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ username: 'ido', role: 'user' });
    });
});
