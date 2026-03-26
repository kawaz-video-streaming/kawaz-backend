import { ApiError } from '@ido_kawaz/server-framework';
import bcrypt from 'bcrypt';
import express, { Application } from 'express';
import * as jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';
import { UserDal } from '../../../dal/user';
import { createAuthRouter } from '../index';

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedSign = jsonwebtoken.sign as jest.Mock;

const JWT_SECRET = 'test-secret';

describe('POST /auth/signup', () => {
    let app: Application;
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock };

    beforeEach(() => {
        userDal = {
            verifyUser: jest.fn().mockResolvedValue(false),
            createUser: jest.fn().mockResolvedValue(undefined),
            findUser: jest.fn(),
        };

        mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
        mockedSign.mockReturnValue('signed-token');

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(JWT_SECRET, userDal as unknown as UserDal));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    });

    it('returns 201 with token for valid signup', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'strongpassword123' });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ token: 'signed-token' });
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
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock };

    beforeEach(() => {
        userDal = {
            verifyUser: jest.fn(),
            createUser: jest.fn(),
            findUser: jest.fn().mockResolvedValue({ name: 'ido', password: 'hashed-password' }),
        };

        mockedBcrypt.compare.mockResolvedValue(true as never);
        mockedSign.mockReturnValue('signed-token');

        app = express();
        app.use(express.json());
        app.use('/auth', createAuthRouter(JWT_SECRET, userDal as unknown as UserDal));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    });

    it('returns 200 with token for valid credentials', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({ username: 'ido', password: 'strongpassword123' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ token: 'signed-token' });
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
