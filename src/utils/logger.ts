import winston from "winston";
import util from "util";
import { red, yellow, blue, gray, white, cyan, bold, green } from "colorette";

const LOG_ICONS = {
  error: "❌",
  warn: "⚠️ ",
  info: "ℹ️ ",
  debug: "🔍",
} as const;

const LOG_COLORS = {
  error: red,
  warn: yellow,
  info: blue,
  debug: gray,
} as const;

const formatError = (error: any): string => {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === "object") {
    const { statusCode, json, message } = error;
    // Format plus compact pour les erreurs
    return `[${statusCode}] ${message || json?.message}`;
  }
  return String(error);
};

const isSimpleObject = (obj: any): boolean => {
  // Vérifie si c'est un objet simple (une seule profondeur)
  return (
    typeof obj === "object" &&
    obj !== null &&
    !Array.isArray(obj) &&
    Object.values(obj).every((v) => typeof v !== "object" || v === null)
  );
};

const simplifyObject = (obj: any): any => {
  // Si c'est un objet simple, le formater sur une ligne
  if (isSimpleObject(obj)) {
    return Object.entries(obj)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
  }

  // Pour les objets complexes, garder la structure JSON
  return obj;
};

const formatJSON = (obj: any): string => {
  const stringified = JSON.stringify(obj, null, 2);
  // Colorer manuellement les différentes parties du JSON
  return stringified
    .replace(/"([^"]+)":/g, (_, key) => `"${cyan(key)}":`)
    .replace(/"([^"]+)"/g, (_, value) => `"${yellow(value)}"`)
    .replace(/\b(true|false)\b/g, (_, value) => blue(value))
    .replace(/\b(\d+)\b/g, (_, value) => green(value))
    .replace(/\bnull\b/g, () => red("null"))
    .split("\n")
    .map((line: string, i: number) => (i === 0 ? line : "  " + line))
    .join("\n");
};

const formatValue = (value: any): string => {
  if (typeof value === "object" && value !== null) {
    return "\n" + formatJSON(value);
  }
  return " " + String(value);
};

const customFormat = winston.format.printf(
  ({ level, message, timestamp, ...metadata }) => {
    const normalizedLevel = level.toLowerCase() as keyof typeof LOG_ICONS;
    const icon = LOG_ICONS[normalizedLevel] || "🔧";
    const colorize = LOG_COLORS[normalizedLevel] || white;

    let log = `${timestamp} ${icon} [${bold(
      colorize(level.toUpperCase())
    )}] ${message}`;

    if (Object.keys(metadata).length > 0) {
      const prettyMetadata = Object.entries(metadata).reduce(
        (acc, [key, value]) => {
          if (key === "error") {
            acc[key] = red(formatError(value));
          } else {
            const simplified = simplifyObject(value);
            acc[key] = cyan(
              typeof simplified === "string"
                ? simplified
                : formatJSON(simplified)
            );
          }
          return acc;
        },
        {} as Record<string, string>
      );

      log +=
        " " +
        Object.entries(prettyMetadata)
          .map(([key, value]) => `${key}: ${value}`)
          .join(" ");
    }

    return log;
  }
);

export class Logger {
  private static instance: winston.Logger;

  private constructor() {}

  public static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        format: winston.format.combine(
          winston.format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
          }),
          customFormat
        ),
        transports: [
          new winston.transports.Console({
            stderrLevels: ["error"],
          }),
        ],
      });
    }
    return Logger.instance;
  }
}
