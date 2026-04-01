import { createServerConfig, ServerConfig } from "@ido_kawaz/server-framework";
import { createMongoConfig, MongoConfig } from "@ido_kawaz/mongo-client";
import { AmqpConfig, createAmqpConfig } from "@ido_kawaz/amqp-client";
import { createStorageConfig, StorageConfig } from "@ido_kawaz/storage-client";
import { createVodClientConfig, VodConfig } from "@ido_kawaz/vod-client";
import { mergeDeepRight } from "ramda";
import { z } from 'zod';
import { ConsumersConfig } from "./background/config";
import { AuthConfig } from "./api/auth/types";
import { MediaConfig } from "./api/media/types";

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
  UPLOAD_STORAGE_KEY_PREFIX: z.string(),
  VOD_STORAGE_BUCKET: z.string(),
  JWT_SECRET: z.string(),
  ADMIN_PROMOTION_SECRET: z.string()
});

export interface BackendServerConfig extends ServerConfig {
  authConfig: AuthConfig;
  mediaConfig: MediaConfig;
}

export interface SystemConfig {
  nodeEnv: Environment;
  amqpConfig: AmqpConfig;
  consumersConfig: ConsumersConfig;
  storageConfig: StorageConfig;
  serverConfig: BackendServerConfig;
  dbConfig: MongoConfig;
  vodConfig: VodConfig;
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
    serverConfig: {
      ...createServerConfig(),
      authConfig: {
        jwtSecret: envVars.JWT_SECRET,
        adminPromotionSecret: envVars.ADMIN_PROMOTION_SECRET,
      },
      mediaConfig: {
        vodStorageBucket: envVars.VOD_STORAGE_BUCKET,
      }
    },
    dbConfig: createMongoConfig(),
    storageConfig: storageConfig,
    amqpConfig: createAmqpConfig(),
    vodConfig: createVodClientConfig(),
    consumersConfig: {
      upload: {
        uploadBucket: envVars.UPLOAD_STORAGE_BUCKET,
        uploadKeyPrefix: envVars.UPLOAD_STORAGE_KEY_PREFIX,
        partSize: storageConfig.partSize,
      }
    }
  }
}