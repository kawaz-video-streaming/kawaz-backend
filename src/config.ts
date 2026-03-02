import { createServerConfig, ServerConfig } from "@ido_kawaz/server-framework";
import { createMongoConfig, MongoConfig } from "@ido_kawaz/mongo-client";
import { AmqpConfig, createAmqpConfig } from "@ido_kawaz/amqp-client";
import { createStorageConfig, StorageConfig } from "@ido_kawaz/storage-client";
import { mergeDeepRight } from "ramda";
import { z } from 'zod';

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
  NODE_ENV: z.enum(environments).default("development")
}).strict();

export interface SystemConfig {
  nodeEnv: Environment;
  amqpConfig: AmqpConfig;
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
  return {
    nodeEnv: envVars.NODE_ENV,
    serverConfig: createServerConfig(),
    dbConfig: createMongoConfig(),
    amqpConfig: createAmqpConfig(),
    storageConfig: createStorageConfig()
  }
}