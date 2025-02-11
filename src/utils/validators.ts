import { Logger } from "./logger";

const logger = Logger.getInstance();

export interface DNSLabel {
  hostname: string;
  type?: string;
  content?: string;
  ttl?: number;
  proxied?: boolean;
}

export class LabelValidator {
  private static readonly VALID_RECORD_TYPES = [
    "A",
    "AAAA",
    "CNAME",
    "TXT",
    "MX",
  ];
  private static readonly DNS_LABEL_PREFIX = "dns.cloudflare.";

  public static validateServiceLabels(
    serviceName: string,
    labels: { [key: string]: string }
  ): DNSLabel[] {
    const dnsLabels: DNSLabel[] = [];
    const baseLabels = new Map<string, DNSLabel>();

    logger.debug("Starting label validation", { serviceName, labels });

    // Afficher tous les labels pour le débogage
    Object.entries(labels).forEach(([key, value]) => {
      logger.debug(`Found label: "${key}" = "${value}"`);
    });

    // Parcourir tous les labels pour trouver les configurations DNS
    for (const [key, value] of Object.entries(labels)) {
      // Normaliser la clé pour la comparaison
      const normalizedKey = key.toLowerCase();
      if (!normalizedKey.startsWith(this.DNS_LABEL_PREFIX.toLowerCase())) {
        logger.debug(`Skipping non-DNS label: ${key}`);
        continue;
      }

      logger.debug(`Processing DNS label: ${key} = ${value}`);

      const labelName = key.substring(this.DNS_LABEL_PREFIX.length);
      // Gérer les cas comme "hostname.v6" ou "type.v6"
      const parts = labelName.split(".");
      const baseKey = parts[0];
      const suffix = parts.slice(1).join(".");
      const labelGroup = suffix || "default";

      if (!baseLabels.has(labelGroup)) {
        baseLabels.set(labelGroup, {
          hostname: "",
          type: "A", // Type par défaut
        });
        logger.debug(`Created new label group: ${labelGroup}`);
      }

      const label = baseLabels.get(labelGroup)!;

      switch (baseKey) {
        case "hostname":
          label.hostname = value;
          logger.debug(`Set hostname for group ${labelGroup}: ${value}`);
          break;
        case "type":
          if (!this.VALID_RECORD_TYPES.includes(value.toUpperCase())) {
            logger.warn(
              `Invalid DNS record type "${value}" for service ${serviceName}, using "A" instead`
            );
            label.type = "A";
          } else {
            label.type = value.toUpperCase();
            logger.debug(`Set type for group ${labelGroup}: ${value}`);
          }
          break;
        case "content":
          label.content = value;
          logger.debug(`Set content for group ${labelGroup}: ${value}`);
          break;
        case "ttl":
          const ttl = parseInt(value, 10);
          if (isNaN(ttl) || ttl < 1) {
            logger.warn(
              `Invalid TTL value "${value}" for service ${serviceName}, using default`
            );
          } else {
            label.ttl = ttl;
            logger.debug(`Set TTL for group ${labelGroup}: ${ttl}`);
          }
          break;
        case "proxied":
          label.proxied = value.toLowerCase() === "true";
          logger.debug(`Set proxied for group ${labelGroup}: ${label.proxied}`);
          break;
        default:
          logger.warn(`Unknown DNS label key: ${baseKey}`);
          break;
      }
    }

    // Valider chaque groupe de labels
    for (const [group, label] of baseLabels.entries()) {
      logger.debug(`Validating label group: ${group}`, { label });

      if (!label.hostname) {
        logger.error(
          `Missing required hostname for DNS configuration in service ${serviceName} (group: ${group})`
        );
        continue;
      }

      // Validation spécifique par type
      switch (label.type) {
        case "CNAME":
          if (!label.content) {
            logger.error(
              `Missing required content for CNAME record in service ${serviceName} (group: ${group})`
            );
            continue;
          }
          break;
        case "AAAA":
          if (label.content && !this.isValidIPv6(label.content)) {
            logger.error(
              `Invalid IPv6 address "${label.content}" in service ${serviceName} (group: ${group})`
            );
            continue;
          }
          break;
      }

      dnsLabels.push(label);
      logger.debug(`Added valid DNS label`, { group, label });
    }

    logger.info(
      `Validated ${dnsLabels.length} DNS labels for service ${serviceName}`
    );
    return dnsLabels;
  }

  private static isValidIPv6(ip: string): boolean {
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv6Regex.test(ip);
  }
}
