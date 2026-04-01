import { Types } from '@ido_kawaz/mongo-client';
import { MediaDal } from '../../../dal/media';
import { MediaMetadata } from '../../../dal/media/model';
import { mediaProgressHandler } from '../handler';

describe('mediaProgressHandler', () => {
    let mediaDal: { updateMediaStatus: jest.Mock; updateMediaMetadata: jest.Mock };

    beforeEach(() => {
        mediaDal = {
            updateMediaStatus: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
            updateMediaMetadata: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
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

    it('calls updateMediaMetadata when status is completed and metadata is present', async () => {
        const mediaId = new Types.ObjectId().toString();
        const metadata = { _id: 'meta-1', title: 'My Video', durationInMs: 60000, playUrl: '/play', videoStreams: [], audioStreams: [], subtitleStreams: [] } as MediaMetadata;
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await handler({ mediaId, status: 'completed', metadata });

        expect(mediaDal.updateMediaMetadata).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMediaMetadata).toHaveBeenCalledWith(mediaId, metadata);
    });

    it('does not call updateMediaMetadata when status is failed', async () => {
        const mediaId = new Types.ObjectId().toString();
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await handler({ mediaId, status: 'failed' });

        expect(mediaDal.updateMediaMetadata).not.toHaveBeenCalled();
    });

    it('does not call updateMediaMetadata when metadata is absent', async () => {
        const mediaId = new Types.ObjectId().toString();
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await handler({ mediaId, status: 'completed' });

        expect(mediaDal.updateMediaMetadata).not.toHaveBeenCalled();
    });

    it('propagates errors from updateMediaStatus', async () => {
        mediaDal.updateMediaStatus.mockRejectedValueOnce(new Error('db error'));
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await expect(handler({ mediaId: new Types.ObjectId().toString(), status: 'completed' })).rejects.toThrow('db error');
    });
});
