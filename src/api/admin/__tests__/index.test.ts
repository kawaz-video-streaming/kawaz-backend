import { ApiError } from '@ido_kawaz/server-framework';
import express, { Application } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { UserDal } from '../../../dal/user';
import { Mailer } from '../../../services/mailer';
import { createAuthMiddleware, requireAdmin } from '../../middleware';
import { createAdminRouter } from '../index';

const parseCookies = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.cookies = {};
    const header = req.headers.cookie ?? '';
    for (const pair of header.split(';')) {
        const idx = pair.indexOf('=');
        if (idx > 0) req.cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
    next();
};

const AUTH_CONFIG = { jwtSecret: 'admin-test-secret', adminPromotionSecret: 'admin-promote-secret', googleClientId: 'test-google-client-id', googleClientSecret: 'test-google-client-secret', appDomain: 'http://localhost:3000', isProduction: false };

const pendingUsers = [
    { name: 'alice', email: 'alice@example.com', status: 'pending', role: 'user' },
    { name: 'bob', email: 'bob@example.com', status: 'pending', role: 'user' },
];

type MockUserDal = {
    findUser: jest.Mock;
    getPendingUsers: jest.Mock;
    approveUser: jest.Mock;
    denyUser: jest.Mock;
    removeUser: jest.Mock;
};

type MockMailer = {
    sendApprovalEmail: jest.Mock;
    sendDenialEmail: jest.Mock;
    sendApprovalRequestEmail: jest.Mock;
};

const makeApp = (userDal: MockUserDal, mailer: MockMailer): Application => {
    const app = express();
    app.use(parseCookies);
    app.use(express.json());
    app.use(createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal));
    app.use('/admin', requireAdmin, createAdminRouter(mailer as unknown as Mailer, userDal as unknown as UserDal));
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

const makeAdminDal = (overrides: Partial<MockUserDal> = {}): MockUserDal => ({
    findUser: jest.fn().mockResolvedValue({ name: 'admin', password: 'hash', role: 'admin' }),
    getPendingUsers: jest.fn().mockResolvedValue(pendingUsers),
    approveUser: jest.fn().mockResolvedValue({ name: 'alice', email: 'alice@example.com' }),
    denyUser: jest.fn().mockResolvedValue({ name: 'alice', email: 'alice@example.com' }),
    removeUser: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

const makeMailer = (overrides: Partial<MockMailer> = {}): MockMailer => ({
    sendApprovalEmail: jest.fn().mockResolvedValue(undefined),
    sendDenialEmail: jest.fn().mockResolvedValue(undefined),
    sendApprovalRequestEmail: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

describe('GET /admin/pending', () => {
    let adminToken: string;
    let userToken: string;

    beforeEach(() => {
        adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);
        userToken = jwt.sign({ username: 'user', role: 'user' }, AUTH_CONFIG.jwtSecret);
    });

    it('returns 200 with list of pending users', async () => {
        const userDal = makeAdminDal();
        const app = makeApp(userDal, makeMailer());

        const response = await request(app)
            .get('/admin/pending')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(userDal.getPendingUsers).toHaveBeenCalledTimes(1);
    });

    it('returns 200 with empty array when no pending users', async () => {
        const userDal = makeAdminDal({ getPendingUsers: jest.fn().mockResolvedValue([]) });
        const app = makeApp(userDal, makeMailer());

        const response = await request(app)
            .get('/admin/pending')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('returns 401 when not authenticated', async () => {
        const app = makeApp(makeAdminDal(), makeMailer());
        const response = await request(app).get('/admin/pending');
        expect(response.status).toBe(401);
    });

    it('returns 401 when non-admin user tries to access', async () => {
        const userDal = makeAdminDal({
            findUser: jest.fn().mockResolvedValue({ name: 'user', password: 'hash', role: 'user' }),
        });
        const app = makeApp(userDal, makeMailer());

        const response = await request(app)
            .get('/admin/pending')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(401);
        expect(userDal.getPendingUsers).not.toHaveBeenCalled();
    });
});

describe('POST /admin/pending/:username/approve', () => {
    let adminToken: string;
    let userToken: string;

    beforeEach(() => {
        adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);
        userToken = jwt.sign({ username: 'user', role: 'user' }, AUTH_CONFIG.jwtSecret);
    });

    it('returns 200 and sends approval email when user is found', async () => {
        const userDal = makeAdminDal();
        const mailer = makeMailer();
        const app = makeApp(userDal, mailer);

        const response = await request(app)
            .post('/admin/pending/alice/approve/user')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'User approved' });
        expect(userDal.approveUser).toHaveBeenCalledWith('alice', 'user');
        expect(mailer.sendApprovalEmail).toHaveBeenCalledWith('alice', 'alice@example.com');
    });

    it('returns 404 when user is not found', async () => {
        const userDal = makeAdminDal({ approveUser: jest.fn().mockResolvedValue(null) });
        const mailer = makeMailer();
        const app = makeApp(userDal, mailer);

        const response = await request(app)
            .post('/admin/pending/unknown/approve/user')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(response.status).toBe(404);
        expect(mailer.sendApprovalEmail).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
        const app = makeApp(makeAdminDal(), makeMailer());
        const response = await request(app).post('/admin/pending/alice/approve/user');
        expect(response.status).toBe(401);
    });

    it('returns 401 when non-admin user tries to approve', async () => {
        const userDal = makeAdminDal({
            findUser: jest.fn().mockResolvedValue({ name: 'user', password: 'hash', role: 'user' }),
        });
        const mailer = makeMailer();
        const app = makeApp(userDal, mailer);

        const response = await request(app)
            .post('/admin/pending/alice/approve/user')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(401);
        expect(userDal.approveUser).not.toHaveBeenCalled();
    });
});

describe('POST /admin/pending/:username/deny', () => {
    let adminToken: string;
    let userToken: string;

    beforeEach(() => {
        adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);
        userToken = jwt.sign({ username: 'user', role: 'user' }, AUTH_CONFIG.jwtSecret);
    });

    it('returns 200, sends denial email, and removes user when found', async () => {
        const userDal = makeAdminDal();
        const mailer = makeMailer();
        const app = makeApp(userDal, mailer);

        const response = await request(app)
            .post('/admin/pending/alice/deny')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'User denied' });
        expect(userDal.denyUser).toHaveBeenCalledWith('alice');
        expect(mailer.sendDenialEmail).toHaveBeenCalledWith('alice', 'alice@example.com');
        expect(userDal.removeUser).toHaveBeenCalledWith('alice');
    });

    it('returns 404 when user is not found', async () => {
        const userDal = makeAdminDal({ denyUser: jest.fn().mockResolvedValue(null) });
        const mailer = makeMailer();
        const app = makeApp(userDal, mailer);

        const response = await request(app)
            .post('/admin/pending/unknown/deny')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(response.status).toBe(404);
        expect(mailer.sendDenialEmail).not.toHaveBeenCalled();
        expect(userDal.removeUser).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
        const app = makeApp(makeAdminDal(), makeMailer());
        const response = await request(app).post('/admin/pending/alice/deny');
        expect(response.status).toBe(401);
    });

    it('returns 401 when non-admin user tries to deny', async () => {
        const userDal = makeAdminDal({
            findUser: jest.fn().mockResolvedValue({ name: 'user', password: 'hash', role: 'user' }),
        });
        const mailer = makeMailer();
        const app = makeApp(userDal, mailer);

        const response = await request(app)
            .post('/admin/pending/alice/deny')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(401);
        expect(userDal.denyUser).not.toHaveBeenCalled();
    });
});
