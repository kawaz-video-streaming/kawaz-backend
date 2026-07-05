import { isNotNil } from "ramda";
import { ContentRequest, ContentRequestStatus, ContentRequestTerminalStatus, contentRequestTerminalStatuses } from "../../dal/contentRequest/model";

export const isTerminalStatus = (status: ContentRequestStatus): status is ContentRequestTerminalStatus =>
    contentRequestTerminalStatuses.some((terminalStatus) => terminalStatus === status);

export const buildDisplayTitle = ({ title, mediaType, seasonNumber }: ContentRequest): string =>
    mediaType === "season" && isNotNil(seasonNumber) ? `${title} - Season ${seasonNumber}` : title;
