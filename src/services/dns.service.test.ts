import { DNSService } from "./dns.service";
import { CloudflareService } from "./cloudflare.service";
import { IPService } from "./ip.service";
import { TaskWorker } from "../workers/task.worker";
import { LabelValidator } from "../utils/validators";

jest.mock("./cloudflare.service");
jest.mock("./ip.service");
jest.mock("../workers/task.worker");

describe("DNSService", () => {
  let dnsService: DNSService;
  let mockCloudflare: jest.Mocked<CloudflareService>;
  let mockIpService: jest.Mocked<IPService>;
  let mockTaskWorker: jest.Mocked<TaskWorker>;
  let validator: LabelValidator;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    // Reset singleton
    (DNSService as any).instance = undefined;

    // Setup mocks
    mockCloudflare = {
      getInstance: jest.fn().mockReturnThis(),
      getDNSRecord: jest.fn(),
      createDNSRecord: jest.fn(),
      updateDNSRecord: jest.fn(),
      deleteDNSRecord: jest.fn(),
    } as any;

    mockIpService = {
      getInstance: jest.fn().mockReturnThis(),
      getPublicIP: jest.fn().mockResolvedValue("1.2.3.4"),
    } as any;

    mockTaskWorker = {
      getInstance: jest.fn().mockReturnThis(),
      addTask: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock getInstance methods
    (CloudflareService.getInstance as jest.Mock).mockReturnValue(
      mockCloudflare
    );
    (IPService.getInstance as jest.Mock).mockReturnValue(mockIpService);
    (TaskWorker.getInstance as jest.Mock).mockReturnValue(mockTaskWorker);

    dnsService = DNSService.getInstance();
    validator = new LabelValidator();
  });

  describe("handleServiceUpdate", () => {
    it("should create new DNS record when none exists", async () => {
      const labels = {
        "dns.cloudflare.hostname": "test.domain.com",
        "dns.cloudflare.type": "A",
      };

      mockCloudflare.getDNSRecord.mockResolvedValue(null);

      await dnsService.handleServiceUpdate("test-service", labels);

      expect(mockTaskWorker.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CREATE",
          data: expect.objectContaining({
            serviceName: "test-service",
            name: "test.domain.com",
            recordType: "A",
            content: "1.2.3.4",
          }),
        })
      );
    });

    it("should update existing DNS record when content changes", async () => {
      const labels = {
        "dns.cloudflare.hostname": "test.domain.com",
        "dns.cloudflare.type": "A",
        "dns.cloudflare.content": "5.6.7.8",
      };

      mockCloudflare.getDNSRecord.mockResolvedValue({
        id: "record123",
        type: "A",
        name: "test.domain.com",
        content: "1.2.3.4",
        ttl: 1,
        proxied: true,
      });

      await dnsService.handleServiceUpdate("test-service", labels);

      expect(mockTaskWorker.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "UPDATE",
          data: expect.objectContaining({
            recordId: "record123",
            content: "5.6.7.8",
          }),
        })
      );
    });

    it("should not update when record is unchanged", async () => {
      // Mock un enregistrement existant
      mockCloudflare.getDNSRecord.mockResolvedValue({
        id: "record123",
        type: "A",
        name: "test.domain.com",
        content: "1.2.3.4",
        proxied: true, // Important : doit correspondre à la valeur par défaut
        ttl: 1,
      });

      const labels = {
        "dns.cloudflare.hostname": "test.domain.com",
        "dns.cloudflare.type": "A",
      };

      await dnsService.handleServiceUpdate("test-service", labels);

      expect(mockTaskWorker.addTask).not.toHaveBeenCalled();
    });

    it("should handle multiple DNS records", async () => {
      const labels = {
        "dns.cloudflare.hostname": "api.domain.com",
        "dns.cloudflare.type": "A",
        "dns.cloudflare.hostname.v6": "api.domain.com",
        "dns.cloudflare.type.v6": "AAAA",
        "dns.cloudflare.content.v6": "2001:db8::1",
      };

      mockCloudflare.getDNSRecord
        .mockResolvedValueOnce(null) // A record doesn't exist
        .mockResolvedValueOnce(null); // AAAA record doesn't exist

      await dnsService.handleServiceUpdate("test-service", labels);

      expect(mockTaskWorker.addTask).toHaveBeenCalledTimes(2);
      expect(mockTaskWorker.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CREATE",
          data: expect.objectContaining({
            recordType: "A",
            content: "1.2.3.4",
          }),
        })
      );
      expect(mockTaskWorker.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CREATE",
          data: expect.objectContaining({
            recordType: "AAAA",
            content: "2001:db8::1",
          }),
        })
      );
    });

    it("should handle errors gracefully", async () => {
      const labels = {
        "dns.cloudflare.hostname": "test.domain.com",
        "dns.cloudflare.type": "A",
      };

      mockCloudflare.getDNSRecord.mockRejectedValue(new Error("API Error"));

      await expect(
        dnsService.handleServiceUpdate("test-service", labels)
      ).rejects.toThrow("API Error");

      expect(mockTaskWorker.addTask).not.toHaveBeenCalled();
    });

    it("should use correct defaults for different record types", () => {
      const labels = {
        "dns.cloudflare.hostname": "app.domain.com",
        "dns.cloudflare.type": "A", // devrait avoir proxied=true
      };
      const result = validator.validateServiceLabels("test-service", labels);
      expect(result[0].proxied).toBe(true);

      const labelsAAAA = {
        "dns.cloudflare.hostname": "app.domain.com",
        "dns.cloudflare.type": "AAAA", // devrait avoir proxied=false
        "dns.cloudflare.content": "2001:db8::1",
      };
      const resultAAAA = validator.validateServiceLabels(
        "test-service",
        labelsAAAA
      );
      expect(resultAAAA[0].proxied).toBe(false);
    });
  });
});
