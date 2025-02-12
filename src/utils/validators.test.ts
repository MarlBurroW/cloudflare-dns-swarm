import { LabelValidator } from "./validators";
import { config } from "../config/config";
import { Logger } from "../utils/logger";

describe("LabelValidator", () => {
  let validator: LabelValidator;

  beforeEach(() => {
    validator = new LabelValidator();
    // Reset config defaults for tests
    config.app.useTraefikLabels = false;
    config.app.defaults = {
      recordType: "A",
      proxied: true,
      ttl: 1,
    };
  });

  describe("validateServiceLabels", () => {
    it("should validate basic DNS labels", () => {
      const labels = {
        "dns.cloudflare.hostname": "app.domain.com",
        "dns.cloudflare.type": "A",
        "dns.cloudflare.proxied": "true",
      };

      const result = validator.validateServiceLabels("test-service", labels);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "app.domain.com",
        type: "A",
        proxied: true,
        ttl: config.app.defaults.ttl,
      });
    });

    it("should handle multiple record groups", () => {
      const labels = {
        "dns.cloudflare.hostname": "api.domain.com",
        "dns.cloudflare.type": "A",
        "dns.cloudflare.hostname.v6": "api.domain.com",
        "dns.cloudflare.type.v6": "AAAA",
        "dns.cloudflare.content.v6": "2001:db8::1",
      };

      const result = validator.validateServiceLabels("test-service", labels);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        hostname: "api.domain.com",
        type: "A",
        proxied: true,
        ttl: config.app.defaults.ttl,
      });
      expect(result).toContainEqual({
        hostname: "api.domain.com",
        type: "AAAA",
        content: "2001:db8::1",
        proxied: false,
        ttl: config.app.defaults.ttl,
      });
    });

    it("should ignore non-DNS labels", () => {
      const labels = {
        "other.label": "value",
        "dns.cloudflare.hostname": "app.domain.com",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(1);
    });

    it("should skip records without hostname", () => {
      const labels = {
        "dns.cloudflare.type": "A",
        "dns.cloudflare.proxied": "true",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(0);
    });

    it("should handle invalid TTL values", () => {
      const labels = {
        "dns.cloudflare.hostname": "app.domain.com",
        "dns.cloudflare.ttl": "invalid",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "app.domain.com",
        type: "A",
        proxied: true,
        ttl: config.app.defaults.ttl,
      });
    });

    it("should require content for CNAME records", () => {
      const labels = {
        "dns.cloudflare.hostname": "app.domain.com",
        "dns.cloudflare.type": "CNAME",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(0);
    });

    it("should handle boolean proxied values", () => {
      const labels = {
        "dns.cloudflare.hostname": "app.domain.com",
        "dns.cloudflare.proxied": "false",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(1);
      expect(result[0].proxied).toBe(false);
    });

    it("should handle mixed DNS configurations", () => {
      config.app.useTraefikLabels = true;

      const labels = {
        "traefik.enable": "true",
        "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
        "dns.cloudflare.type": "CNAME",
        "dns.cloudflare.content": "origin.domain.com",
        "dns.cloudflare.proxied": "false",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "app.domain.com",
        type: "CNAME",
        content: "origin.domain.com",
        proxied: false,
        ttl: config.app.defaults.ttl,
      });
    });

    it("should extract hostname from Traefik rule when no explicit DNS hostname", () => {
      config.app.useTraefikLabels = true;

      const labels = {
        "traefik.enable": "true",
        "traefik.http.routers.n8n.rule": "Host(`app.example.com`)",
        "dns.cloudflare.type": "CNAME",
        "dns.cloudflare.content": "example.com",
        "dns.cloudflare.proxied": "false",
      };

      const result = validator.validateServiceLabels("n8n_n8n", labels);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "app.example.com",
        type: "CNAME",
        content: "example.com",
        proxied: false,
        ttl: config.app.defaults.ttl,
      });
    });

    it("should handle Docker Swarm service names with underscores", () => {
      config.app.useTraefikLabels = true;

      const labels = {
        "traefik.enable": "true",
        "traefik.http.routers.n8n.rule": "Host(`app.example.com`)",
        "dns.cloudflare.type": "CNAME",
        "dns.cloudflare.content": "example.com",
      };

      const result = validator.validateServiceLabels("n8n_n8n", labels);
      expect(result).toHaveLength(1);
      expect(result[0].hostname).toBe("app.example.com");
    });
  });

  describe("Traefik integration", () => {
    beforeEach(() => {
      config.app.useTraefikLabels = true;
    });

    it("should use environment defaults", () => {
      const labels = {
        "traefik.enable": "true",
        "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "app.domain.com",
        type: config.app.defaults.recordType,
        proxied: true,
        ttl: config.app.defaults.ttl,
      });
    });

    it("should handle complex Traefik rules", () => {
      const labels = {
        "traefik.enable": "true",
        "traefik.http.routers.app.rule":
          "Host(`app.domain.com`) || Host(`api.domain.com`)",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        hostname: "app.domain.com",
        type: config.app.defaults.recordType,
        proxied: true,
        ttl: config.app.defaults.ttl,
      });
      expect(result).toContainEqual({
        hostname: "api.domain.com",
        type: config.app.defaults.recordType,
        proxied: true,
        ttl: config.app.defaults.ttl,
      });
    });

    it("should handle mixed DNS configurations", () => {
      const labels = {
        "traefik.enable": "true",
        "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
        "dns.cloudflare.type": "CNAME",
        "dns.cloudflare.content": "origin.domain.com",
        "dns.cloudflare.proxied": "false",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "app.domain.com",
        type: "CNAME",
        content: "origin.domain.com",
        proxied: false,
        ttl: config.app.defaults.ttl,
      });
    });
  });

  describe("IPv6 validation", () => {
    it("should validate correct IPv6 addresses", () => {
      const labels = {
        "dns.cloudflare.hostname": "api.domain.com",
        "dns.cloudflare.type": "AAAA",
        "dns.cloudflare.content": "2001:db8::1",
      };

      const result = validator.validateServiceLabels("test-service", labels);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("2001:db8::1");
    });

    it("should reject invalid IPv6 addresses", () => {
      const labels = {
        "dns.cloudflare.hostname": "api.domain.com",
        "dns.cloudflare.type": "AAAA",
        "dns.cloudflare.content": "invalid-ipv6",
      };

      const result = validator.validateServiceLabels("test-service", labels);

      expect(result).toHaveLength(0);
    });
  });

  describe("Default values", () => {
    it("should use global defaults for A records", () => {
      const labels = {
        "dns.cloudflare.hostname": "test.domain.com",
        "dns.cloudflare.type": "A",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "test.domain.com",
        type: "A",
        proxied: true,
        ttl: config.app.defaults.ttl,
      });
    });

    it("should use global defaults for CNAME records", () => {
      const labels = {
        "dns.cloudflare.hostname": "test.domain.com",
        "dns.cloudflare.type": "CNAME",
        "dns.cloudflare.content": "origin.domain.com",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "test.domain.com",
        type: "CNAME",
        content: "origin.domain.com",
        proxied: true,
        ttl: config.app.defaults.ttl,
      });
    });
  });

  describe("Label Groups", () => {
    it("should handle alternative group notation", () => {
      const labels = {
        "dns.cloudflare.v4.hostname": "app.domain.com",
        "dns.cloudflare.v4.type": "A",
        "dns.cloudflare.v6.hostname": "app.domain.com",
        "dns.cloudflare.v6.type": "AAAA",
        "dns.cloudflare.v6.content": "2001:db8::1",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        hostname: "app.domain.com",
        type: "A",
        proxied: true,
        ttl: config.app.defaults.ttl,
      });
      expect(result).toContainEqual({
        hostname: "app.domain.com",
        type: "AAAA",
        content: "2001:db8::1",
        proxied: false,
        ttl: config.app.defaults.ttl,
      });
    });

    it("should merge default values with group-specific values", () => {
      const labels = {
        "dns.cloudflare.proxied": "false",
        "dns.cloudflare.hostname.v4": "app.domain.com",
        "dns.cloudflare.type.v4": "CNAME",
        "dns.cloudflare.content.v4": "origin.domain.com",
        "dns.cloudflare.hostname.v6": "app.domain.com",
        "dns.cloudflare.type.v6": "CNAME",
        "dns.cloudflare.content.v6": "origin.domain.com",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(2);
      expect(result[0].proxied).toBe(false);
      expect(result[1].proxied).toBe(false);
    });
  });

  describe("Error handling", () => {
    let mockLogger: jest.SpyInstance;
    let logger: Logger;

    beforeEach(() => {
      logger = Logger.getInstance();
      mockLogger = jest.spyOn(logger as any, "warn");
    });

    afterEach(() => {
      mockLogger.mockRestore();
    });

    it("should log error for invalid record type", () => {
      const labels = {
        "dns.cloudflare.hostname": "app.domain.com",
        "dns.cloudflare.type": "INVALID",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining("Invalid DNS record type")
      );
      expect(result[0].type).toBe("A");
    });

    it("should handle missing content for CNAME with Traefik", () => {
      config.app.useTraefikLabels = true;

      const labels = {
        "traefik.enable": "true",
        "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
        "dns.cloudflare.type": "CNAME", // Pas de content spécifié
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(0);
    });
  });
});
