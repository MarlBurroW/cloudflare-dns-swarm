import { LabelValidator } from "./validators";
import { config } from "../config/config";

describe("LabelValidator", () => {
  let validator: LabelValidator;

  beforeEach(() => {
    validator = new LabelValidator();
    // Reset config defaults for tests
    config.app.useTraefikLabels = false;
    config.app.traefik = {
      defaultRecordType: "A",
      defaultContent: undefined,
      defaultProxied: true,
      defaultTTL: 1,
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
      });
      expect(result).toContainEqual({
        hostname: "api.domain.com",
        type: "AAAA",
        content: "2001:db8::1",
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
      expect(result[0].ttl).toBeUndefined();
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
  });

  describe("Traefik integration", () => {
    beforeEach(() => {
      config.app.useTraefikLabels = true;
    });

    it("should create DNS records from Traefik labels", () => {
      const labels = {
        "traefik.enable": "true",
        "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
      };

      const result = validator.validateServiceLabels("test-service", labels);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "app.domain.com",
        type: "A",
        proxied: true,
        ttl: 1,
        content: undefined,
      });
    });

    it("should respect explicit DNS configuration over Traefik defaults", () => {
      const labels = {
        "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
        "dns.cloudflare.hostname": "app.domain.com",
        "dns.cloudflare.type": "CNAME",
        "dns.cloudflare.content": "origin.domain.com",
      };

      const result = validator.validateServiceLabels("test-service", labels);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "app.domain.com",
        type: "CNAME",
        content: "origin.domain.com",
      });
    });

    it("should use Traefik environment defaults", () => {
      config.app.traefik.defaultRecordType = "CNAME";
      config.app.traefik.defaultContent = "origin.domain.com";

      const labels = {
        "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
      };

      const result = validator.validateServiceLabels("test-service", labels);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hostname: "app.domain.com",
        type: "CNAME",
        content: "origin.domain.com",
        proxied: true,
        ttl: 1,
      });
    });

    it("should handle multiple Traefik hosts", () => {
      const labels = {
        "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
        "traefik.http.routers.api.rule": "Host(`api.domain.com`)",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.hostname)).toContain("app.domain.com");
      expect(result.map((r) => r.hostname)).toContain("api.domain.com");
    });

    it("should handle complex Traefik rules", () => {
      const labels = {
        "traefik.http.routers.app.rule":
          "Host(`app.domain.com`) || Host(`www.domain.com`)",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(1);
      expect(result[0].hostname).toBe("app.domain.com");
    });

    it("should ignore Traefik labels when disabled", () => {
      config.app.useTraefikLabels = false;
      const labels = {
        "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
      };

      const result = validator.validateServiceLabels("test-service", labels);
      expect(result).toHaveLength(0);
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
});
