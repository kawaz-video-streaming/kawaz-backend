import Joi from "joi";
import { isNotNil } from "ramda";
import { AmqpConfig, createAmqpConfig } from "@ido_kawaz/amqp-client";
import { createMongoConfig, MongoConfig } from "@ido_kawaz/mongo-client";
import { createStorageClientConfig, StorageClientConfig } from "@ido_kawaz/storage-client";
import { ServerConfig } from "./services/server";

class InvalidConfigError extends Error {
  constructor(error: Joi.ValidationError) {
    const message = `Invalid configuration: \n${error.details.map(detail => detail.message).join(',\n')}`;
    super(message);
  }
}

const environments = ["development", "local", "test"] as const;

type Environment = typeof environments[number];

interface EnvironmentVariables {
  NODE_ENV: Environment;
  PORT: number;
  SECURED: boolean;
}

const environmentVariablesSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string().valid(...environments).default("development"),
  PORT: Joi.number().required(),
  SECURED: Joi.boolean().default(false)
}).unknown();

export interface SystemConfig {
  nodeEnv: Environment;
  amqpConfig: AmqpConfig;
  storageConfig: StorageClientConfig;
  serverConfig: ServerConfig;
  dbConfig: MongoConfig;
}

export const getConfig = (env: NodeJS.ProcessEnv): SystemConfig => {
  const { error, value } = environmentVariablesSchema.validate(env, { abortEarly: false, convert: true });
  if (isNotNil(error)) {
    throw new InvalidConfigError(error);
  }
  const envVars = value as EnvironmentVariables;
  return {
    nodeEnv: envVars.NODE_ENV,
    storageConfig: createStorageClientConfig(),
    amqpConfig: createAmqpConfig(),
    dbConfig: createMongoConfig(),
    serverConfig: {
      port: envVars.PORT,
      secured: envVars.SECURED
    },
  }
}