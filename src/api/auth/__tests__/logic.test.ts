import { ConflictError, UnauthorizedError } from '@ido_kawaz/server-framework';
import bcrypt from 'bcrypt';
import * as jsonwebtoken from 'jsonwebtoken';
import { UserDal } from '../../../dal/user';
import { createAuthLogic } from '../logic';

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedSign = jsonwebtoken.sign as jest.Mock;

const JWT_SECRET = 'test-secret';

const makeUserDal = (overrides: Partial<Record<keyof UserDal, jest.Mock>> = {}) => ({
    verifyUser: jest.fn(),
    createUser: jest.fn(),
    findUser: jest.fn(),
    ...overrides,
} as unknown as UserDal);

describe('createAuthLogic.signUp', () => {
    it('throws ConflictError when username already exists', async () => {
        const userDal = makeUserDal({ verifyUser: jest.fn().mockResolvedValue(true) });
        const logic = createAuthLogic(JWT_SECRET, userDal);

        await expect(logic.signUp('ido', 'strongpassword123')).rejects.toThrow(ConflictError);
        expect(userDal.createUser).not.toHaveBeenCalled();
    });

    it('hashes password and creates user then returns token', async () => {
        const userDal = makeUserDal({
            verifyUser: jest.fn().mockResolvedValue(false),
            createUser: jest.fn().mockResolvedValue(undefined),
        });
        mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
        mockedSign.mockReturnValue('signed-token');

        const logic = createAuthLogic(JWT_SECRET, userDal);
        const token = await logic.signUp('ido', 'strongpassword123');

        expect(mockedBcrypt.hash).toHaveBeenCalledWith('strongpassword123', 12);
        expect(userDal.createUser).toHaveBeenCalledWith('ido', 'hashed-password');
        expect(mockedSign).toHaveBeenCalledWith({ username: 'ido' }, JWT_SECRET, { expiresIn: '2d' });
        expect(token).toBe('signed-token');
    });
});

describe('createAuthLogic.login', () => {
    it('throws UnauthorizedError when user does not exist', async () => {
        const userDal = makeUserDal({ findUser: jest.fn().mockResolvedValue(null) });
        mockedBcrypt.compare.mockResolvedValue(false as never);

        const logic = createAuthLogic(JWT_SECRET, userDal);

        await expect(logic.login('ido', 'strongpassword123')).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when password does not match', async () => {
        const userDal = makeUserDal({
            findUser: jest.fn().mockResolvedValue({ name: 'ido', password: 'hashed-password' }),
        });
        mockedBcrypt.compare.mockResolvedValue(false as never);

        const logic = createAuthLogic(JWT_SECRET, userDal);

        await expect(logic.login('ido', 'wrongpassword123')).rejects.toThrow(UnauthorizedError);
    });

    it('returns token for valid credentials', async () => {
        const userDal = makeUserDal({
            findUser: jest.fn().mockResolvedValue({ name: 'ido', password: 'hashed-password' }),
        });
        mockedBcrypt.compare.mockResolvedValue(true as never);
        mockedSign.mockReturnValue('signed-token');

        const logic = createAuthLogic(JWT_SECRET, userDal);
        const token = await logic.login('ido', 'strongpassword123');

        expect(mockedSign).toHaveBeenCalledWith({ username: 'ido' }, JWT_SECRET, { expiresIn: '2d' });
        expect(token).toBe('signed-token');
    });
});
