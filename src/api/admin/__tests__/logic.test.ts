import { NotFoundError } from '@ido_kawaz/server-framework';
import { UserDal } from '../../../dal/user';
import { Mailer } from '../../../services/mailer';
import { createAdminLogic } from '../logic';

const makeUserDal = (overrides: Partial<Record<keyof UserDal, jest.Mock>> = {}) =>
    ({
        getPendingUsers: jest.fn(),
        approveUser: jest.fn(),
        denyUser: jest.fn(),
        removeUser: jest.fn(),
        ...overrides,
    }) as unknown as UserDal;

const makeMailer = (overrides: Partial<Record<keyof Mailer, jest.Mock>> = {}) =>
    ({
        sendApprovalEmail: jest.fn().mockResolvedValue(undefined),
        sendDenialEmail: jest.fn().mockResolvedValue(undefined),
        sendApprovalRequestEmail: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    }) as unknown as Mailer;

describe('createAdminLogic.getPendingUsers', () => {
    it('delegates directly to userDal.getPendingUsers', async () => {
        const pendingUsers = [{ name: 'alice', email: 'alice@example.com', status: 'pending', role: 'user' }];
        const userDal = makeUserDal({ getPendingUsers: jest.fn().mockResolvedValue(pendingUsers) });
        const logic = createAdminLogic(makeMailer(), userDal);

        const result = await logic.getPendingUsers();

        expect(result).toBe(pendingUsers);
        expect(userDal.getPendingUsers).toHaveBeenCalledTimes(1);
    });
});

describe('createAdminLogic.approveUser', () => {
    it('approves user and sends approval email when user is found', async () => {
        const foundUser = { name: 'alice', email: 'alice@example.com' };
        const userDal = makeUserDal({ approveUser: jest.fn().mockResolvedValue(foundUser) });
        const mailer = makeMailer();
        const logic = createAdminLogic(mailer, userDal);

        await logic.approveUser('alice');

        expect(userDal.approveUser).toHaveBeenCalledWith('alice');
        expect(mailer.sendApprovalEmail).toHaveBeenCalledWith('alice', 'alice@example.com');
    });

    it('throws NotFoundError when user is not found', async () => {
        const userDal = makeUserDal({ approveUser: jest.fn().mockResolvedValue(null) });
        const logic = createAdminLogic(makeMailer(), userDal);

        await expect(logic.approveUser('unknown')).rejects.toThrow(NotFoundError);
        expect(userDal.approveUser).toHaveBeenCalledWith('unknown');
    });
});

describe('createAdminLogic.denyUser', () => {
    it('denies user, sends denial email, and removes user when found', async () => {
        const foundUser = { name: 'alice', email: 'alice@example.com' };
        const userDal = makeUserDal({
            denyUser: jest.fn().mockResolvedValue(foundUser),
            removeUser: jest.fn().mockResolvedValue(undefined),
        });
        const mailer = makeMailer();
        const logic = createAdminLogic(mailer, userDal);

        await logic.denyUser('alice');

        expect(userDal.denyUser).toHaveBeenCalledWith('alice');
        expect(mailer.sendDenialEmail).toHaveBeenCalledWith('alice', 'alice@example.com');
        expect(userDal.removeUser).toHaveBeenCalledWith('alice');
    });

    it('throws NotFoundError when user is not found', async () => {
        const userDal = makeUserDal({
            denyUser: jest.fn().mockResolvedValue(null),
            removeUser: jest.fn(),
        });
        const logic = createAdminLogic(makeMailer(), userDal);

        await expect(logic.denyUser('unknown')).rejects.toThrow(NotFoundError);
        expect(userDal.denyUser).toHaveBeenCalledWith('unknown');
        expect(userDal.removeUser).not.toHaveBeenCalled();
    });
});
