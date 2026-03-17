import { Types } from '@ido_kawaz/mongo-client';
import { MediaDal } from '../../../dal/media';
import { mediaProgressHandler } from '../handler';

describe('mediaProgressHandler', () => {
    let mediaDal: { updateMediaStatus: jest.Mock };

    beforeEach(() => {
        mediaDal = {
            updateMediaStatus: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        };
    });

    it.each([
        ['completed' as const],
        ['failed' as const],
    ])('calls updateMediaStatus with the given mediaId and "%s"', async (status) => {
        const mediaId = new Types.ObjectId().toString();
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await handler({ mediaId, status });

        expect(mediaDal.updateMediaStatus).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledWith(mediaId, status);
    });

    it('propagates errors from updateMediaStatus', async () => {
        mediaDal.updateMediaStatus.mockRejectedValueOnce(new Error('db error'));
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await expect(handler({ mediaId: new Types.ObjectId().toString(), status: 'completed' })).rejects.toThrow('db error');
    });
});
