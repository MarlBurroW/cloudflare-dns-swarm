import { Logger } from "./logger";
import { config } from "../config/config";

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
  private static readonly TRAEFIK_HOST_REGEX = /Host\(`([^`]+)`\)/;

  private static isValidIPv6(ip: string): boolean {
    const ipv6Regex =
      /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:)*:[0-9a-fA-F]{1,4}|:(?::[0-9a-fA-F]{1,4})*$/;
    return ipv6Regex.test(ip);
  }

  private logger = Logger.getInstance();

  public validateServiceLabels(
    serviceName: string,
    labels: { [key: string]: string }
  ): DNSLabel[] {
    this.logger.debug("Starting label validation", { serviceName, labels });

    // Vérifier d'abord si Traefik est activé
    if (config.app.useTraefikLabels && labels["traefik.enable"] === "true") {
      // Extraire les labels Traefik
      const traefikLabels = this.extractTraefikLabels(labels);
      if (traefikLabels.length > 0) {
        return traefikLabels;
      }
    }

    // Sinon, utiliser les labels DNS explicites
    return this.extractDNSLabels(serviceName, labels);
  }

  private validateDNSLabel(
    serviceName: string,
    label: DNSLabel,
    includeDefaults: boolean = false
  ): DNSLabel | null {
    if (!label.hostname) {
      this.logger.error(
        `Missing required hostname for DNS configuration in service ${serviceName}`
      );
      return null;
    }

    // Commencer avec les propriétés obligatoires
    const finalLabel: DNSLabel = {
      hostname: label.hostname,
      type: this.validateRecordType(serviceName, label.type),
    };

    // Gérer proxied selon les règles suivantes :
    // 1. Si explicitement défini dans le label, utiliser cette valeur
    // 2. Si type A, toujours utiliser true sauf si explicitement défini autrement
    // 3. Si type AAAA, utiliser false par défaut
    // 4. Sinon, utiliser la valeur par défaut si includeDefaults est true
    if (label.proxied !== undefined) {
      finalLabel.proxied = label.proxied;
    } else if (finalLabel.type === "A") {
      finalLabel.proxied = true; // Toujours true pour type A par défaut
    } else if (finalLabel.type === "AAAA") {
      finalLabel.proxied = false; // Toujours false pour type AAAA par défaut
    } else if (includeDefaults) {
      finalLabel.proxied = config.app.defaults.proxied;
    }

    // Gérer le contenu
    if (label.content !== undefined) {
      finalLabel.content = label.content;
    } else if (finalLabel.type === "CNAME") {
      this.logger.error(
        `Missing required content for CNAME record in service ${serviceName}`
      );
      return null;
    }

    // Gérer le TTL
    if (label.ttl !== undefined && !isNaN(label.ttl) && label.ttl > 0) {
      finalLabel.ttl = label.ttl;
    } else if (includeDefaults) {
      finalLabel.ttl = config.app.defaults.ttl;
    }

    // Validations spécifiques
    if (
      finalLabel.type === "AAAA" &&
      finalLabel.content &&
      !LabelValidator.isValidIPv6(finalLabel.content)
    ) {
      this.logger.error(
        `Invalid IPv6 address "${finalLabel.content}" in service ${serviceName}`
      );
      return null;
    }

    // Nettoyer les propriétés undefined
    return Object.fromEntries(
      Object.entries(finalLabel).filter(([_, v]) => v !== undefined)
    ) as DNSLabel;
  }

  private extractDNSLabels(
    serviceName: string,
    labels: { [key: string]: string }
  ): DNSLabel[] {
    const groups = new Map<string, { [key: string]: string }>();
    let defaultValues: { [key: string]: string } = {};

    // D'abord extraire les valeurs par défaut
    Object.entries(labels).forEach(([key, value]) => {
      if (!key.startsWith(LabelValidator.DNS_LABEL_PREFIX)) return;
      const labelPath = key.replace(LabelValidator.DNS_LABEL_PREFIX, "");
      if (!labelPath.includes(".")) {
        defaultValues[labelPath] = value;
      }
    });

    // Regrouper les labels par groupe
    Object.entries(labels).forEach(([key, value]) => {
      if (!key.startsWith(LabelValidator.DNS_LABEL_PREFIX)) return;

      const labelPath = key.replace(LabelValidator.DNS_LABEL_PREFIX, "");
      const parts = labelPath.split(".");

      let group = "default";
      let property = parts[0];

      if (parts.length > 1) {
        if (
          parts[0] === "hostname" ||
          parts[0] === "type" ||
          parts[0] === "content" ||
          parts[0] === "proxied" ||
          parts[0] === "ttl"
        ) {
          // Format: dns.cloudflare.property.group
          [property, group] = parts;
        } else {
          // Format: dns.cloudflare.group.property
          [group, property] = parts;
        }
      }

      if (!groups.has(group)) {
        groups.set(group, {});
      }

      groups.get(group)![property] = value;
    });

    // Appliquer les valeurs par défaut à chaque groupe
    groups.forEach((groupLabels) => {
      Object.entries(defaultValues).forEach(([key, value]) => {
        if (groupLabels[key] === undefined) {
          groupLabels[key] = value;
        }
      });
    });

    // Convertir les groupes en labels DNS
    return Array.from(groups.entries())
      .map(([_, groupLabels]) => {
        const label: DNSLabel = {
          hostname: groupLabels.hostname,
          type: groupLabels.type?.toUpperCase(),
          content: groupLabels.content,
          // Définir proxied uniquement si explicitement spécifié
          ...(groupLabels.proxied !== undefined && {
            proxied: groupLabels.proxied === "true",
          }),
          ttl: parseInt(groupLabels.ttl, 10),
        };

        // Inclure les valeurs par défaut pour :
        // - Les enregistrements A
        // - Les enregistrements sans type (qui deviendront A)
        // - Les enregistrements AAAA et CNAME
        const includeDefaults =
          label.type === "A" ||
          label.type === undefined ||
          label.type === "AAAA" ||
          label.type === "CNAME";

        return this.validateDNSLabel(serviceName, label, includeDefaults);
      })
      .filter((label): label is DNSLabel => label !== null);
  }

  private validateRecordType(serviceName: string, type?: string): string {
    if (!type) return "A";
    const upperType = type.toUpperCase();
    if (!LabelValidator.VALID_RECORD_TYPES.includes(upperType)) {
      this.logger.warn(
        `Invalid DNS record type "${type}" for service ${serviceName}, using "A" instead`
      );
      return "A";
    }
    return upperType;
  }

  private validateTTL(serviceName: string, ttl?: number): number {
    if (!ttl || isNaN(ttl) || ttl < 1) {
      this.logger.warn(
        `Invalid TTL value "${ttl}" for service ${serviceName}, using default`
      );
      return 1;
    }
    return ttl;
  }

  private extractTraefikLabels(labels: { [key: string]: string }): DNSLabel[] {
    if (!labels["traefik.enable"] || labels["traefik.enable"] !== "true") {
      return [];
    }

    const hostRules = Object.entries(labels)
      .filter(
        ([key]) =>
          key.startsWith("traefik.http.routers.") && key.endsWith(".rule")
      )
      .map(([_, value]) => value);

    const processedHosts = new Set<string>();
    const traefikLabels: DNSLabel[] = [];

    for (const rule of hostRules) {
      const hostMatches = rule.match(/Host\(`([^`]+)`\)/g);
      if (hostMatches) {
        for (const match of hostMatches) {
          const hostMatch = match.match(LabelValidator.TRAEFIK_HOST_REGEX);
          if (hostMatch && hostMatch[1] && !processedHosts.has(hostMatch[1])) {
            const hostname = hostMatch[1];
            processedHosts.add(hostname);

            // Créer le label avec les valeurs par défaut
            const label: DNSLabel = {
              hostname,
              type: config.app.defaults.recordType,
              proxied: config.app.defaults.proxied,
              ttl: config.app.defaults.ttl,
            };

            // Surcharger avec les valeurs explicites des labels DNS
            if (labels["dns.cloudflare.type"]) {
              label.type = labels["dns.cloudflare.type"];
            }
            if (labels["dns.cloudflare.content"]) {
              label.content = labels["dns.cloudflare.content"];
            }
            if (labels["dns.cloudflare.proxied"] !== undefined) {
              label.proxied = labels["dns.cloudflare.proxied"] === "true";
            }

            // Important : passer includeDefaults=true pour appliquer les valeurs par défaut
            const validLabel = this.validateDNSLabel("traefik", label, true);
            if (validLabel) {
              traefikLabels.push(validLabel);
            }
          }
        }
      }
    }

    return traefikLabels;
  }
}
