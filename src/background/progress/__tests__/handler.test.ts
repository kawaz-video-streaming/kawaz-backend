import { Types } from '@ido_kawaz/mongo-client';
import { MediaDal } from '../../../dal/media';
import { MediaMetadata } from '../../../dal/media/model';
import { mediaProgressHandler } from '../handler';

describe('mediaProgressHandler', () => {
    let mediaDal: { updateMedia: jest.Mock };
    let specialMediaDal: { updateMedia: jest.Mock };

    beforeEach(() => {
        mediaDal = { updateMedia: jest.fn().mockResolvedValue(undefined) };
        specialMediaDal = { updateMedia: jest.fn().mockResolvedValue(undefined) };
    });

    it.each([
        ['completed' as const],
        ['failed' as const],
    ])('calls updateMedia on both DALs with the given mediaId, "%s" status, and percentage', async (status) => {
        const mediaId = new Types.ObjectId().toString();
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal, specialMediaDal as unknown as MediaDal);

        await handler({ mediaId, status, percentage: 75 });

        expect(mediaDal.updateMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMedia).toHaveBeenCalledWith(mediaId, { status, percentage: 75 });
        expect(specialMediaDal.updateMedia).toHaveBeenCalledTimes(1);
        expect(specialMediaDal.updateMedia).toHaveBeenCalledWith(mediaId, { status, percentage: 75 });
    });

    it('includes metadata in update when status is completed and metadata is present', async () => {
        const mediaId = new Types.ObjectId().toString();
        const metadata = { name: 'My Video', durationInMs: 60000, playUrl: '/play', videoStreams: [], audioStreams: [], subtitleStreams: [] } as MediaMetadata;
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal, specialMediaDal as unknown as MediaDal);

        await handler({ mediaId, status: 'completed', percentage: 100, metadata });

        const expectedUpdate = { status: 'completed', percentage: 100, metadata };
        expect(mediaDal.updateMedia).toHaveBeenCalledWith(mediaId, expectedUpdate);
        expect(specialMediaDal.updateMedia).toHaveBeenCalledWith(mediaId, expectedUpdate);
    });

    it('does not include metadata in update when status is failed', async () => {
        const mediaId = new Types.ObjectId().toString();
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal, specialMediaDal as unknown as MediaDal);

        await handler({ mediaId, status: 'failed', percentage: 50 });

        const [, updateArg] = mediaDal.updateMedia.mock.calls[0];
        expect(updateArg).not.toHaveProperty('metadata');
        const [, specialUpdateArg] = specialMediaDal.updateMedia.mock.calls[0];
        expect(specialUpdateArg).not.toHaveProperty('metadata');
    });

    it('does not include metadata in update when metadata is absent', async () => {
        const mediaId = new Types.ObjectId().toString();
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal, specialMediaDal as unknown as MediaDal);

        await handler({ mediaId, status: 'completed', percentage: 100 });

        const [, updateArg] = mediaDal.updateMedia.mock.calls[0];
        expect(updateArg).not.toHaveProperty('metadata');
        const [, specialUpdateArg] = specialMediaDal.updateMedia.mock.calls[0];
        expect(specialUpdateArg).not.toHaveProperty('metadata');
    });

    it('propagates errors from updateMedia', async () => {
        mediaDal.updateMedia.mockRejectedValueOnce(new Error('db error'));
        const handler = mediaProgressHandler(mediaDal as unknown as MediaDal, specialMediaDal as unknown as MediaDal);

        await expect(handler({ mediaId: new Types.ObjectId().toString(), status: 'completed', percentage: 100 })).rejects.toThrow('db error');
    });
});
