import { createRequestHandlerDecorator } from "@ido_kawaz/server-framework";
import { SERVICE_NAME } from "../config";

export const requestHandlerDecorator = createRequestHandlerDecorator(SERVICE_NAME);