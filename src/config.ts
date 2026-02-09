import Joi from "joi";
import { isNotNil } from "ramda";
import { S3ClientConfig } from "@aws-sdk/client-s3";
import { DatabaseConfig } from "./services/db/types";
import { ServerConfig } from "./services/server/types";

class InvalidConfigError extends Error {
  constructor(error: Joi.ValidationError) {
    const message = `Invalid configuration: \n${error.details.map(detail => detail.message).join(',\n')}`;
    super(message);
  }
}

interface EnvironmentVariables {
  PORT: number;
  MONGO_CONNECTION_STRING: string;
  AWS_ENDPOINT: string;
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
}

const environmentVariablesSchema = Joi.object<EnvironmentVariables>({
  PORT: Joi.number().required(),
  MONGO_CONNECTION_STRING: Joi.string().uri().required(),
  AWS_ENDPOINT: Joi.string().uri().required(),
  AWS_REGION: Joi.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required()
}).unknown();

export interface SystemConfig {
  storage: S3ClientConfig;
  server: ServerConfig;
  db: DatabaseConfig;
}

export const getConfig = (env: NodeJS.ProcessEnv): SystemConfig => {
  const { error, value } = environmentVariablesSchema.validate(env, { abortEarly: false, convert: true });
  if (isNotNil(error)) {
    throw new InvalidConfigError(error);
  }
  return {
    storage: {
      region: value.AWS_REGION,
      endpoint: value.AWS_ENDPOINT,
      credentials: {
        accessKeyId: value.AWS_ACCESS_KEY_ID,
        secretAccessKey: value.AWS_SECRET_ACCESS_KEY
      }
    },
    server: {
      port: value.PORT
    },
    db: {
      dbConnectionString: value.MONGO_CONNECTION_STRING
    }
  }
}