import { Types } from '@ido_kawaz/mongo-client';
import { MediaDal } from '../../../dal/media';
import { MediaMetadata } from '../../../dal/media/model';
import { mediaProgressHandler } from '../handler';

describe('mediaProgressHandler', () => {
    let mediaDal: { updateMedia: jest.Mock };

    beforeEach(() => {
        mediaDal = {
            updateMedia: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        };
    });

    it.each([
        ['completed' as const],
        ['failed' as const],
    ])('calls updateMedia with the given mediaId and "%s" status', async (status) => {
        const mediaId = new Types.ObjectId().toString();
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await handler({ mediaId, status });

        expect(mediaDal.updateMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMedia).toHaveBeenCalledWith(mediaId, { status });
    });

    it('includes metadata in update when status is completed and metadata is present', async () => {
        const mediaId = new Types.ObjectId().toString();
        const metadata = { name: 'My Video', durationInMs: 60000, playUrl: '/play', videoStreams: [], audioStreams: [], subtitleStreams: [] } as MediaMetadata;
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await handler({ mediaId, status: 'completed', metadata });

        expect(mediaDal.updateMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMedia).toHaveBeenCalledWith(mediaId, { status: 'completed', metadata });
    });

    it('does not include metadata in update when status is failed', async () => {
        const mediaId = new Types.ObjectId().toString();
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await handler({ mediaId, status: 'failed' });

        expect(mediaDal.updateMedia).toHaveBeenCalledWith(mediaId, { status: 'failed' });
        const [, updateArg] = mediaDal.updateMedia.mock.calls[0];
        expect(updateArg).not.toHaveProperty('metadata');
    });

    it('does not include metadata in update when metadata is absent', async () => {
        const mediaId = new Types.ObjectId().toString();
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await handler({ mediaId, status: 'completed' });

        const [, updateArg] = mediaDal.updateMedia.mock.calls[0];
        expect(updateArg).not.toHaveProperty('metadata');
    });

    it('propagates errors from updateMedia', async () => {
        mediaDal.updateMedia.mockRejectedValueOnce(new Error('db error'));
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal);

        await expect(handler({ mediaId: new Types.ObjectId().toString(), status: 'completed' })).rejects.toThrow('db error');
    });
});
