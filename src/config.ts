import { AmqpConfig, createAmqpConfig } from "@ido_kawaz/amqp-client";
import { createMongoConfig, MongoConfig } from "@ido_kawaz/mongo-client";
import { createServerConfig, ServerConfig } from "@ido_kawaz/server-framework";
import { createStorageConfig, StorageConfig } from "@ido_kawaz/storage-client";
import { mergeDeepRight } from "ramda";
import { z } from "zod";
import { AuthConfig } from "./api/auth/types";
import { ConsumersConfig } from "./background/config";
import { BucketsConfig } from "./utils/types";
import { MailerConfig } from "./services/mailer";

class InvalidConfigError extends Error {
  constructor(error: z.ZodError) {
    const message = `Invalid configuration: \n${error.issues.map((detail) => detail.message).join(",\n")}`;
    super(message);
  }
}

export const SERVICE_NAME = "kawaz-backend";

const environments = ["development", "local", "test", "production"] as const;

export type Environment = (typeof environments)[number];

const environmentVariablesSchema = z.object({
  NODE_ENV: z.enum(environments).default("development"),
  KAWAZ_PLUS_BUCKET: z.string(),
  UPLOAD_PREFIX: z.string(),
  VOD_STORAGE_BUCKET: z.string(),
  THUMBNAIL_PREFIX: z.string(),
  AVATAR_PREFIX: z.string(),
  JWT_SECRET: z.string(),
  ADMIN_PROMOTION_SECRET: z.string(),
  GMAIL_USER: z.email(),
  GMAIL_APP_PASSWORD: z.string(),
});

export interface BackendServerConfig extends ServerConfig {
  authConfig: AuthConfig;
  bucketsConfig: BucketsConfig;
}

export interface SystemConfig {
  nodeEnv: Environment;
  amqpConfig: AmqpConfig;
  consumersConfig: ConsumersConfig;
  storageConfig: StorageConfig;
  serverConfig: BackendServerConfig;
  dbConfig: MongoConfig;
  mailerConfig: MailerConfig;
}

export const getConfig = (env: {} = {}): SystemConfig => {
  const parseResult = environmentVariablesSchema.safeParse(
    mergeDeepRight(process.env, env),
  );
  if (!parseResult.success) {
    throw new InvalidConfigError(parseResult.error);
  }
  const envVars = parseResult.data;
  const storageConfig = createStorageConfig();
  const bucketsConfig: BucketsConfig = {
    kawazPlus: {
      kawazStorageBucket: envVars.KAWAZ_PLUS_BUCKET,
      uploadPrefix: envVars.UPLOAD_PREFIX,
      thumbnailPrefix: envVars.THUMBNAIL_PREFIX,
      avatarPrefix: envVars.AVATAR_PREFIX,
    },
    vod: {
      vodStorageBucket: envVars.VOD_STORAGE_BUCKET,
    },
  };
  return {
    nodeEnv: envVars.NODE_ENV,
    serverConfig: {
      ...createServerConfig(),
      authConfig: {
        jwtSecret: envVars.JWT_SECRET,
        adminPromotionSecret: envVars.ADMIN_PROMOTION_SECRET,
      },
      bucketsConfig,
    },
    dbConfig: createMongoConfig(),
    storageConfig: storageConfig,
    amqpConfig: createAmqpConfig(),
    consumersConfig: {
      upload: {
        bucketsConfig,
        partSize: storageConfig.partSize,
      },
    },
    mailerConfig: {
      gmailUser: envVars.GMAIL_USER,
      gmailAppPassword: envVars.GMAIL_APP_PASSWORD,
    },
  };
};
