import dotenv from "dotenv";
import { Logger } from "../utils/logger";
import { z } from "zod";

const logger = Logger.getInstance();

export interface AppConfig {
  useTraefikLabels: boolean;
  defaults: {
    recordType: string;
    proxied: boolean;
    content?: string;
    ttl?: number;
  };
}

interface Config {
  cloudflare: {
    token: string;
  };
  docker: {
    socketPath: string;
  };
  app: {
    retryAttempts: number;
    retryDelay: number;
    ipCheckInterval: number;
    useTraefikLabels: boolean;
    defaults: {
      recordType: string;
      content?: string;
      proxied: boolean;
      ttl: number;
    };
  };
}

// Ne charger .env que si on n'est pas en test
if (process.env.NODE_ENV !== "test") {
  dotenv.config();
}

const envSchema = z.object({
  CLOUDFLARE_TOKEN: z
    .string({
      required_error: "CLOUDFLARE_TOKEN is required",
    })
    .min(1, "CLOUDFLARE_TOKEN cannot be empty"),
  RETRY_ATTEMPTS: z.string().optional(),
  RETRY_DELAY: z.string().optional(),
  IP_CHECK_INTERVAL: z.string().optional(),
});

const env = envSchema.safeParse(process.env);

if (!env.success) {
  const error = new Error(env.error.errors[0].message);
  logger.error("Configuration error", { error: error.message });
  throw error;
}

const parsedEnv = env.data;

export const config: Config = {
  cloudflare: {
    token: parsedEnv.CLOUDFLARE_TOKEN,
  },
  docker: {
    socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock",
  },
  app: {
    retryAttempts: parseInt(parsedEnv.RETRY_ATTEMPTS ?? "3", 10),
    retryDelay: parseInt(parsedEnv.RETRY_DELAY ?? "300000", 10),
    ipCheckInterval: parseInt(parsedEnv.IP_CHECK_INTERVAL ?? "3600000", 10),
    useTraefikLabels:
      process.env.USE_TRAEFIK_LABELS?.toLowerCase() === "true" || false,
    defaults: {
      recordType: (process.env.DNS_DEFAULT_RECORD_TYPE || "A").toUpperCase(),
      content: process.env.DNS_DEFAULT_CONTENT,
      proxied: process.env.DNS_DEFAULT_PROXIED?.toLowerCase() !== "false",
      ttl: parseInt(process.env.DNS_DEFAULT_TTL || "1", 10),
    },
  },
};
