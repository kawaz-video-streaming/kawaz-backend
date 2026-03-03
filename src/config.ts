import { createServerConfig, ServerConfig } from "@ido_kawaz/server-framework";
import { createMongoConfig, MongoConfig } from "@ido_kawaz/mongo-client";
import { AmqpConfig, createAmqpConfig } from "@ido_kawaz/amqp-client";
import { createStorageConfig, StorageConfig } from "@ido_kawaz/storage-client";
import { mergeDeepRight } from "ramda";
import { z } from 'zod';
import { ConsumersConfig } from "./background/config";

class InvalidConfigError extends Error {
  constructor(error: z.ZodError) {
    const message = `Invalid configuration: \n${error.issues.map(detail => detail.message).join(',\n')}`;
    super(message);
  }
}

export const SERVICE_NAME = "kawaz-backend";

const environments = ["development", "local", "test"] as const;

export type Environment = typeof environments[number];

const environmentVariablesSchema = z.object({
  NODE_ENV: z.enum(environments).default("development"),
  UPLOAD_STORAGE_BUCKET: z.string(),
  UPLOAD_STORAGE_KEY_PREFIX: z.string()
});

export interface SystemConfig {
  nodeEnv: Environment;
  amqpConfig: AmqpConfig;
  consumersConfig: ConsumersConfig;
  storageConfig: StorageConfig;
  serverConfig: ServerConfig;
  dbConfig: MongoConfig;
}

export const getConfig = (env: {} = {}): SystemConfig => {
  const parseResult = environmentVariablesSchema.safeParse(mergeDeepRight(process.env, env));
  if (!parseResult.success) {
    throw new InvalidConfigError(parseResult.error);
  }
  const envVars = parseResult.data;
  const storageConfig = createStorageConfig();
  return {
    nodeEnv: envVars.NODE_ENV,
    serverConfig: createServerConfig(),
    dbConfig: createMongoConfig(),
    storageConfig: storageConfig,
    amqpConfig: createAmqpConfig(),
    consumersConfig: {
      upload: {
        uploadBucket: envVars.UPLOAD_STORAGE_BUCKET,
        uploadKeyPrefix: envVars.UPLOAD_STORAGE_KEY_PREFIX,
        partSize: storageConfig.partSize,
      }
    }
  }
}