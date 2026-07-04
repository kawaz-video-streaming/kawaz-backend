import { Dal, Types } from "@ido_kawaz/mongo-client";
import { isNotNil } from "ramda";
import { ContentRequest, ContentRequestMediaType, ContentRequestModel, ContentRequestStatus, REQUESTED_STATUS } from "./model";

export class ContentRequestDal extends Dal<ContentRequest> {
    constructor(model: ContentRequestModel) {
        super(model);
    }

    createRequest = async (
        username: string,
        tmdbId: number,
        mediaType: ContentRequestMediaType,
        title: string,
        year?: number,
        posterPath?: string | null,
        seasonNumber?: number,
    ): Promise<ContentRequest> => {
        const request: ContentRequest = {
            _id: new Types.ObjectId().toString(),
            username,
            tmdbId,
            mediaType,
            title,
            year,
            ...(isNotNil(seasonNumber) && { seasonNumber }),
            ...(isNotNil(posterPath) && { posterPath }),
            status: REQUESTED_STATUS,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await this.model.insertOne(request);
        return request;
    }

    getRequestsForUser = (username: string): Promise<ContentRequest[]> =>
        this.model.find({ username }).sort({ createdAt: -1 }).lean<ContentRequest[]>().exec();

    getAllRequests = (): Promise<ContentRequest[]> =>
        this.model.find().sort({ createdAt: -1 }).lean<ContentRequest[]>().exec();

    getRequestById = (id: string): Promise<ContentRequest | null> =>
        this.model.findById(id).lean<ContentRequest>().exec();

    updateRequestStatus = (id: string, status: ContentRequestStatus, adminNote?: string): Promise<ContentRequest | null> =>
        this.model.findByIdAndUpdate(id, { status, ...(adminNote && { adminNote }) }, { new: true }).lean<ContentRequest>().exec();
}
