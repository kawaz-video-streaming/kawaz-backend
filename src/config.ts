import Joi from "joi";
import { InvalidConfigError } from "./utils/errors";
import { isNotNil } from "ramda";
import { ServerConfig } from "./services/server";

interface EnvironmentVariables {
  PORT: number;
}

const environmentVariablesSchema = Joi.object<EnvironmentVariables>({
  PORT: Joi.number().required()
}).unknown();

export interface SystemConfig {
  server: ServerConfig;
}

export const getConfig = (env: NodeJS.ProcessEnv): SystemConfig => {
  const { error, value } = environmentVariablesSchema.validate(env, { abortEarly: false, convert: true });
  if (isNotNil(error)) {
    throw new InvalidConfigError(error);
  } 
  return {
    server: {
        port: value.PORT
    }
  }
}