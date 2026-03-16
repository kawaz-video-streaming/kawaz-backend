import { Types } from '@ido_kawaz/mongo-client';
import { MediaDal } from '../../../dal/media';
import { completeMediaHandler } from '../handler';

describe('completeMediaHandler', () => {
    let mediaDal: { updateMediaStatus: jest.Mock };

    beforeEach(() => {
        mediaDal = {
            updateMediaStatus: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        };
    });

    it('calls updateMediaStatus with the given mediaId and "completed"', async () => {
        const mediaId = new Types.ObjectId().toString();
        const handler = completeMediaHandler(mediaDal as unknown as MediaDal);

        await handler({ mediaId });

        expect(mediaDal.updateMediaStatus).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledWith(mediaId, 'completed');
    });

    it('propagates errors from updateMediaStatus', async () => {
        mediaDal.updateMediaStatus.mockRejectedValueOnce(new Error('db error'));
        const handler = completeMediaHandler(mediaDal as unknown as MediaDal);

        await expect(handler({ mediaId: new Types.ObjectId().toString() })).rejects.toThrow('db error');
    });
});
