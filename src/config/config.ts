import dotenv from "dotenv";
import { Logger } from "../utils/logger";

dotenv.config();

const logger = Logger.getInstance();

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
    traefik: {
      defaultRecordType: string;
      defaultContent?: string;
      defaultProxied: boolean;
      defaultTTL: number;
    };
  };
}

const requiredEnvVars = ["CLOUDFLARE_TOKEN"];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

export const config: Config = {
  cloudflare: {
    token: process.env.CLOUDFLARE_TOKEN!,
  },
  docker: {
    socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock",
  },
  app: {
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || "3", 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || "300000", 10), // 5 minutes
    ipCheckInterval: parseInt(process.env.IP_CHECK_INTERVAL || "3600000", 10), // 1 hour
    useTraefikLabels:
      process.env.USE_TRAEFIK_LABELS?.toLowerCase() === "true" || false,
    traefik: {
      defaultRecordType: (
        process.env.TRAEFIK_DEFAULT_RECORD_TYPE || "A"
      ).toUpperCase(),
      defaultContent: process.env.TRAEFIK_DEFAULT_CONTENT,
      defaultProxied:
        process.env.TRAEFIK_DEFAULT_PROXIED?.toLowerCase() !== "false",
      defaultTTL: parseInt(process.env.TRAEFIK_DEFAULT_TTL || "1", 10),
    },
  },
};
