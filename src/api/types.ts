import { AuthenticatedRequest } from '../utils/types';
import { AvatarDal } from '../dal/avatar';
import { MediaDal } from '../dal/media';
import { MediaCollectionDal } from '../dal/mediaCollection';

export interface AvatarAuthenticatedRequest extends AuthenticatedRequest {
    avatarDal: AvatarDal;
}

export interface MediaAuthenticatedRequest extends AuthenticatedRequest {
    mediaDal: MediaDal;
    mediaCollectionDal: MediaCollectionDal;
}
